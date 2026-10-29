// Import a Notion workspace export ("Markdown & CSV", as a .zip) into Lumen.
//
// Notion writes every page as "Title <32 hex id>.md", and its sub-pages into a folder with
// the same name. A database is "Name <id>.csv" plus a folder of row pages. Page ids are
// reused, so importing the same export twice skips what is already there.

import { strFromU8, unzipSync } from "fflate";
import type { BlockType, Json, RichText } from "../model";
import { uuidv7 } from "../ids";
import type { FieldChange, RecordWrite } from "../ops";
import { resolveIcon } from "../icons";
import { plainText, richText } from "../text";
import type { Space } from "../schema/client";
import { localLinks, parseInline, parseMarkdown, type MdBlock } from "./markdown";

/** Images up to this size are embedded in the page; bigger ones are noted and skipped. */
export const MAX_IMAGE_BYTES = 1_500_000;

export interface ImportSummary {
  pages: number;
  blocks: number;
  images: number;
  databases: number;
  /** Pages already in Lumen from an earlier import of the same export. */
  skipped: number;
  warnings: string[];
}

export interface ImportTarget {
  getSpace(): Promise<Space | undefined>;
  getBlock(id: string): Promise<{ id: string; content: string[] } | undefined>;
  write(writes: RecordWrite[]): Promise<void>;
}

type Files = Map<string, Uint8Array>;

interface Node {
  path: string;
  kind: "md" | "csv";
  title: string;
  notionId?: string;
  /** Folder holding this page's sub-pages and assets. */
  folder: string;
  children: Node[];
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

/** Every file in the zip, with nested zips (Notion splits big exports) unpacked in place. */
export function readZip(bytes: Uint8Array, prefix = "", out: Files = new Map(), depth = 0): Files {
  const entries = unzipSync(bytes);
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/") || name.startsWith("__MACOSX/") || /(^|\/)\.DS_Store$/.test(name)) continue;
    if (name.toLowerCase().endsWith(".zip") && depth < 3) readZip(data, prefix, out, depth + 1);
    else out.set(prefix + name.normalize("NFC"), data);
  }
  return out;
}

const ID_SUFFIX = /\s+([0-9a-f]{32})$/i;

function splitName(base: string): { title: string; notionId?: string } {
  const m = ID_SUFFIX.exec(base);
  return m ? { title: base.slice(0, m.index).trim() || "Untitled", notionId: m[1]!.toLowerCase() } : { title: base.trim() || "Untitled" };
}

const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const baseOf = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const stripExt = (p: string) => p.replace(/\.[^./]+$/, "");

/** Resolve a relative link from a file's folder ("a/b" + "../c d.md" -> "a/c d.md"). */
function resolvePath(fromDir: string, href: string): string {
  const parts = fromDir ? fromDir.split("/") : [];
  for (const seg of href.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/").normalize("NFC");
}

/** 32 hex chars derived from a string (four FNV-1a hashes with different seeds). */
function stableHex(s: string): string {
  let out = "";
  for (const seed of [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]) {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}

const asUuid = (hex32: string) => `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20)}`;

function base64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    out += chars[a >> 2]! + chars[((a & 3) << 4) | (b >> 4)]!;
    out += i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)]! : "=";
    out += i + 2 < bytes.length ? chars[c & 63]! : "=";
  }
  return out;
}

