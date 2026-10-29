// SQLite schema for the sync server. The server is a relay: it stores ops and serves them
// back by sequence number, and never merges records itself. To enforce who may read and write
// what, it also keeps accounts, memberships and a small registry of where each record lives.

import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Json, TableName } from "../model";
import type { PageRole, SpaceRole } from "../account";

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
    /** The workspace the record belongs to (null only for ops stored before accounts existed). */
    space_id: text(),
  },
  (t) => [index("server_ops_device_idx").on(t.device_id, t.seq), index("server_ops_space_idx").on(t.space_id, t.seq)],
);

export const users = sqliteTable("users", {
  id: text().primaryKey(),
  /** Lowercased. */
  email: text().notNull().unique(),
  name: text().notNull(),
  password_hash: text().notNull(),
  created_at: integer().notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    /** sha256 of the bearer token; the token itself is never stored. */
    token_hash: text().notNull().unique(),
    device_name: text().notNull(),
    created_at: integer().notNull(),
    last_seen_at: integer().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.user_id)],
);

export const space_members = sqliteTable(
  "space_members",
  {
    space_id: text().notNull(),
    user_id: text().notNull(),
    role: text().$type<SpaceRole>().notNull(),
    added_at: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.space_id, t.user_id] }), index("space_members_user_idx").on(t.user_id)],
);

/** A page (and everything under it) shared with someone who isn't a member of its workspace. */
export const page_shares = sqliteTable(
  "page_shares",
  {
    page_id: text().notNull(),
    user_id: text().notNull(),
    space_id: text().notNull(),
    role: text().$type<PageRole>().notNull(),
    added_at: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.page_id, t.user_id] }), index("page_shares_user_idx").on(t.user_id)],
);

/** Access for an email address without an account yet; granted when it signs up or logs in. */
export const invites = sqliteTable(
  "invites",
  {
    id: text().primaryKey(),
    email: text().notNull(),
    kind: text().$type<"space" | "page">().notNull(),
    target_id: text().notNull(),
    space_id: text().notNull(),
    role: text().$type<SpaceRole>().notNull(),
    invited_by: text().notNull(),
    created_at: integer().notNull(),
  },
  (t) => [index("invites_email_idx").on(t.email), index("invites_target_idx").on(t.target_id)],
);

/**
 * Where each record lives, kept from the ops that set these fields (last writer wins by HLC,
 * like the clients). Enough to answer "which workspace" and "which pages is it under".
 */
export const server_records = sqliteTable(
  "server_records",
  {
    id: text().primaryKey(),
    table_name: text().$type<TableName>().notNull(),
    space_id: text(),
    parent_id: text(),
    parent_table: text(),
    type: text(),
    /** {field: hlc} for the fields above. */
    clocks: text({ mode: "json" }).$type<Record<string, string>>().notNull(),
  },
  (t) => [index("server_records_parent_idx").on(t.parent_id)],
);

export type ServerOpRow = typeof server_ops.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type ServerRecordRow = typeof server_records.$inferSelect;
