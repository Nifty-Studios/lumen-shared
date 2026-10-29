// Local data layer shared by desktop and mobile: give it a SqlDriver, get the workspace API.

import { count, eq, inArray } from "drizzle-orm";
import { importNotionExport, type NotionImportOptions } from "../import/notion";
import { META_KEYS, block, collection, collection_view, field_clock, meta, ops, space } from "../schema/client";
import { createAccount, type ServerConfig } from "./account";
import { exportBackup, restoreBackup } from "./backup";
import { createDb, type SqlDriver } from "./driver";
import { migrate } from "./migrate";
import { createSettings } from "./settings";
import { LocalStore } from "./store";
import { SyncClient } from "./sync";
import { createWorkspace, type AccessView } from "./workspace";

export * from "./account";
export * from "./backup";
export * from "./driver";
export * from "./migrate";
export * from "./settings";
export * from "./store";
export * from "./sync";
export * from "./workspace";
export type { ImportSummary } from "../import/notion";

/**
 * Someone else is signing in, but the notes on this device belong to the account that was
 * signed in before and some of its changes couldn't be sent (usually: offline). Retry when
 * online, or pass `discardUnsent` to drop them.
 */
export class AccountSwitchError extends Error {
  constructor(
    readonly pending: number,
    /** Email of the account the unsent changes belong to. */
    readonly owner: string,
  ) {
    super(`${pending} change${pending === 1 ? "" : "s"} by ${owner} haven't synced yet`);
  }
}

