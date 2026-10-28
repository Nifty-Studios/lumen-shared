import { DatabaseSync } from "node:sqlite";
import type { SqlDriver } from "./driver";

/** The same contract the Tauri bridge and expo-sqlite drivers implement. */
export function nodeDriver(): SqlDriver {
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
