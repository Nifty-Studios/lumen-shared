// The person's profile: for now just their birthday, which the calendar celebrates. Kept on
// the device in `meta` (so it works offline and signed out) and on the account (so every
// device knows it). A change made offline waits as `pending` and goes up on the next sync.

import { eq } from "drizzle-orm";
import { isBirthday } from "../calendar";
import { meta } from "../schema/client";
import type { AccountApi } from "./account";
import type { LumenDb } from "./driver";

const KEY = "profile";
/** "Not now" asks again after this long. */
const ASK_AGAIN = 60 * 86_400_000;

interface Saved {
  /** Whose profile this is (undefined: set while signed out, adopted by the next account). */
  owner?: string | undefined;
  birthday: string | null;
  pending: boolean;
  /** Asked for the birthday: when, and whether they said never. */
  askedAt?: number | undefined;
  never?: boolean | undefined;
}

export function createProfile(db: LumenDb, account: AccountApi) {
  let state: Saved = { birthday: null, pending: false };
  const listeners = new Set<() => void>();
  const set = (next: Saved) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const save = () =>
    db
      .insert(meta)
      .values({ key: KEY, value: JSON.stringify(state) })
      .onConflictDoUpdate({ target: meta.key, set: { value: JSON.stringify(state) } });

  // Another account signed in: its birthday isn't this one.
  account.onChange(() => {
    const me = account.current?.user.id;
    if (me && state.owner && state.owner !== me) set({ birthday: null, pending: false });
  });

  async function flush() {
    const me = account.current?.user.id;
    if (!me) return;
    try {
      const res = state.pending || (!state.owner && state.birthday) ? await account.setProfile({ birthday: state.birthday }) : await account.profile();
      set({ ...state, owner: me, birthday: res.birthday, pending: false });
      await save();
    } catch {
      // Offline, or a server from before profiles: keep what's here and try again later.
    }
  }

  return {
    async load() {
      const [row] = await db.select().from(meta).where(eq(meta.key, KEY));
      try {
        if (row) set({ birthday: null, pending: false, ...(JSON.parse(row.value) as Partial<Saved>) });
      } catch {}
    },
    /** "MM-DD" or "YYYY-MM-DD", or null. */
    birthday: () => state.birthday,
    async setBirthday(birthday: string | null) {
      if (birthday !== null && !isBirthday(birthday)) throw new Error("That doesn't look like a date.");
      set({ ...state, birthday, pending: true, askedAt: Date.now() });
      await save();
      await flush();
    },
    /** Should the app ask for the birthday now? */
    shouldAsk: () => !state.birthday && !state.never && (!state.askedAt || Date.now() - state.askedAt > ASK_AGAIN),
    /** They answered "Not now" (`never`: don't ask again). */
    async skipAsking(never = false) {
      set({ ...state, askedAt: Date.now(), never });
      await save();
    },
    onChange(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** Sends an offline change, else fetches the account's profile. */
    sync: flush,
  };
}

export type ProfileApi = ReturnType<typeof createProfile>;