export function createLumen(driver: SqlDriver, options: { server?: ServerConfig | undefined } = {}) {
  const { server } = options;
  const db = createDb(driver);
  const store = new LocalStore(db);
  const account = createAccount(db, server);
  const view = (): AccessView => ({ signedIn: !!account.current, ...account.access });
  const workspace = createWorkspace(store, view);
  const settings = createSettings(db);
  const rejectedListeners = new Set<(opIds: string[]) => void>();

  /** Refreshes what the account can access: drops what was lost, re-pulls when something was gained. */
  async function applyAccess() {
    if (!account.current) return;
    const { gained, lost } = await account.refreshAccess();
    const memberOf = new Set(account.access.spaces.map((s) => s.id));
    for (const scope of lost) {
      const [kind, id] = scope.split(":") as ["space" | "page", string];
      if (kind === "space") await workspace.forget({ space: id });
      else {
        const page = await workspace.getBlock(id);
        if (page && !memberOf.has(page.space_id)) await workspace.forget({ page: id });
      }
    }
    // Something new to see: pull from the start, unless it's already here (e.g. made here).
    for (const scope of gained) {
      const [kind, id] = scope.split(":") as ["space" | "page", string];
      const here = kind === "space" ? (await db.select({ id: space.id }).from(space).where(eq(space.id, id))).length : await workspace.getBlock(id);
      if (!here) {
        await sync?.resetCursor();
        break;
      }
    }
  }

  const sync = server
    ? new SyncClient(store, {
        url: server.url,
        ...(server.fetch ? { fetch: server.fetch } : {}),
        token: () => account.current?.token,
        onUnauthorized: () => void account.expire(),
        onAccessChanged: applyAccess,
        onRejected: (ids) => rejectedListeners.forEach((l) => l(ids)),
      })
    : undefined;

  const unsyncedCount = async () => (await db.select({ n: count() }).from(ops).where(eq(ops.synced, false)))[0]?.n ?? 0;

  /** Removes every record and the sync state from this device (settings stay), and gives it a new device id. */
  async function clearDevice() {
    await db.batch([
      db.delete(block),
      db.delete(space),
      db.delete(collection),
      db.delete(collection_view),
      db.delete(field_clock),
      db.delete(ops),
      db.delete(meta).where(inArray(meta.key, [META_KEYS.syncCursor, META_KEYS.deviceId, "current_space", "bootstrap", "access"])),
    ]);
    // A new identity: the server never sends a device its own ops back, and this device's old
    // ops belong to the account that just left, which may come back.
    await store.initClock();
  }

  /**
   * After signing in: drop the first-launch workspace if it was never used and the account
   * already has one, claim workspaces from before accounts, then sync.
   */
  async function connect() {
    await applyAccess();
    const unused = await workspace.untouchedBootstrap();
    if (unused && account.access.spaces.some((s) => s.id !== unused)) await workspace.forget({ space: unused });
    if ((await account.claimLegacy().catch(() => 0)) > 0) await applyAccess();
    await sync?.sync().catch(() => {});
    // An account with nothing in it yet gets a first workspace, sent right away.
    await workspace.bootstrap();
    await sync?.sync().catch(() => {});
  }

  return {
    db,
    store,
    sync,
    account,
    ...workspace,
    ...settings,
    onChange: store.onChange,
    /** The server refused some changes from this device (edit rights were taken away). */
    onSyncRejected(listener: (opIds: string[]) => void) {
      rejectedListeners.add(listener);
      return () => void rejectedListeners.delete(listener);
    },
    /** The whole workspace as a .zip: full history plus readable Markdown pages. */
    exportBackup: () => exportBackup(store, workspace),
    /** Merges a backup .zip into this device. */
    restoreBackup: (bytes: Uint8Array, onProgress?: (done: number, total: number) => void) => restoreBackup(store, bytes, onProgress),
    /** Imports a Notion "Markdown & CSV" export .zip as new pages. */
    importNotion: (bytes: Uint8Array, opts?: NotionImportOptions) =>
      importNotionExport({ getSpace: workspace.getSpace, getBlock: workspace.getBlock, write: store.write }, bytes, opts),

    /**
     * Migrate, load the device clock, settings and account. `needsAuth` means first launch with
     * nobody signed in: show sign-in, then call signUp()/logIn() or continueSignedOut().
     */
    async start(): Promise<{ needsAuth: boolean }> {
      await migrate(driver);
      await store.initClock();
      await settings.loadSettings();
      await account.load();
      if (account.available && !account.current && !account.skipped) return { needsAuth: true };
      if (account.current) {
        await applyAccess().catch(() => {});
        // A device that just joined pulls before deciding it needs a workspace of its own.
        if (!(await workspace.getSpace())) await sync?.sync().catch(() => {});
      }
      await workspace.bootstrap();
      return { needsAuth: false };
    },

    /** Re-syncs access and data for the signed-in account. */
    connect,

    /** "Later" at first launch: use Lumen on this device only, and get reminded now and then. */
    async continueSignedOut() {
      await account.skip();
      await workspace.bootstrap();
    },

    /** Changes the server hasn't received yet. */
    unsyncedCount,

    /** Creates an account and makes it this device's; see signIn. */
    signUp: (input: { email: string; password: string; name: string }, options?: { discardUnsent?: boolean }) =>
      signIn(() => account.signUp(input), options),
    /** Logs in and makes that account this device's; see signIn. */
    logIn: (input: { email: string; password: string }, options?: { discardUnsent?: boolean }) =>
      signIn(() => account.logIn(input), options),

    /**
     * Signs out, keeping the notes here to use offline. Nothing syncs until someone signs in:
     * the same account carries on where it left off; anyone else replaces these notes with
     * their own, after the unsent changes are delivered to this account.
     */
    async signOut() {
      await sync?.sync().catch(() => {});
      await account.signOutLocally();
    },
  };

  /**
   * One device, one account's notes. Signing in as the account whose notes are here (or on a
   * device with notes from before any sign-in) keeps them and syncs. Signing in as anyone else
   * first sends the previous account its unsent changes, then clears the device and pulls the
   * new account's notes.
   */
  async function signIn(authenticate: () => Promise<{ user: { id: string; email: string; name: string }; token: string }>, { discardUnsent = false } = {}) {
    const next = await authenticate();
    const previous = account.previous;
    if (previous && previous.user.id !== next.user.id) {
      if ((await unsyncedCount()) > 0) {
        try {
          await sync?.pushAs(previous.token);
        } catch {
          // Can't deliver them now; let the person decide.
        }
        const pending = await unsyncedCount();
        if (pending && !discardUnsent) {
          await account.revoke(next.token);
          throw new AccountSwitchError(pending, previous.user.email);
        }
      }
      await account.forgetPrevious();
      await clearDevice();
    } else if (previous) {
      await account.revoke(previous.token);
    }
    await account.adopt(next);
    await connect();
  }
}

export type Lumen = ReturnType<typeof createLumen>;
