// Local data layer shared by desktop and mobile: give it a SqlDriver, get the workspace API.

import { createDb, type SqlDriver } from "./driver";
import { migrate } from "./migrate";
import { LocalStore } from "./store";
import { SyncClient, type SyncConfig } from "./sync";
import { createWorkspace } from "./workspace";

export * from "./driver";
export * from "./migrate";
export * from "./store";
export * from "./sync";
export * from "./workspace";

export function createLumen(driver: SqlDriver, options: { sync?: SyncConfig } = {}) {
  const db = createDb(driver);
  const store = new LocalStore(db);
  const workspace = createWorkspace(store);
  const sync = options.sync ? new SyncClient(store, options.sync) : undefined;
  return {
    db,
    store,
    sync,
    ...workspace,
    onChange: store.onChange,
    /**
     * Migrate, load the device clock, and make sure a workspace exists. A new device pulls
     * first, so it joins the existing workspace instead of creating its own.
     */
    async start() {
      await migrate(driver);
      await store.initClock();
      if (sync && !(await workspace.getSpace())) await sync.sync().catch(() => {});
      return workspace.bootstrap();
    },
  };
}

export type Lumen = ReturnType<typeof createLumen>;
