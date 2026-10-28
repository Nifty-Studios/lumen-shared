// Local data layer shared by desktop and mobile: give it a SqlDriver, get the workspace API.

import { createDb, type SqlDriver } from "./driver";
import { migrate } from "./migrate";
import { LocalStore } from "./store";
import { createWorkspace } from "./workspace";

export * from "./driver";
export * from "./migrate";
export * from "./store";
export * from "./workspace";

export function createLumen(driver: SqlDriver) {
  const db = createDb(driver);
  const store = new LocalStore(db);
  const workspace = createWorkspace(store);
  return {
    db,
    store,
    ...workspace,
    onChange: store.onChange,
    /** Migrate, load the device clock, and make sure a workspace exists. */
    async start() {
      await migrate(driver);
      await store.initClock();
      return workspace.bootstrap();
    },
  };
}

export type Lumen = ReturnType<typeof createLumen>;
