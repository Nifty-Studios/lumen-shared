// Local data layer shared by desktop and mobile: give it a SqlDriver, get the workspace API.

import { importNotionExport, type NotionImportOptions } from "../import/notion";
import { exportBackup, restoreBackup } from "./backup";
import { createDb, type SqlDriver } from "./driver";
import { migrate } from "./migrate";
import { createSettings } from "./settings";
import { LocalStore } from "./store";
import { SyncClient, type SyncConfig } from "./sync";
import { createWorkspace } from "./workspace";

export * from "./backup";
export * from "./driver";
export * from "./migrate";
export * from "./settings";
export * from "./store";
export * from "./sync";
export * from "./workspace";
export type { ImportSummary } from "../import/notion";

export function createLumen(driver: SqlDriver, options: { sync?: SyncConfig } = {}) {
  const db = createDb(driver);
  const store = new LocalStore(db);
  const workspace = createWorkspace(store);
  const settings = createSettings(db);
  const sync = options.sync ? new SyncClient(store, options.sync) : undefined;
  return {
    db,
    store,
    sync,
    ...workspace,
    ...settings,
    onChange: store.onChange,
    /** The whole workspace as a .zip: full history plus readable Markdown pages. */
    exportBackup: () => exportBackup(store, workspace),
    /** Merges a backup .zip into this device. */
    restoreBackup: (bytes: Uint8Array, onProgress?: (done: number, total: number) => void) => restoreBackup(store, bytes, onProgress),
    /** Imports a Notion "Markdown & CSV" export .zip as new pages. */
    importNotion: (bytes: Uint8Array, opts?: NotionImportOptions) =>
      importNotionExport({ getSpace: workspace.getSpace, getBlock: workspace.getBlock, write: store.write }, bytes, opts),
    /**
     * Migrate, load the device clock and settings, and make sure a workspace exists. A new
     * device pulls first, so it joins the existing workspace instead of creating its own.
     */
    async start() {
      await migrate(driver);
      await store.initClock();
      await settings.loadSettings();
      if (sync && !(await workspace.getSpace())) await sync.sync().catch(() => {});
      return workspace.bootstrap();
    },
  };
}

export type Lumen = ReturnType<typeof createLumen>;
