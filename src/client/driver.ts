// Each app supplies a tiny SQLite driver (Tauri: the rusqlite bridge; Android: expo-sqlite);
// everything above it (Drizzle, the store, workspace queries, sync) is shared.

import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../schema/client";

export type QueryMethod = "run" | "all" | "values" | "get";

export interface RawQuery {
  sql: string;
  params: unknown[];
  method: QueryMethod;
}

export interface SqlDriver {
  /** Rows as arrays of column values; for "get", the first row (or an empty array). */
  query(sql: string, params: unknown[], method: QueryMethod): Promise<unknown[]>;
  /** Runs every query in one transaction and returns each one's rows. */
  batch(queries: RawQuery[]): Promise<unknown[][]>;
}

export const createDb = (driver: SqlDriver) =>
  drizzle(
    async (sql, params, method) => ({ rows: (await driver.query(sql, params, method)) as any }),
    async (queries) => (await driver.batch(queries)).map((rows) => ({ rows: rows as any })),
    { schema },
  );

export type LumenDb = ReturnType<typeof createDb>;
