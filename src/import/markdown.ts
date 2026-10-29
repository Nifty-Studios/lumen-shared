// A small Markdown reader for imports (Notion's "Markdown & CSV" export dialect included:
// <aside> callouts, <details> toggles, "- [ ]" to-dos, pipe tables, $$ equations).
// Produces a tree of Lumen-shaped blocks; links to other files are reported, not resolved.

import type { BlockType, Mark, RichText, TextSpan } from "../model";

export interface MdBlock {
  type: BlockType;
  title?: RichText;
  checked?: boolean;
  language?: string;
  /** image: the src as written (relative path or URL) */
  src?: string;
  caption?: string;
  /** callout: emoji or other leading symbol, if any */
  emoji?: string;
  children: MdBlock[];
}

// ---------------------------------------------------------------------------------------
// Inline

const ESCAPABLE = new Set("\\`*_{}[]()#+-.!|~<>$\"'".split(""));

function addMark(marks: Mark[], mark: Mark): Mark[] {
  return marks.some((m) => m.type === mark.type) ? marks : [...marks, mark];
}

/** Rich text from one Markdown line (or a paragraph joined with "\n"). */
export function parseInline(text: string): RichText {
  const out: RichText = [];
  const push = (t: string, marks: Mark[]) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && JSON.stringify(last.marks ?? []) === JSON.stringify(marks)) last.text += t;
    else out.push(marks.length ? { text: t, marks } : { text: t });
  };

  const walk = (s: string, marks: Mark[]) => {
    let buf = "";
    const flush = () => {
      push(buf, marks);
      buf = "";
    };
    let i = 0;
    while (i < s.length) {
      const c = s[i]!;
      const rest = s.slice(i);

      if (c === "\\" && i + 1 < s.length && ESCAPABLE.has(s[i + 1]!)) {
        buf += s[i + 1];
        i += 2;
        continue;
      }
      if (c === "`") {
        const ticks = /^`+/.exec(rest)![0];
        const end = s.indexOf(ticks, i + ticks.length);
        if (end > 0) {
          flush();
          push(s.slice(i + ticks.length, end).replace(/^ (.+) $/, "$1"), addMark(marks, { type: "code" }));
          i = end + ticks.length;
          continue;
        }
      }
      if (/^<br\s*\/?>/i.test(rest)) {
        buf += "\n";
        i += /^<br\s*\/?>/i.exec(rest)![0].length;
        continue;
      }
      const html = /^<(u|ins|s|del|strike|b|strong|i|em|code|mark)>([\s\S]*?)<\/\1>/i.exec(rest);
      if (html) {
        const tag = html[1]!.toLowerCase();
        const type: Mark["type"] =
          tag === "u" || tag === "ins" ? "underline"
          : tag === "s" || tag === "del" || tag === "strike" ? "strike"
          : tag === "b" || tag === "strong" ? "bold"
          : tag === "code" ? "code"
          : tag === "mark" ? "background"
          : "italic";
        flush();
        walk(html[2]!, addMark(marks, type === "background" ? { type, value: "yellow" } : { type }));
        i += html[0].length;
        continue;
      }
      const auto = /^<(https?:\/\/[^\s>]+)>/.exec(rest);
      if (auto) {
        flush();
        push(auto[1]!, addMark(marks, { type: "link", value: auto[1]! }));
        i += auto[0].length;
        continue;
      }
      if (c === "<") {
        // Other inline HTML: drop the tag, keep the text.
        const tag = /^<\/?[a-zA-Z][^>]*>/.exec(rest);
        if (tag) {
          i += tag[0].length;
          continue;
        }
      }
      if (c === "[" || (c === "!" && s[i + 1] === "[")) {
        const link = /^!?\[((?:[^\[\]\\]|\\.|\[[^\]]*\])*)\]\(\s*<?([^)\s>]*)>?(?:\s+"[^"]*")?\s*\)/.exec(rest);
        if (link) {
          flush();
          const href = link[2]!;
          const external = /^(https?:|mailto:|tel:)/i.test(href);
          walk(link[1]!, external ? addMark(marks, { type: "link", value: href }) : marks);
          i += link[0].length;
          continue;
        }
      }
      const delim = /^(\*\*|__|~~|\*|_)/.exec(rest)?.[1];
      if (delim) {
        // "_" only opens at a word boundary (snake_case stays as is).
        const okOpen = delim[0] !== "_" || i === 0 || /[\s([{"'*~-]/.test(s[i - 1]!);
        const end = okOpen ? findClose(s, i + delim.length, delim) : -1;
        if (end > i + delim.length) {
          flush();
          const type: Mark["type"] = delim === "~~" ? "strike" : delim.length === 2 ? "bold" : "italic";
          walk(s.slice(i + delim.length, end), addMark(marks, { type }));
          i = end + delim.length;
          continue;
        }
      }
      buf += c;
      i++;
    }
    flush();
  };

  walk(text, []);
  return out;
}

function findClose(s: string, from: number, delim: string): number {
  for (let j = from; j <= s.length - delim.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s[j] === "`") {
      const close = s.indexOf("`", j + 1);
      if (close > 0) j = close;
      continue;
    }
    if (s.startsWith(delim, j)) {
      // Single * or _ must not be the start of a double delimiter.
      if (delim.length === 1 && s[j + 1] === delim) {
        j++;
        continue;
      }
      if (delim[0] === "_" && j + delim.length < s.length && /\w/.test(s[j + delim.length]!)) continue;
      if (/\s/.test(s[j - 1] ?? "")) continue;
      return j;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------------------
// Blocks

const FENCE = /^(\s*)(`{3,}|~{3,})\s*([^\s`]*)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TASK = /^\[([ xX])\]\s+(.*)$/;
const IMAGE = /^\s*!\[([^\]]*)\]\(\s*<?([^)>]*?)>?(?:\s+"[^"]*")?\s*\)\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const indentOf = (line: string) => /^\s*/.exec(line)![0].length;
const isBlank = (line: string) => !line.trim();

function dedent(lines: string[]): string[] {
  const indents = lines.filter((l) => !isBlank(l)).map(indentOf);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(Math.min(min, indentOf(l))));
}

