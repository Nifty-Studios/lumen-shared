import { describe, expect, it } from "vitest";
import { createLumen } from "./index";
import type { SqlDriver } from "./driver";
import { nodeDriver } from "./test-driver";

/** Counts driver round trips: on desktop each one crosses the Rust bridge. */
function counted(): SqlDriver & { calls: number } {
  const inner = nodeDriver();
  const d = {
    calls: 0,
    query: (...a: Parameters<SqlDriver["query"]>) => (d.calls++, inner.query(...a)),
    batch: (...a: Parameters<SqlDriver["batch"]>) => (d.calls++, inner.batch(...a)),
  };
  return d;
}

describe("performance", () => {
  it("commits a large sync pull in a handful of round trips", async () => {
    const source = createLumen(nodeDriver());
    await source.start();
    const space = (await source.getSpace())!;
    for (let i = 0; i < 40; i++) await source.writeMarkdown(await source.createPage(space, null), `# Page ${i}\n\n- one\n- two\n- three`);
    const ops = (await source.db.select().from((await import("../schema/client")).ops)).map(({ table_name, synced: _, ...op }) => ({ ...op, table: table_name }));

    const driver = counted();
    const target = createLumen(driver);
    await target.start();
    driver.calls = 0;
    const t = performance.now();
    await target.store.commit(ops as never, { remote: true });
    const ms = performance.now() - t;
    console.log(`${ops.length} ops, ${driver.calls} round trips, ${ms.toFixed(0)} ms`);
    expect(driver.calls).toBeLessThan(20);
  });
});
