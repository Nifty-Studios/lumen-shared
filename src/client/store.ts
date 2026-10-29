// The only write path: ops in, records out. Each commit loads the touched records and
// their field clocks, merges the ops (applyOp), and writes the rows, clocks, ops and
// the clock state in one transaction. Commits are serialized.

import { and, eq } from "drizzle-orm";
import { HlcClock } from "../hlc";
import { uuidv7 } from "../ids";
import type { TableName } from "../model";
import { applyOp, makeOps, type FieldClocks, type Op, type RecordWrite } from "../ops";
import { withDefaults } from "../records";
import { deriveSearchText } from "../text";
import { META_KEYS, RECORD_TABLES, field_clock, meta, ops as opsTable } from "../schema/client";
import type { LumenDb } from "./driver";

const OPS_PER_INSERT = 500;

export type ChangeListener =(changed: { table: TableName; id: string }[]) => void;

export class LocalStore {
  private listeners = new Set<ChangeListener>();
  private clock: HlcClock | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(readonly db: LumenDb) {}

  onChange = (listener: ChangeListener) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** Loads (or creates) this device's id and clock. Call once before any commit. */
  initClock = async () => {
    const rows = await this.db.select().from(meta);
    const get = (key: string) => rows.find((r) => r.key === key)?.value;
    let deviceId = get(META_KEYS.deviceId);
    if (!deviceId) {
      deviceId = uuidv7();
      await this.db.insert(meta).values({ key: META_KEYS.deviceId, value: deviceId });
    }
    this.clock = new HlcClock(deviceId, get(META_KEYS.lastHlc));
  };

  get deviceId() {
    return this.getClock().current.split(":")[2] ?? "";
  }

  private getClock() {
    if (!this.clock) throw new Error("initClock() has not run");
    return this.clock;
  }

  /**
   * Applies ops locally. `remote` ops come from elsewhere (sync, a backup): the clock moves
   * past them. They are stored as already synced unless `synced` says otherwise; a restored
   * backup passes synced: false so its ops reach the server (which ignores duplicates).
   */
  commit = (ops: Op[], { remote = false, synced = remote }: { remote?: boolean; synced?: boolean } = {}): Promise<void> => {
    const run = this.queue.then(() => this.commitNow(ops, remote, synced));
    this.queue = run.catch(() => {});
    return run;
  };

  /** Ops for one write per record; see makeOps. */
  write = async (writes: RecordWrite[]) => {
    const ops = writes.filter((w) => w.changes.length).flatMap((w) => makeOps(this.getClock(), w.table, w.id, w.changes));
    if (ops.length) await this.commit(ops);
  };

  private async commitNow(ops: Op[], remote: boolean, synced: boolean) {
    const { db } = this;
    const c = this.getClock();
    if (remote) for (const op of ops) c.receive(op.hlc);

    const groups = new Map<string, Op[]>();
    for (const op of ops) {
      const key = `${op.table}:${op.record_id}`;
      groups.set(key, [...(groups.get(key) ?? []), op]);
    }

    // Drizzle's builders don't type well across a union of tables, so this code is loosely typed.
    const statements: any[] = [];
    const changed: { table: TableName; id: string }[] = [];

    for (const group of groups.values()) {
      const { table, record_id: id } = group[0]!;
      const t = RECORD_TABLES[table] as any;
      const [row] = await db.select().from(t).where(eq(t.id, id));
      const clockRows = await db
        .select()
        .from(field_clock)
        .where(and(eq(field_clock.table_name, table), eq(field_clock.record_id, id)));

      const record: Record<string, unknown> = row ? { ...(row as object) } : { id };
      const clocks: FieldClocks = new Map(clockRows.map((r) => [r.path_key, r.hlc]));
      let applied = false;
      for (const op of group) applied = applyOp(record as never, clocks, op) || applied;
      if (!applied) continue;

      const next = withDefaults(table, record as never) as Record<string, unknown>;
      if (table === "block") next.search_text = deriveSearchText(next.properties as never);
      const { id: _, ...set } = next;
      statements.push(db.insert(t).values(next).onConflictDoUpdate({ target: t.id, set }));
      statements.push(
        db.delete(field_clock).where(and(eq(field_clock.table_name, table), eq(field_clock.record_id, id))),
      );
      if (clocks.size) {
        statements.push(
          db.insert(field_clock).values([...clocks].map(([path_key, hlc]) => ({ table_name: table, record_id: id, path_key, hlc }))),
        );
      }
      changed.push({ table, id });
    }

    // Chunked: SQLite caps the number of bound variables per statement.
    for (let i = 0; i < ops.length; i += OPS_PER_INSERT) {
      statements.push(
        db
          .insert(opsTable)
          .values(ops.slice(i, i + OPS_PER_INSERT).map((op) => ({ ...op, table_name: op.table, synced })))
          .onConflictDoNothing(),
      );
    }
    statements.push(
      db
        .insert(meta)
        .values({ key: META_KEYS.lastHlc, value: c.current })
        .onConflictDoUpdate({ target: meta.key, set: { value: c.current } }),
    );

    await db.batch(statements as [any, ...any[]]);
    if (changed.length) for (const listener of this.listeners) listener(changed);
  }
}
