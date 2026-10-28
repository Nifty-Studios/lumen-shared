import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createLumen, pageTitle, type SqlDriver } from "./index";

/** The same contract the Tauri bridge and expo-sqlite drivers implement. */
function nodeDriver(): SqlDriver {
  const conn = new DatabaseSync(":memory:");
  const run = (sql: string, params: unknown[], method: string): unknown[] => {
    const stmt = conn.prepare(sql);
    if (method === "run") {
      stmt.run(...(params as never[]));
      return [];
    }
    stmt.setReturnArrays(true);
    const rows = stmt.all(...(params as never[])) as unknown[];
    return method === "get" ? ((rows[0] as unknown[]) ?? []) : rows;
  };
  return {
    query: async (sql, params, method) => run(sql, params, method),
    batch: async (queries) => {
      conn.exec("BEGIN");
      try {
        const out = queries.map((q) => run(q.sql, q.params, q.method));
        conn.exec("COMMIT");
        return out;
      } catch (e) {
        conn.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

describe("local client", () => {
  it("bootstraps a workspace, edits pages and searches them", async () => {
    const lumen = createLumen(nodeDriver());
    const space = await lumen.start();
    expect(space.name).toBe("My workspace");

    const tree = await lumen.pageTree(space);
    expect(tree.map((n) => pageTitle(n.page))).toEqual(["Welcome to Lumen"]);

    const id = await lumen.createPage((await lumen.getSpace())!, null);
    await lumen.renamePage(id, "Groceries");
    await lumen.savePage(id, [
      { id: "b1", type: "paragraph", props: {}, content: [{ type: "text", text: "oat milk and bread", styles: {} }], children: [] },
    ] as never);

    const hits = await lumen.search("bre");
    expect(hits.map((h) => h.pageId)).toEqual([id]);

    await lumen.setPageAlive(id, false);
    expect((await lumen.trashedPages()).map((p) => p.id)).toEqual([id]);
    expect(await lumen.search("bread")).toEqual([]);
    expect(lumen.store.deviceId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