const text = (title: RichText): MdBlock => ({ type: "text", title, children: [] });
const EMOJI_START = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || HR.test(line) || LIST.test(line) || QUOTE.test(line) || IMAGE.test(line) || /^\s*<(aside|details)\b/i.test(line) || /^\s*\$\$/.test(line);
}

export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  return parseLines(lines);
}

function parseLines(lines: string[]): MdBlock[] {
  const out: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlank(line)) {
      i++;
      continue;
    }

    // ``` code ```
    const fence = FENCE.exec(line);
    if (fence) {
      const close = new RegExp(`^\\s*${fence[2]![0] === "`" ? "`" : "~"}{${fence[2]!.length},}\\s*$`);
      const body: string[] = [];
      i++;
      while (i < lines.length && !close.test(lines[i]!)) body.push(lines[i++]!);
      i++;
      out.push({ type: "code", title: [{ text: dedent(body).join("\n") }], language: fence[3] || "text", children: [] });
      continue;
    }

    // $$ equation $$
    if (/^\s*\$\$/.test(line)) {
      const body: string[] = [];
      const first = line.trim().slice(2);
      if (first.endsWith("$$") && first.length > 2) {
        body.push(first.slice(0, -2));
        i++;
      } else {
        if (first) body.push(first);
        i++;
        while (i < lines.length && !lines[i]!.trim().endsWith("$$")) body.push(lines[i++]!);
        if (i < lines.length) {
          const last = lines[i]!.trim().slice(0, -2);
          if (last) body.push(last);
          i++;
        }
      }
      out.push({ type: "code", title: [{ text: body.join("\n").trim() }], language: "latex", children: [] });
      continue;
    }

    // <aside> callout </aside>
    if (/^\s*<aside\b/i.test(line)) {
      const body: string[] = [];
      let first = line.replace(/^\s*<aside[^>]*>/i, "");
      let closed = /<\/aside>\s*$/i.test(first);
      if (closed) first = first.replace(/<\/aside>\s*$/i, "");
      if (first.trim()) body.push(first);
      i++;
      while (!closed && i < lines.length) {
        const l = lines[i++]!;
        if (/<\/aside>\s*$/i.test(l)) {
          const before = l.replace(/<\/aside>\s*$/i, "");
          if (before.trim()) body.push(before);
          closed = true;
        } else body.push(l);
      }
      out.push(callout(parseLines(dedent(body))));
      continue;
    }

    // <details><summary>...</summary> ... </details>
    if (/^\s*<details\b/i.test(line)) {
      let depth = 0;
      const body: string[] = [];
      while (i < lines.length) {
        const l = lines[i++]!;
        depth += (l.match(/<details\b/gi) ?? []).length - (l.match(/<\/details>/gi) ?? []).length;
        body.push(l);
        if (depth <= 0) break;
      }
      const all = body.join("\n").replace(/^\s*<details[^>]*>/i, "").replace(/<\/details>\s*$/i, "");
      const summary = /<summary>([\s\S]*?)<\/summary>/i.exec(all);
      const inner = summary ? all.replace(summary[0], "") : all;
      out.push({ type: "toggle", title: parseInline((summary?.[1] ?? "").trim()), children: parseLines(dedent(inner.split("\n"))) });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      out.push({ type: level === 1 ? "header" : level === 2 ? "sub_header" : "sub_sub_header", title: parseInline(heading[2]!), children: [] });
      i++;
      continue;
    }

    if (HR.test(line)) {
      out.push({ type: "divider", children: [] });
      i++;
      continue;
    }

    const image = IMAGE.exec(line);
    if (image) {
      out.push({ type: "image", src: image[2]!.trim(), caption: image[1]!, children: [] });
      i++;
      continue;
    }

    // Pipe table: kept as one line of text per row (Lumen has no table block yet).
    if (line.trim().startsWith("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]!)) {
      const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const header = cells(line);
      out.push(text(parseInline(header.map((h) => `**${h}**`).join("  ·  "))));
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith("|")) out.push(text(parseInline(cells(lines[i++]!).join("  ·  "))));
      continue;
    }

    const list = LIST.exec(line);
    if (list) {
      const indent = list[1]!.length;
      const ordered = /\d/.test(list[2]!);
      let content = list[3]!;
      let type: BlockType = ordered ? "numbered_list" : "bulleted_list";
      let checked: boolean | undefined;
      const task = !ordered ? TASK.exec(content) : null;
      if (task) {
        type = "to_do";
        checked = task[1] !== " ";
        content = task[2]!;
      }
      i++;
      // Everything indented deeper than the marker (blank lines included) belongs to this item.
      const childLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i]!;
        if (isBlank(l)) {
          const next = lines.slice(i + 1).find((x) => !isBlank(x));
          if (next !== undefined && indentOf(next) > indent) {
            childLines.push("");
            i++;
            continue;
          }
          break;
        }
        if (indentOf(l) > indent) {
          childLines.push(l);
          i++;
        } else break;
      }
      // Lazy continuation: indented plain text right under the item continues its first line.
      const parsed = parseLines(dedent(childLines));
      const item: MdBlock = { type, title: parseInline(content), children: parsed };
      if (checked !== undefined) item.checked = checked;
      out.push(item);
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) body.push(QUOTE.exec(lines[i++]!)![1]!);
      const inner = parseLines(body);
      const [first, ...rest] = inner;
      if (first && first.type === "text") out.push({ type: "quote", title: first.title ?? [], children: rest });
      else out.push({ type: "quote", title: [], children: inner });
      continue;
    }

    // Paragraph: consecutive lines until a blank line or another block starts.
    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && !isBlank(lines[i]!) && !startsBlock(lines[i]!)) para.push(lines[i++]!.trim());
    out.push(text(parseInline(para.join("\n"))));
  }
  return out;
}