/** Minimal CSV reader (quoted fields, embedded newlines). Strips a UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** The page tree of an export, roots first, children in the order their parent links them. */
export function buildTree(files: Files): Node[] {
  const nodes = new Map<string, Node>();
  for (const path of files.keys()) {
    const lower = path.toLowerCase();
    if (!lower.endsWith(".md") && !lower.endsWith(".csv")) continue;
    // Notion writes both "Name <id>.csv" (a view) and "Name <id>_all.csv" (every row); keep one.
    if (lower.endsWith("_all.csv")) continue;
    const kind = lower.endsWith(".md") ? "md" : "csv";
    const { title, notionId } = splitName(stripExt(baseOf(path)));
    nodes.set(path, { path, kind, title, ...(notionId ? { notionId } : {}), folder: stripExt(path), children: [] });
  }
  // An "_all.csv" without a plain twin still counts.
  for (const path of files.keys()) {
    if (!path.toLowerCase().endsWith("_all.csv")) continue;
    const twin = path.replace(/_all\.csv$/i, ".csv");
    if (nodes.has(twin)) continue;
    const { title, notionId } = splitName(stripExt(baseOf(twin)));
    nodes.set(path, { path, kind: "csv", title, ...(notionId ? { notionId } : {}), folder: stripExt(twin), children: [] });
  }

  const byFolder = new Map<string, Node>();
  for (const n of nodes.values()) if (!byFolder.has(n.folder)) byFolder.set(n.folder, n);

  const roots: Node[] = [];
  for (const n of nodes.values()) {
    const parent = byFolder.get(dirOf(n.path));
    if (parent && parent !== n) parent.children.push(n);
    else roots.push(n);
  }

  // Order children the way the parent page links to them; the rest alphabetically.
  const order = (n: Node) => {
    const linked = n.kind === "md" ? localLinks(strFromU8(files.get(n.path)!)).map((l) => resolvePath(dirOf(n.path), l)) : [];
    const rank = (c: Node) => {
      const i = linked.indexOf(c.path) >= 0 ? linked.indexOf(c.path) : linked.indexOf(c.path.replace(/_all\.csv$/i, ".csv"));
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    n.children.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
    n.children.forEach(order);
  };
  // A wrapper folder with no page of its own ("Export-…/") is not a page; its files are roots.
  roots.sort((a, b) => a.title.localeCompare(b.title));
  roots.forEach(order);
  return roots;
}

interface PageContent {
  title: string;
  blocks: MdBlock[];
}

/** Title and blocks of one .md page; database rows turn their "Key: value" lines into text. */
function readPage(md: string, fallbackTitle: string, isRow: boolean): PageContent {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let title = fallbackTitle;
  let start = 0;
  while (start < lines.length && !lines[start]!.trim()) start++;
  const h1 = /^#\s+(.*)$/.exec(lines[start] ?? "");
  if (h1) {
    title = plainText(parseInline(h1[1]!.trim())) || fallbackTitle;
    start++;
  }
  const props: MdBlock[] = [];
  if (isRow) {
    let i = start;
    while (i < lines.length && !lines[i]!.trim()) i++;
    while (i < lines.length && /^[^:\n]{1,60}:\s/.test(lines[i]!)) {
      const [key, ...rest] = lines[i]!.split(":");
      props.push({ type: "text", title: [{ text: key!.trim() + ": ", marks: [{ type: "bold" }] }, ...parseInline(rest.join(":").trim())], children: [] });
      i++;
    }
    if (props.length) start = i;
  }
  const body = parseMarkdown(lines.slice(start).join("\n"));
  return { title, blocks: props.length ? [...props, { type: "divider", children: [] }, ...body] : body };
}

export interface NotionImportOptions {
  onProgress?: (done: number, total: number) => void;
  now?: number;
}

export async function importNotionExport(target: ImportTarget, zip: Uint8Array, options: NotionImportOptions = {}): Promise<ImportSummary> {
  const files = readZip(zip);
  const roots = buildTree(files);
  const summary: ImportSummary = { pages: 0, blocks: 0, images: 0, databases: 0, skipped: 0, warnings: [] };
  if (!roots.length) {
    summary.warnings.push("No Notion pages found. Export with the format \"Markdown & CSV\" and include subpages.");
    return summary;
  }
  const space = await target.getSpace();
  if (!space) throw new Error("No workspace to import into");

  let done = 0;
  const now = options.now ?? Date.now();
  const newRoots: string[] = [];

  const imageBlock = (b: MdBlock, mdDir: string): { source: string } | { note: string } => {
    const src = b.src ?? "";
    if (/^(https?:|data:)/i.test(src)) return { source: src };
    let decoded = src;
    try {
      decoded = decodeURIComponent(src);
    } catch {}
    const path = resolvePath(mdDir, decoded);
    const data = files.get(path);
    if (!data) return { note: `Image not found in the export: ${baseOf(decoded)}` };
    const mime = MIME[path.split(".").pop()!.toLowerCase()];
    if (!mime) return { note: `Image type not supported: ${baseOf(decoded)}` };
    if (data.length > MAX_IMAGE_BYTES) return { note: `Image too large to embed (${(data.length / 1e6).toFixed(1)} MB): ${baseOf(decoded)}` };
    return { source: `data:${mime};base64,${base64(data)}` };
  };

  const blockWrites = (blocks: MdBlock[], parentId: string, mdDir: string, writes: RecordWrite[]): string[] =>
    blocks.map((b) => {
      const id = uuidv7();
      const properties: Record<string, Json> = {};
      const format: Record<string, Json> = {};
      let type: BlockType = b.type;
      if (b.type === "image") {
        const img = imageBlock(b, mdDir);
        if ("source" in img) {
          properties.source = img.source;
          properties.caption = richText(b.caption ?? "");
          summary.images++;
        } else {
          type = "callout";
          properties.title = richText(img.note);
          format.callout_icon = { type: "icon", name: "image" };
          summary.warnings.push(img.note);
        }
      } else {
        properties.title = (b.title ?? []) as RichText as Json;
      }
      if (b.type === "to_do") properties.checked = Boolean(b.checked);
      if (b.type === "code") properties.language = b.language ?? "text";
      if (b.type === "callout") format.callout_icon = { type: "icon", name: b.emoji ? resolveIcon({ type: "emoji", value: b.emoji }, "lightbulb").name : "lightbulb" };
      const content = blockWrites(b.children, id, mdDir, writes);
      writes.push(record(id, { type, properties, format, content, parent_id: parentId }));
      summary.blocks++;
      return id;
    });

  /** A database's row pages, plus pages made from rows that have no .md of their own. */
  const withCsvRows = (node: Node): Node[] => {
    const rows = parseCsv(strFromU8(files.get(node.path)!));
    const [header, ...data] = rows;
    const withPages = new Set(node.children.map((c) => c.title));
    const extra: Node[] = [];
    for (const row of data) {
      const rowTitle = row[0]?.trim() || "Untitled";
      if (withPages.has(rowTitle)) continue;
      withPages.add(rowTitle);
      const path = `${node.folder}/${rowTitle}.md`;
      const md = [`# ${rowTitle}`, "", ...(header ?? []).slice(1).map((h, i) => `${h}: ${row[i + 1] ?? ""}`).filter((l) => !/:\s*$/.test(l))];
      files.set(path, new TextEncoder().encode(md.join("\n")));
      // A stable id, so importing the same export again finds this row.
      const notionId = node.notionId ? stableHex(`${node.notionId}/${rowTitle}`) : undefined;
      extra.push({ path, kind: "md", title: rowTitle, ...(notionId ? { notionId } : {}), folder: `${node.folder}/${rowTitle}`, children: [] });
    }
    return [...node.children, ...extra];
  };

  const record = (id: string, values: Record<string, Json>): RecordWrite => ({
    table: "block",
    id,
    changes: Object.entries({
      space_id: space.id,
      content: [],
      format: {},
      parent_table: "block",
      collection_id: null,
      alive: true,
      created_time: now,
      last_edited_time: now,
      ...values,
    }).map(([field, value]): FieldChange => ({ path: [field], value })),
  });

  const importNode = async (node: Node, parentId: string | null, parentIsDb: boolean): Promise<string | undefined> => {
    const id = node.notionId ? asUuid(node.notionId) : uuidv7();
    done++;
    options.onProgress?.(done, total);
    const existing = node.notionId ? await target.getBlock(id) : undefined;
    if (existing) {
      // Imported before: keep it as is, but still bring in sub-pages that are new since then.
      summary.skipped++;
      const added: string[] = [];
      for (const child of node.kind === "csv" ? withCsvRows(node) : node.children) {
        const childId = await importNode(child, id, node.kind === "csv");
        if (childId) added.push(childId);
      }
      if (added.length) await target.write([{ table: "block", id, changes: [{ path: ["content"], value: [...existing.content, ...added] }] }]);
      return undefined;
    }

    const writes: RecordWrite[] = [];
    let title = node.title;
    let content: string[] = [];
    let icon: Json = { type: "icon", name: "file-text" };
    if (node.kind === "md") {
      const page = readPage(strFromU8(files.get(node.path)!), node.title, parentIsDb);
      title = page.title;
      content = blockWrites(page.blocks, id, dirOf(node.path), writes);
    } else {
      summary.databases++;
      icon = { type: "icon", name: "database", color: "blue" };
    }

    const childIds: string[] = [];
    // Write the page first so its children can point at it.
    writes.push(
      record(id, {
        type: "page",
        properties: { title: richText(title) },
        content,
        format: { icon },
        parent_id: parentId ?? space.id,
        parent_table: parentId ? "block" : "space",
      }),
    );
    await target.write(writes);
    summary.pages++;

    for (const child of node.kind === "csv" ? withCsvRows(node) : node.children) {
      const childId = await importNode(child, id, node.kind === "csv");
      if (childId) childIds.push(childId);
    }
    if (childIds.length) {
      await target.write([{ table: "block", id, changes: [{ path: ["content"], value: [...content, ...childIds] }] }]);
    }
    return id;
  };

  const count = (ns: Node[]): number => ns.reduce((n, c) => n + 1 + count(c.kind === "csv" ? withCsvRows(c) : c.children), 0);
  const total = count(roots);
  for (const root of roots) {
    const id = await importNode(root, null, false);
    if (id) newRoots.push(id);
  }
  if (newRoots.length) {
    const fresh = (await target.getSpace()) ?? space;
    await target.write([{ table: "space", id: fresh.id, changes: [{ path: ["pages"], value: [...fresh.pages, ...newRoots] }, { path: ["last_edited_time"], value: now }] }]);
  }
  return summary;
}
