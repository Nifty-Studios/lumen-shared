import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { RECORD_TABLES } from "./schema/client";
import { syncedFields, withDefaults } from "./records";
import { TABLES } from "./model";

const LOCAL_ONLY = new Set(["id", "search_text"]);

describe("records", () => {
  it("fills required block columns", () => {
    const row = withDefaults("block", { id: "b1", properties: { title: [{ text: "Hi" }] } });
    expect(row).toMatchObject({ id: "b1", type: "text", content: [], alive: true, properties: { title: [{ text: "Hi" }] } });
  });

  it.each(TABLES)("syncs every %s column except local-only ones", (table) => {
    const columns = Object.keys(getTableColumns(RECORD_TABLES[table])).filter((c) => !LOCAL_ONLY.has(c));
    expect(syncedFields(table).sort()).toEqual(columns.sort());
  });
});
