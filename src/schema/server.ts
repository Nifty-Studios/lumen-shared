// SQLite schema for the sync server. The server is a relay: it stores ops and serves
// them back by sequence number. It never needs to materialize records.

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Json, TableName } from "../model";

export const server_ops = sqliteTable(
  "server_ops",
  {
    /** Pull cursor. */
    seq: integer().primaryKey({ autoIncrement: true }),
    id: text().notNull().unique(),
    table_name: text().$type<TableName>().notNull(),
    record_id: text().notNull(),
    path: text({ mode: "json" }).$type<string[]>().notNull(),
    value: text({ mode: "json" }).$type<Json>(),
    hlc: text().notNull(),
    device_id: text().notNull(),
    received_at: integer().notNull(),
  },
  (t) => [index("server_ops_device_idx").on(t.device_id, t.seq)],
);

export type ServerOpRow = typeof server_ops.$inferSelect;
