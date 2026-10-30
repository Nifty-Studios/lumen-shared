// Notifications for the signed-in account (pages and workspaces shared with them, friend
// requests). The server keeps them; the device keeps the last list in `meta` so the inbox
// opens offline. Refreshed when the live socket (re)connects, when it says so, and on demand.

import { eq } from "drizzle-orm";
import type { LumenNotification } from "../account";
import { meta } from "../schema/client";
import type { AccountApi } from "./account";
import type { LumenDb } from "./driver";

const KEY = "inbox";

export function createInbox(db: LumenDb, account: AccountApi) {
  let items: LumenNotification[] = [];
  /** Whose list `items` is, so another account never sees it. */
  let owner: string | undefined;
  let loaded = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const save = () =>
    db
      .insert(meta)
      .values({ key: KEY, value: JSON.stringify({ owner, items }) })
      .onConflictDoUpdate({ target: meta.key, set: { value: JSON.stringify({ owner, items }) } });

  async function load() {
    const [row] = await db.select().from(meta).where(eq(meta.key, KEY));
    try {
      const saved = row ? (JSON.parse(row.value) as { owner?: string; items?: LumenNotification[] }) : {};
      if (saved.owner && saved.owner === account.current?.user.id) {
        owner = saved.owner;
        items = saved.items ?? [];
      }
    } catch {}
    loaded = true;
    emit();
  }

  account.onChange(() => {
    if (owner && owner !== account.current?.user.id) {
      owner = undefined;
      items = [];
      emit();
    }
  });

  return {
    load,
    get items() {
      return items;
    },
    unread: () => items.filter((n) => !n.read_at).length,
    onChange(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    /** Fetches the list. Returns the notifications that weren't here before (none on the first load). */
    async refresh(): Promise<LumenNotification[]> {
      const me = account.current?.user.id;
      if (!me) return [];
      const fresh = await account.notifications();
      const known = new Set(items.map((n) => n.id));
      const firstLook = !loaded || owner !== me;
      owner = me;
      items = fresh;
      loaded = true;
      await save();
      emit();
      return firstLook ? [] : fresh.filter((n) => !known.has(n.id) && !n.read_at);
    },

    /** Marks some (or all) as read, here at once and on the server when it can be reached. */
    async markRead(ids?: string[]) {
      const now = Date.now();
      const pick = ids ? new Set(ids) : undefined;
      if (!items.some((n) => !n.read_at && (!pick || pick.has(n.id)))) return;
      items = items.map((n) => (!n.read_at && (!pick || pick.has(n.id)) ? { ...n, read_at: now } : n));
      emit();
      await save();
      await account.markRead(ids).catch(() => {});
    },

    async clear() {
      items = [];
      emit();
      await save();
      await account.clearNotifications().catch(() => {});
    },
  };
}

export type InboxApi = ReturnType<typeof createInbox>;
