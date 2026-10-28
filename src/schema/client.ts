// SQLite schema for every client device (desktop + mobile). Each device holds the full
// dataset. Record tables are only written by applying ops; `ops` is the outbox and the
// local history, and `field_clock` holds the LWW clock per (record, path).
// Search (block_fts, FTS5) is created by a custom migration in drizzle/client.

import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  BlockFormat,
  BlockProperties,
  BlockType,
  CollectionSchema,
  CollectionViewFormat,
  CollectionViewQuery,
  CollectionViewType,
  Icon,
  Json,
  ParentTable,
  RichText,
  TableName,
} from "../model";

const timestamps = {
  created_time: integer().notNull(),
  last_edited_time: integer().notNull(),
};

export const space = sqliteTable("space", {
  id: text().primaryKey(),
  name: text().notNull(),
  icon: text({ mode: "json" }).$type<Icon>(),
  /** Ordered top-level page ids (the sidebar). */
  pages: text({ mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  alive: integer({ mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const block = sqliteTable(
  "block",
  {
    id: text().primaryKey(),
    space_id: text().notNull(),
    type: text().$type<BlockType>().notNull(),
    properties: text({ mode: "json" }).$type<BlockProperties>().notNull().default(sql`'{}'`),
    /** Ordered child block ids. */
    content: text({ mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    format: text({ mode: "json" }).$type<BlockFormat>().notNull().default(sql`'{}'`),
    parent_id: text().notNull(),
    parent_table: text().$type<ParentTable>().notNull(),
    collection_id: text(),
    /** false = in trash */
    alive: integer({ mode: "boolean" }).notNull().default(true),
    ...timestamps,
    /** Local only, derived via deriveSearchText(); feeds block_fts. */
    search_text: text().notNull().default(""),
  },
  (t) => [index("block_parent_idx").on(t.parent_id), index("block_space_idx").on(t.space_id, t.type)],
);

export const collection = sqliteTable("collection", {
  id: text().primaryKey(),
  space_id: text().notNull(),
  name: text({ mode: "json" }).$type<RichText>().notNull().default(sql`'[]'`),
  icon: text({ mode: "json" }).$type<Icon>(),
  schema: text({ mode: "json" }).$type<CollectionSchema>().notNull().default(sql`'{}'`),
  parent_id: text().notNull(),
  parent_table: text().$type<ParentTable>().notNull(),
  alive: integer({ mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const collection_view = sqliteTable("collection_view", {
  id: text().primaryKey(),
  space_id: text().notNull(),
  type: text().$type<CollectionViewType>().notNull(),
  name: text().notNull().default(""),
  format: text({ mode: "json" }).$type<CollectionViewFormat>().notNull().default(sql`'{}'`),
  query: text({ mode: "json" }).$type<CollectionViewQuery>().notNull().default(sql`'{}'`),
  parent_id: text().notNull(),
  parent_table: text().$type<ParentTable>().notNull(),
  alive: integer({ mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const field_clock = sqliteTable(
  "field_clock",
  {
    table_name: text().$type<TableName>().notNull(),
    record_id: text().notNull(),
    /** pathKey(path) from ops.ts */
    path_key: text().notNull(),
    hlc: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.table_name, t.record_id, t.path_key] })],
);

export const ops = sqliteTable(
  "ops",
  {
    id: text().primaryKey(),
    table_name: text().$type<TableName>().notNull(),
    record_id: text().notNull(),
    path: text({ mode: "json" }).$type<string[]>().notNull(),
    value: text({ mode: "json" }).$type<Json>(),
    hlc: text().notNull(),
    device_id: text().notNull(),
    /** Local ops: pushed to the server yet? Remote ops are stored with synced = true. */
    synced: integer({ mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("ops_unsynced_idx").on(t.synced, t.hlc), index("ops_record_idx").on(t.table_name, t.record_id)],
);

/** Device-local key/value: device_id, last hlc, sync cursor, server url. */
export const meta = sqliteTable("meta", {
  key: text().primaryKey(),
  value: text().notNull(),
});

export const META_KEYS = {
  deviceId: "device_id",
  lastHlc: "last_hlc",
  syncCursor: "sync_cursor",
} as const;

export const RECORD_TABLES = { space, block, collection, collection_view } as const;

export type Space = typeof space.$inferSelect;
export type Block = typeof block.$inferSelect;
export type Collection = typeof collection.$inferSelect;
export type CollectionView = typeof collection_view.$inferSelect;
export type OpRow = typeof ops.$inferSelect;
