import { describe, expect, it } from "vitest";
import { formatHlc } from "./hlc";
import { applyOp, type FieldClocks } from "./ops";
import type { Json } from "./model";

const at = (wall: number, device = "a") => formatHlc({ wall, counter: 0, deviceId: device });

type TestOp = { path: string[]; value: Json; hlc: string };

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

function run(ops: TestOp[]) {
  const record: Record<string, unknown> = {};
  const clocks: FieldClocks = new Map();
  for (const op of ops) applyOp(record, clocks, op);
  return record;
}

/** JSON with sorted keys: key order is not meaningful, only content. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  );

function expectConvergent(ops: TestOp[]) {
  const results = permutations(ops).map((order) => canonical(run(order)));
  expect(new Set(results).size).toBe(1);
  return run(ops);
}

describe("applyOp", () => {
  it("newer write to the same path wins regardless of order", () => {
    const result = expectConvergent([
      { path: ["alive"], value: true, hlc: at(1) },
      { path: ["alive"], value: false, hlc: at(2) },
    ]);
    expect(result.alive).toBe(false);
  });

  it("is idempotent", () => {
    const record: Record<string, unknown> = {};
    const clocks: FieldClocks = new Map();
    const op = { path: ["type"], value: "text", hlc: at(1) };
    expect(applyOp(record, clocks, op)).toBe(true);
    expect(applyOp(record, clocks, op)).toBe(false);
  });

  it("device id breaks ties at the same wall time", () => {
    const result = expectConvergent([
      { path: ["type"], value: "from-a", hlc: at(5, "a") },
      { path: ["type"], value: "from-b", hlc: at(5, "b") },
    ]);
    expect(result.type).toBe("from-b");
  });

  it("concurrent edits to sibling sub-paths both survive", () => {
    const result = expectConvergent([
      { path: ["format", "icon"], value: { type: "emoji", value: "🌱" }, hlc: at(1, "a") },
      { path: ["format", "cover"], value: "cover.png", hlc: at(2, "b") },
    ]);
    expect(result.format).toEqual({ icon: { type: "emoji", value: "🌱" }, cover: "cover.png" });
  });

  it("an older ancestor write keeps newer descendant values", () => {
    const result = expectConvergent([
      { path: ["format"], value: { color: "red" }, hlc: at(2) },
      { path: ["format", "icon"], value: "★", hlc: at(3) },
      { path: ["format", "color"], value: "blue", hlc: at(1) },
    ]);
    expect(result.format).toEqual({ color: "red", icon: "★" });
  });

  it("a newer ancestor write replaces older descendant values", () => {
    const result = expectConvergent([
      { path: ["format", "icon"], value: "★", hlc: at(1) },
      { path: ["format"], value: {}, hlc: at(2) },
    ]);
    expect(result.format).toEqual({});
  });

  it("converges on a mixed set of ops", () => {
    expectConvergent([
      { path: ["properties"], value: { title: [{ text: "Hello" }] }, hlc: at(1) },
      { path: ["properties", "title"], value: [{ text: "Hi" }], hlc: at(3, "b") },
      { path: ["properties", "checked"], value: true, hlc: at(2, "a") },
      { path: ["content"], value: ["x", "y"], hlc: at(2, "b") },
      { path: ["properties"], value: {}, hlc: at(4, "a") },
    ]);
  });

  it("rejects empty paths", () => {
    expect(() => applyOp({}, new Map(), { path: [], value: 1, hlc: at(1) })).toThrow();
  });
});
