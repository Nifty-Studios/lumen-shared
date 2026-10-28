// Every change to a record is an op: "set <path> of <record> to <value> at <hlc>".
// Merging is last-writer-wins per path, and is order-independent, so devices that
// have seen the same set of ops converge on the same record no matter the arrival order.
//
// Rules (applyOp):
//  - An op loses if its path, or any ancestor of its path, already has a clock >= its hlc.
//  - When an op wins on a path, values of descendant paths with newer clocks are kept.

import type { HlcClock, Hlc } from "./hlc";
import { uuidv7 } from "./ids";
import type { Json, TableName } from "./model";

export type Path = readonly string[];

export interface Op {
  id: string;
  table: TableName;
  record_id: string;
  /** Non-empty path into the record, e.g. ["alive"] or ["format", "icon"]. */
  path: string[];
  value: Json;
  hlc: Hlc;
  device_id: string;
}

/** Last-applied hlc per path of one record, keyed by pathKey(path). */
export type FieldClocks = Map<string, Hlc>;

const SEP = "\u001f";

export const pathKey = (path: Path): string => path.join(SEP);
export const keyPath = (key: string): string[] => key.split(SEP);

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function getPath(record: Obj, path: Path): unknown {
  let cur: unknown = record;
  for (const key of path) {
    if (!isObj(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function setPath(record: Obj, path: Path, value: unknown): void {
  let cur = record;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const next = cur[key];
    if (isObj(next)) cur = next;
    else {
      const created: Obj = {};
      cur[key] = created;
      cur = created;
    }
  }
  cur[path[path.length - 1]!] = value;
}

/**
 * Apply one op to a record (mutated in place) and its field clocks.
 * Returns true if the op won and changed the record; false if it lost or was already applied.
 */
export function applyOp(record: Obj, clocks: FieldClocks, op: Pick<Op, "path" | "value" | "hlc">): boolean {
  if (op.path.length === 0) throw new Error("op path must not be empty");

  for (let i = 1; i <= op.path.length; i++) {
    const clock = clocks.get(pathKey(op.path.slice(0, i)));
    if (clock !== undefined && clock >= op.hlc) return false;
  }

  const key = pathKey(op.path);
  const prefix = key + SEP;
  const newer: [string[], unknown][] = [];
  for (const [k, clock] of [...clocks].sort((a, b) => (a[1] < b[1] ? -1 : 1))) {
    if (!k.startsWith(prefix)) continue;
    if (clock > op.hlc) {
      const p = keyPath(k);
      newer.push([p, structuredClone(getPath(record, p))]);
    } else {
      clocks.delete(k);
    }
  }

  setPath(record, op.path, structuredClone(op.value));
  for (const [p, v] of newer) setPath(record, p, v);
  clocks.set(key, op.hlc);
  return true;
}

export interface FieldChange {
  path: string[];
  value: Json;
}

/** Ops for one logical write. All share one hlc, so the write lands atomically. */
/** A set of field changes to one record, turned into ops by makeOps. */
export interface RecordWrite {
  table: TableName;
  id: string;
  changes: FieldChange[];
}

export function makeOps(
  clock: HlcClock,
  table: TableName,
  recordId: string,
  changes: FieldChange[],
): Op[] {
  const hlc = clock.next();
  return changes.map(({ path, value }) => ({
    id: uuidv7(),
    table,
    record_id: recordId,
    path,
    value,
    hlc,
    device_id: clock.deviceId,
  }));
}

/** Ops that create a record: one per top-level field except `id`. */
export function createRecordOps(
  clock: HlcClock,
  table: TableName,
  record: { id: string } & Record<string, Json>,
): Op[] {
  const changes = Object.entries(record)
    .filter(([field]) => field !== "id")
    .map(([field, value]) => ({ path: [field], value }));
  return makeOps(clock, table, record.id, changes);
}
