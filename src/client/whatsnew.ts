// "What's new": a card shown once after an update, explaining it. It goes away when dismissed,
// or by itself two weeks after it first appeared. A fresh install never shows it.
// Add an entry here for every release that ships (newest first).

import { count, eq } from "drizzle-orm";
import { meta, ops } from "../schema/client";
import type { LumenDb } from "./driver";

export interface ReleaseNote {
  version: string;
  title: string;
  items: { title: string; body: string }[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.2.0",
    title: "Friends, notifications and your own colors",
    items: [
      { title: "Notifications", body: "A bell now keeps everything shared with you and every friend request. Tap one to open it." },
      { title: "Friends", body: "Add people by email, then share with them in one tap." },
      { title: "Your accent color", body: "Pick the color Lumen uses for buttons and highlights in Settings > Appearance, or keep it following the sky." },
      { title: "Spellcheck and your dictionary", body: "Misspelled words get a red underline, in British or American English. Add the words you mean (names, places, made-up words) to your dictionary, with a meaning if you like, and find them all in Settings > Dictionary." },
      { title: "Sharing arrives sooner", body: "Pages and workspaces shared with you now show up as soon as you open Lumen." },
      { title: "A nicer page menu on Android", body: "The ••• menu on a page is a proper sheet now: every option fits, and tapping outside closes it." },
    ],
  },
];

const KEY = "whats_new";
const FRESH = "fresh-install";
const SHOW_FOR = 14 * 86_400_000;

const newer = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
};

export function createWhatsNew(db: LumenDb) {
  type Saved = { seen: string; shownAt?: number; showing?: string };
  const read = async (): Promise<Saved | undefined> => {
    const [row] = await db.select().from(meta).where(eq(meta.key, KEY));
    try {
      return row ? (JSON.parse(row.value) as Saved) : undefined;
    } catch {
      return undefined;
    }
  };
  const write = (v: Saved) =>
    db
      .insert(meta)
      .values({ key: KEY, value: JSON.stringify(v) })
      .onConflictDoUpdate({ target: meta.key, set: { value: JSON.stringify(v) } });

  return {
    /** The note to show for this app version, if it's an update the person hasn't seen yet. */
    async whatsNew(appVersion: string): Promise<ReleaseNote | undefined> {
      const saved = await read();
      // A fresh install has nothing "new" (it was marked at first start, before any notes existed).
      if (saved?.seen === FRESH) {
        await write({ seen: appVersion });
        return undefined;
      }
      const seen = saved?.seen ?? "0.0.0";
      if (!newer(appVersion, seen)) return undefined;
      const note = RELEASE_NOTES.find((n) => n.version === appVersion) ?? RELEASE_NOTES.find((n) => newer(n.version, seen) && !newer(n.version, appVersion));
      if (!note) return undefined;
      const now = Date.now();
      if (saved?.showing === appVersion && saved.shownAt && now - saved.shownAt > SHOW_FOR) {
        await write({ seen: appVersion });
        return undefined;
      }
      if (saved?.showing !== appVersion) await write({ seen, showing: appVersion, shownAt: now });
      return note;
    },
    /** At startup: a device with no history yet is a fresh install, not an update. */
    async markIfFresh() {
      if (await read()) return;
      const [row] = await db.select({ n: count() }).from(ops);
      if (!row?.n) await write({ seen: FRESH });
    },
    /** The card was closed: don't show it again for this version. */
    dismissWhatsNew: (appVersion: string) => write({ seen: appVersion }),
  };
}