function callout(inner: MdBlock[]): MdBlock {
  const [first, ...rest] = inner;
  const block: MdBlock = { type: "callout", title: [], children: rest };
  if (first && (first.type === "text" || first.type === "header" || first.type === "sub_header" || first.type === "sub_sub_header")) {
    const title = [...(first.title ?? [])];
    const lead = title[0];
    const emoji = lead ? EMOJI_START.exec(lead.text) : null;
    if (lead && emoji) {
      block.emoji = emoji[1]!;
      const remaining = lead.text.slice(emoji[0].length);
      if (remaining) title[0] = { ...lead, text: remaining } as TextSpan;
      else title.shift();
    }
    // A lone emoji line followed by text: the text is the callout's first line.
    if (!title.length && rest[0]?.type === "text") {
      block.title = rest[0].title ?? [];
      block.children = rest.slice(1);
    } else {
      block.title = title;
    }
  } else if (first) {
    block.children = inner;
  }
  return block;
}

/** Links in the Markdown that point to other files (not URLs), decoded, in order. */
export function localLinks(md: string): string[] {
  const out: string[] = [];
  for (const m of md.matchAll(/\[(?:[^\[\]\\]|\\.)*\]\(\s*<?([^)\s>]+)>?\s*\)/g)) {
    const href = m[1]!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) continue;
    try {
      out.push(decodeURIComponent(href));
    } catch {
      out.push(href);
    }
  }
  return out;
}
