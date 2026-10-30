// The personal dictionary: words the spellchecker should accept (names, places, made-up
// words), each with an optional meaning. Kept on the device in `meta` so it works offline, and
// on the account so every device gets the same list. Changes made offline wait in `pending`
// and go up on the next flush.

import { eq } from "drizzle-orm";
import type { DictionaryEntry } from "../account";
import { meta } from "../schema/client";
import type { AccountApi } from "./account";
import type { LumenDb } from "./driver";

const KEY = "dictionary";
const norm = (w: string) => w.trim().replace(/’/g, "'");
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const sorted = (list: DictionaryEntry[]) => [...list].sort((a, b) => a.word.localeCompare(b.word, undefined, { sensitivity: "base" }));

interface Saved {
  entries: DictionaryEntry[];
  pending: { add: string[]; remove: string[]; define: { word: string; meaning: string }[] };
}
const EMPTY: Saved = { entries: [], pending: { add: [], remove: [], define: [] } };

export function createDictionary(db: LumenDb, account: AccountApi) {
  let state: Saved = EMPTY;
  let words: string[] = [];
  const listeners = new Set<(words: string[]) => void>();
  const set = (next: Saved) => {
    state = { ...next, entries: sorted(next.entries) };
    words = state.entries.map((e) => e.word);
    listeners.forEach((l) => l(words));
  };

  const save = () =>
    db
      .insert(meta)
      .values({ key: KEY, value: JSON.stringify(state) })
      .onConflictDoUpdate({ target: meta.key, set: { value: JSON.stringify(state) } });

  const fromServer = (r: { words: string[]; entries?: DictionaryEntry[] | undefined }) => r.entries ?? r.words.map((word) => ({ word }));

  async function flush() {
    if (!account.current) return;
    const { add, remove, define } = state.pending;
    const res = add.length || remove.length || define.length ? await account.changeDictionary({ add, remove, define }) : await account.dictionary();
    set({ entries: fromServer(res), pending: EMPTY.pending });
    await save();
  }

  async function change(next: Saved) {
    set(next);
    await save();
    await flush().catch(() => {});
  }

  return {
    async load() {
      const [row] = await db.select().from(meta).where(eq(meta.key, KEY));
      try {
        const saved = row ? (JSON.parse(row.value) as Partial<Saved> & { words?: string[] }) : undefined;
        // Saved before meanings existed: a plain list of words.
        if (saved) set({ entries: saved.entries ?? (saved.words ?? []).map((word) => ({ word })), pending: { ...EMPTY.pending, ...saved.pending } });
      } catch {}
    },
    /** The words, sorted. */
    words: () => words,
    /** The words with their meanings, sorted. */
    entries: () => state.entries,
    has: (word: string) => state.entries.some((e) => same(e.word, norm(word))),
    meaning: (word: string) => state.entries.find((e) => same(e.word, norm(word)))?.meaning,
    onChange(listener: (words: string[]) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    async add(word: string, meaning?: string) {
      const w = norm(word);
      if (!w) return;
      const m = meaning?.trim() ?? "";
      if (state.entries.some((e) => same(e.word, w))) return m ? this.define(w, m) : undefined;
      const { pending } = state;
      await change({
        entries: [...state.entries, m ? { word: w, meaning: m } : { word: w }],
        pending: { add: [...pending.add, w], remove: pending.remove.filter((x) => !same(x, w)), define: m ? [...pending.define, { word: w, meaning: m }] : pending.define },
      });
    },
    /** Sets (or, with "", clears) a word's meaning, adding the word if it isn't there yet. */
    async define(word: string, meaning: string) {
      const w = norm(word);
      const m = meaning.trim();
      if (!w) return;
      const known = state.entries.some((e) => same(e.word, w));
      const entries = known ? state.entries.map((e) => (same(e.word, w) ? (m ? { word: e.word, meaning: m } : { word: e.word }) : e)) : [...state.entries, m ? { word: w, meaning: m } : { word: w }];
      const { pending } = state;
      await change({ entries, pending: { ...pending, remove: pending.remove.filter((x) => !same(x, w)), define: [...pending.define.filter((d) => !same(d.word, w)), { word: w, meaning: m }] } });
    },
    async remove(word: string) {
      const w = norm(word);
      const { pending } = state;
      await change({
        entries: state.entries.filter((e) => !same(e.word, w)),
        pending: { add: pending.add.filter((x) => !same(x, w)), remove: [...pending.remove, w], define: pending.define.filter((d) => !same(d.word, w)) },
      });
    },
    /** Sends offline changes and fetches the account's list (when signed in). */
    sync: () => flush().catch(() => {}),
  };
}

export type DictionaryApi = ReturnType<typeof createDictionary>;
