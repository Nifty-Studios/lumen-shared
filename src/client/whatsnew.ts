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
    version: "1.5.0",
    title: "Themes take over the whole window",
    items: [
      { title: "A whole place, not three ornaments", body: "A theme now dresses everything: a shelf, a bough or the diner's sign across the top of the sidebar, a reading corner, a great old tree or a booth with a jukebox up the right side of the page, and the floor along the bottom." },
      { title: "Light and dark are shades of the theme", body: "With a theme on, light and dark no longer swap the look: they are the bright and the deep version of the theme's own colors, and every button, card, menu and dialog follows." },
      { title: "The weather comes inside", body: "The Workstation's window shows today's rain, snow or lightning (and the cat goes to watch). The Forest gets a frog under a leaf or a snowman. In the Sci-fi restaurant, rain is a meteor shower and the specials board changes with the sky." },
      { title: "Special days decorate the room", body: "Christmas, birthdays, Halloween, Valentine's, Easter and New Year bring a tree, a cake, pumpkins, balloons and bunting into every theme." },
      { title: "Things to poke", body: "Click the cat, the owl, the jukebox or the robot. The lamp, the lantern and the neon signs are real switches, the clocks tell the time, and the forest's leaves follow the season." },
    ],
  },
  {
    version: "1.4.1",
    title: "Themes, redrawn",
    items: [
      { title: "Richer drawings", body: "Every theme has been redrawn with light and shadow: grain in the desk, bark and moss on the log, chrome and glass in the diner, and things now sit on the ground instead of floating." },
      { title: "More to look at", body: "A framed print and a sticky note at the Workstation, a robin and berries in the Forest canopy, a checkerboard floor and proper neon signs in the Sci-fi restaurant, and hazy layers of city, mountains and towers behind them all." },
      { title: "Your pages come first", body: "The little scene at the bottom of the sidebar no longer covers page names, and steps aside when the window is short." },
    ],
  },
  {
    version: "1.4.0",
    title: "Themes, and a much quicker start",
    items: [
      { title: "Themes", body: "Give Lumen a little world of its own: a Workstation with string lights and a cat asleep on the books, a Forest with a fox by a mossy log, or a Sci-fi restaurant with a robot waiter. Pick one in Settings > Appearance." },
      { title: "They live with your sky", body: "Themes keep your real weather and time of day. Lamps, windows and neon come on at night, fireflies come out, snow settles on everything, and the umbrella appears when it rains." },
      { title: "Opens right away", body: "Lumen used to wait for the internet before showing your notes, which could take five seconds. Now it opens from what is on your device and catches up in the background." },
      { title: "Smoother typing on Windows", body: "Spellchecking moved out of the way, so opening a page no longer pauses while the dictionary loads." },
    ],
  },
  {
    version: "1.3.1",
    title: "An easier calendar",
    items: [
      { title: "A box of stickers", body: "All the stickers sit together in their own box now, with their names. Drag one onto a day, or tap it to put it on the day you've picked." },
      { title: "Jump to any month", body: "Tap the month's name to pick any month and year, or go straight back to today. On a computer, the arrow keys move the day, Page Up and Page Down the month, and T comes back to today." },
      { title: "Fixed", body: "Lumen 1.3.0 for Android closed as soon as it opened. On Windows, the What's new window is fully visible again." },
    ],
  },
  {
    version: "1.3.0",
    title: "A calendar, and a sky that celebrates",
    items: [
      { title: "Calendar", body: "Plan your days with stickers: drop one on a day, give it a time, and Lumen reminds you when it comes round. Events can repeat, and each one can have as many reminders as you like." },
      { title: "Special days", body: "New Year, Valentine's Day, Easter, Halloween and Christmas are already on the calendar, and so is your birthday once you tell Lumen when it is." },
      { title: "A sky for the occasion", body: "On a special day the sky joins in: fireworks, floating hearts, snow and fairy lights, confetti and balloons. Mark your own events to celebrate them too, or turn it off in Settings." },
      { title: "Notifications that reach you", body: "Shares, friend requests and reminders now show up in your phone's notification bar and as Windows notifications, even ones that arrived while Lumen was closed." },
      { title: "Fixed", body: "Closing this card now keeps it closed." },
    ],
  },
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
    // Async on purpose: a Drizzle query only runs once awaited, and callers often don't
    // (`void lumen.dismissWhatsNew(v)`), which left the card coming back on every start.
    async dismissWhatsNew(appVersion: string) {
      await write({ seen: appVersion });
    },
  };
}
