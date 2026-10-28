import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { clientMigrations, serverMigrations, type Migration } from "./migrations";

function migrate(db: DatabaseSync, migrations: Migration[]) {
  for (const { statements } of migrations) for (const s of statements) db.exec(s);
}

describe("migrations", () => {
  it("client schema applies and block search stays in sync", () => {
    const db = new DatabaseSync(":memory:");
    migrate(db, clientMigrations);

    const insert = db.prepare(
      `INSERT INTO block (id, space_id, type, parent_id, parent_table, created_time, last_edited_time, search_text)
       VALUES (?, 's', 'text', 'p', 'block', 0, 0, ?)`,
    );
    insert.run("b1", "Grocery list for the week");
    insert.run("b2", "Meeting notes");

    const search = db.prepare(
      `SELECT block.id FROM block_fts JOIN block ON block.rowid = block_fts.rowid
       WHERE block_fts MATCH ? AND block.alive = 1 ORDER BY rank`,
    );
    expect(search.all("grocery")).toEqual([{ id: "b1" }]);

    db.prepare("UPDATE block SET search_text = ? WHERE id = ?").run("Shopping list", "b1");
    expect(search.all("grocery")).toEqual([]);
    expect(search.all("shop*")).toEqual([{ id: "b1" }]);

    db.prepare("DELETE FROM block WHERE id = ?").run("b2");
    expect(search.all("meeting")).toEqual([]);
  });

  it("server schema applies", () => {
    const db = new DatabaseSync(":memory:");
    migrate(db, serverMigrations);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'server_ops'").all();
    expect(tables).toHaveLength(1);
  });
});
