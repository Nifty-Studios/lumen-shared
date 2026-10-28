import { clientMigrations } from "../schema/migrations";
import type { SqlDriver } from "./driver";

/** Applies pending client migrations, each in its own transaction. */
export async function migrate(driver: SqlDriver) {
  await driver.query("CREATE TABLE IF NOT EXISTS _migrations (tag TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)", [], "run");
  const applied = new Set(((await driver.query("SELECT tag FROM _migrations", [], "values")) as [string][]).map(([tag]) => tag));
  for (const { tag, statements } of clientMigrations) {
    if (applied.has(tag)) continue;
    await driver.batch([
      ...statements.map((sql) => ({ sql, params: [], method: "run" as const })),
      { sql: "INSERT INTO _migrations (tag, applied_at) VALUES (?, ?)", params: [tag, Date.now()], method: "run" },
    ]);
  }
}
