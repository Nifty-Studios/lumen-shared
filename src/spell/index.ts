// English spellchecking (Hunspell dictionary via nspell) plus the person's own words. Loading
// the dictionary takes a moment (about half a second on a laptop, a few on a phone), so the
// app makes one checker and keeps it: desktop calls it from the editor, the phone's editor
// webview asks the native side through `misspelled`/`suggest`.

import nspell from "nspell";

/** Words in text, as the editor underlines them: letters with inner apostrophes or hyphens. */
export const WORD_RE = /[\p{L}][\p{L}\p{M}'’]*[\p{L}\p{M}]|[\p{L}]/gu;

/** Words not worth checking: one letter, or anything with digits or underscores nearby. */
export const checkable = (word: string) => word.length > 1 && !/[\d_]/.test(word);

const normal = (w: string) => w.replace(/’/g, "'");

export interface Spellchecker {
  /** The subset of `words` that aren't in the dictionary or the person's words. */
  misspelled(words: string[]): string[];
  /** Up to `max` corrections, best first. */
  suggest(word: string, max?: number): string[];
  /** Replaces the person's own words. */
  setPersonal(words: string[]): void;
}

export type SpellingVariant = "en-GB" | "en-US";

/** American spelling where the device is set to the US, British everywhere else. */
export const defaultSpelling = (locale = Intl.DateTimeFormat().resolvedOptions().locale): SpellingVariant =>
  /^[a-z]{2,3}-US(-|$)/i.test(locale) ? "en-US" : "en-GB";

const loading = new Map<SpellingVariant, Promise<Spellchecker>>();

/** The shared checker for a spelling, loaded once (and off the critical path: call it when the app is idle). */
export function loadSpellchecker(variant: SpellingVariant = "en-GB"): Promise<Spellchecker> {
  const ready = loading.get(variant) ?? load(variant);
  loading.set(variant, ready);
  return ready;
}

async function load(variant: SpellingVariant): Promise<Spellchecker> {
  const { aff, dic } = variant === "en-US" ? await import("./en-us") : await import("./en-gb");
  // Let the caller's frame finish before the heavy parse.
  await new Promise((r) => setTimeout(r, 0));
  const spell = nspell(aff, dic);
  let personal: string[] = [];
  const cache = new Map<string, boolean>();
  const correct = (w: string) => {
    const n = normal(w);
    let ok = cache.get(n);
    if (ok === undefined) {
      ok = spell.correct(n) || (n.includes("-") && n.split("-").every((p) => !p || spell.correct(p)));
      cache.set(n, ok);
    }
    return ok;
  };
  return {
    misspelled: (words) => words.filter((w) => checkable(w) && !correct(w)),
    suggest: (word, max = 5) => spell.suggest(normal(word)).slice(0, max),
    setPersonal(words) {
      for (const w of personal) spell.remove(w);
      personal = words.map(normal);
      for (const w of personal) spell.add(w);
      cache.clear();
    },
  } satisfies Spellchecker;
}
