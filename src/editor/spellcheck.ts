// Red squiggles for misspelled words, drawn with the CSS Custom Highlight API so the editor's
// DOM and ProseMirror state are never touched. The page's own checker answers which words are
// wrong (`check` is async: on the phone it asks the native side); the app shows the menu
// (suggestions, "Add to dictionary") for the word under a click or tap via `at()`.
//
// Style it with:  ::highlight(lumen-misspelled) { text-decoration: underline wavy <color> 1.5px; }

/** The bits of a ProseMirror EditorView this needs (BlockNote's editor.prosemirrorView). */
interface ViewLike {
  posAtDOM(node: Node, offset: number): number;
  state: { tr: { insertText(text: string, from: number, to: number): unknown } };
  dispatch(tr: never): void;
  hasFocus(): boolean;
}

export interface Misspelling {
  word: string;
  node: Text;
  start: number;
  end: number;
  /** Where it is on screen, for placing a menu. */
  rect: DOMRect;
}

export const MISSPELLED_HIGHLIGHT = "lumen-misspelled";
const WORD = /[\p{L}][\p{L}\p{M}'’-]*[\p{L}\p{M}]|[\p{L}]/gu;
/** Code, links and anything not editable are left alone. */
const SKIP = 'pre, code, a, [contenteditable="false"], [data-content-type="codeBlock"]';

export const spellcheckSupported = () => typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";

export function attachSpellcheck(options: { root: () => HTMLElement | null | undefined; view: () => ViewLike | undefined; check: (words: string[]) => Promise<string[]>; delay?: number }) {
  const { root, view, check, delay = 450 } = options;
  const verdict = new Map<string, boolean>(); // word -> misspelled
  let marks: { word: string; node: Text; start: number; end: number }[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let typing = false;
  let stopped = false;
  let run = 0;

  const paint = (list: typeof marks) => {
    marks = list;
    if (!spellcheckSupported()) return;
    const ranges = list.map((m) => {
      const r = document.createRange();
      r.setStart(m.node, m.start);
      r.setEnd(m.node, m.end);
      return r;
    });
    CSS.highlights.set(MISSPELLED_HIGHLIGHT, new Highlight(...ranges));
  };

  async function scan() {
    const el = root();
    if (!el || stopped) return;
    const id = ++run;
    const found: { word: string; node: Text; start: number; end: number }[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      for (const m of n.data.matchAll(WORD)) {
        let word = m[0].replace(/^[-']+|[-']+$/g, "");
        if (word.length < 2) continue;
        const start = m.index! + m[0].indexOf(word);
        // A word glued to digits ("3rd", "mp3") isn't a word to check.
        const before = n.data[start - 1] ?? "";
        const after = n.data[start + word.length] ?? "";
        if (/[\d_@./\\]/.test(before + after)) continue;
        word = word.replace(/’/g, "'");
        found.push({ word, node: n, start, end: start + word.length });
      }
    }
    const unknown = [...new Set(found.map((f) => f.word).filter((w) => !verdict.has(w)))];
    if (unknown.length) {
      const wrong = new Set(await check(unknown).catch(() => [] as string[]));
      if (id !== run || stopped) return;
      for (const w of unknown) verdict.set(w, wrong.has(w));
    }
    // The word being typed isn't marked until the cursor leaves it.
    const sel = typing && view()?.hasFocus() ? document.getSelection() : null;
    const caret = sel?.isCollapsed ? { node: sel.anchorNode, offset: sel.anchorOffset } : undefined;
    paint(found.filter((f) => verdict.get(f.word) && !(caret && caret.node === f.node && caret.offset >= f.start && caret.offset <= f.end)));
    typing = false;
  }

  const schedule = (fromTyping = false) => {
    if (stopped) return;
    typing ||= fromTyping;
    clearTimeout(timer);
    timer = setTimeout(() => void scan(), delay);
  };

  // Moving the cursor out of a just-typed word reveals its squiggle.
  const onSelection = () => {
    if (marks.length || verdict.size) schedule();
  };
  document.addEventListener("selectionchange", onSelection);

  return {
    /** Call after edits (typing marks words only once you've moved on). */
    changed: () => schedule(true),
    /** Re-check everything (the dictionary changed). */
    invalidate() {
      verdict.clear();
      schedule();
    },
    /** The misspelled word at a screen point, if any. */
    at(x: number, y: number): Misspelling | undefined {
      const pos = caretAt(x, y);
      if (!pos) return undefined;
      const m = marks.find((m) => m.node === pos.node && pos.offset >= m.start && pos.offset <= m.end && m.node.isConnected);
      if (!m) return undefined;
      const r = document.createRange();
      r.setStart(m.node, m.start);
      r.setEnd(m.node, m.end);
      const rect = r.getBoundingClientRect();
      // caretAt snaps to the nearest character, so make sure the point is really on the word.
      if (x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 4 || y > rect.bottom + 4) return undefined;
      return { ...m, rect };
    },
    /** Replaces a misspelled word with a suggestion (one undoable edit). */
    replace(m: Misspelling, text: string) {
      const v = view();
      if (!v || !m.node.isConnected) return;
      const from = v.posAtDOM(m.node, m.start);
      const to = v.posAtDOM(m.node, m.end);
      v.dispatch(v.state.tr.insertText(text, from, to) as never);
      schedule();
    },
    destroy() {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelection);
      if (spellcheckSupported()) CSS.highlights.delete(MISSPELLED_HIGHLIGHT);
    },
  };
}

export type SpellcheckHandle = ReturnType<typeof attachSpellcheck>;

function caretAt(x: number, y: number): { node: Node; offset: number } | undefined {
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : undefined;
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : undefined;
}
