// Turning op-built records into storable rows. Ops can arrive in any order during sync,
// so a field op may land before the ops that create its record. withDefaults fills
// required columns with placeholders. The real values win later, because those
// fields have no clock yet.

import type { Json, TableName } from "./model";

type Row = Record<string, unknown>;

const common = { alive: true, created_time: 0, last_edited_time: 0 };

const DEFAULTS: Record<TableName, Row> = {
  space: { ...common, name: "", icon: null, pages: [] },
  block: {
    ...common,
    space_id: "",
    type: "text",
    properties: {},
    content: [],
    format: {},
    parent_id: "",
    parent_table: "block",
    collection_id: null,
  },
  collection: { ...common, space_id: "", name: [], icon: null, schema: {}, parent_id: "", parent_table: "block" },
  collection_view: {
    ...common,
    space_id: "",
    type: "table",
    name: "",
    format: {},
    query: {},
    parent_id: "",
    parent_table: "block",
  },
};

/** The synced fields of a table (everything except `id` and local-only columns). */
export const syncedFields = (table: TableName): string[] => Object.keys(DEFAULTS[table]);

export function withDefaults<T extends Row>(table: TableName, record: T): T {
  const out: Row = { ...record };
  for (const [field, value] of Object.entries(DEFAULTS[table])) {
    if (out[field] === undefined || (out[field] === null && value !== null)) out[field] = structuredClone(value);
  }
  return out as T;
}

/** Strip local-only columns before diffing or creating ops. */
export function syncedValues(table: TableName, row: Row): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const field of syncedFields(table)) if (row[field] !== undefined) out[field] = row[field] as Json;
  return out;
}
