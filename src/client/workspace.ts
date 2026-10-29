// Workspace queries and edits on top of a LocalStore. Every edit goes through store.write.

import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Block as EditorBlock } from "@blocknote/core";
import { uuidv7 } from "../ids";
import type { Json } from "../model";
import { setPath, type FieldChange, type RecordWrite } from "../ops";
import { plainText, richText } from "../text";
import { block, space, type Block, type Space } from "../schema/client";
import { diffPage } from "../editor/diff";
import type { LocalStore } from "./store";

const fields = (values: Record<string, Json>): FieldChange[] =>
  Object.entries(values).map(([field, value]) => ({ path: [field], value }));

export const pageTitle = (page: Pick<Block, "properties">) => plainText(page.properties.title) || "Untitled";

export interface PageNode {
  page: Block;
  children: PageNode[];
}

export interface SearchHit {
  pageId: string;
  snippet: string;
}

export type PageSession = Awaited<ReturnType<Workspace["openPage"]>>;

/** The base after a save: the previous base with the session's own writes applied. */
function advanceBase(base: Map<string, Block>, pageId: string, writes: RecordWrite[]): Map<string, Block> {
  const next = new Map(base);
  for (const w of writes) {
    if (w.table !== "block" || w.id === pageId) continue;
    const record = structuredClone(next.get(w.id) ?? { id: w.id }) as Record<string, unknown>;
    for (const change of w.changes) setPath(record, change.path, change.value);
    if (record.alive === false) next.delete(w.id);
    else next.set(w.id, record as Block);
  }
  return next;
}

export function createWorkspace(store: LocalStore) {
  const { db, write } = store;

  /** The oldest alive space, so every device settles on the same one if two were created offline. */
  async function getSpace(): Promise<Space | undefined> {
    const [s] = await db.select().from(space).where(eq(space.alive, true)).orderBy(asc(space.created_time), asc(space.id)).limit(1);
    return s;
  }

  /** First launch: create the workspace and a welcome page. */
  async function bootstrap(): Promise<Space> {
    const existing = await getSpace();
    if (existing) return existing;
    const now = Date.now();
    const spaceId = uuidv7();
    const pageId = uuidv7();
    const textId = uuidv7();
    await write([
      {
        table: "space",
        id: spaceId,
        changes: fields({ name: "My workspace", icon: null, pages: [pageId], alive: true, created_time: now, last_edited_time: now }),
      },
      {
        table: "block",
        id: pageId,
        changes: fields({
          space_id: spaceId,
          type: "page",
          properties: { title: richText("Welcome to Lumen") },
          content: [textId],
          format: { icon: { type: "emoji", value: "👋" } },
          parent_id: spaceId,
          parent_table: "space",
          collection_id: null,
          alive: true,
          created_time: now,
          last_edited_time: now,
        }),
      },
      {
        table: "block",
        id: textId,
        changes: fields({
          space_id: spaceId,
          type: "text",
          properties: { title: richText("Everything here is stored on this device. Type / for blocks.") },
          content: [],
          format: {},
          parent_id: pageId,
          parent_table: "block",
          collection_id: null,
          alive: true,
          created_time: now,
          last_edited_time: now,
        }),
      },
    ]);
    return (await getSpace())!;
  }


  /** The sidebar tree: alive pages under the space, ordered by their parent's list. */
  async function pageTree(s: Space): Promise<PageNode[]> {
    const pages = await db.select().from(block).where(and(eq(block.type, "page"), eq(block.alive, true)));
    const byId = new Map(pages.map((p) => [p.id, p]));
    const build = (ids: string[], seen: Set<string>): PageNode[] =>
      ids.flatMap((id) => {
        const page = byId.get(id);
        if (!page || seen.has(id)) return [];
        const next = new Set(seen).add(id);
        return [{ page, children: build(page.content, next) }];
      });
    return build(s.pages, new Set());
  }

  async function getBlock(id: string): Promise<Block | undefined> {
    const [b] = await db.select().from(block).where(eq(block.id, id));
    return b;
  }

  /** Alive, non-page descendants of a page, i.e. what the editor shows. */
  async function loadPageBlocks(pageId: string): Promise<Map<string, Block>> {
    const out = new Map<string, Block>();
    let frontier = [pageId];
    while (frontier.length) {
      const rows = await db
        .select()
        .from(block)
        .where(and(inArray(block.parent_id, frontier), eq(block.alive, true), ne(block.type, "page")));
      frontier = [];
      for (const r of rows) {
        if (out.has(r.id)) continue;
        out.set(r.id, r);
        frontier.push(r.id);
      }
    }
    return out;
  }

  /**
   * An edit session for one open page. Saves diff the editor's document against what this
   * session last loaded or saved, not against the current rows, so changes synced in from
   * another device to blocks this editor didn't touch are never written back over.
   */
  async function openPage(pageId: string) {
    let base = await loadPageBlocks(pageId);
    let queue: Promise<unknown> = Promise.resolve();
    const saveNow = async (doc: EditorBlock[]) => {
      const page = await getBlock(pageId);
      if (!page) return;
      const writes = diffPage(page, base, doc);
      await write(writes);
      base = advanceBase(base, pageId, writes);
    };
    return {
      blocks: base,
      save(doc: EditorBlock[]): Promise<void> {
        const run = queue.then(() => saveNow(doc));
        queue = run.catch(() => {});
        return run;
      },
    };
  }

  async function createPage(s: Space, parentId: string | null): Promise<string> {
    const now = Date.now();
    const id = uuidv7();
    const parent = parentId ? await getBlock(parentId) : undefined;
    await write([
      {
        table: "block",
        id,
        changes: fields({
          space_id: s.id,
          type: "page",
          properties: { title: [] },
          content: [],
          format: {},
          parent_id: parent ? parent.id : s.id,
          parent_table: parent ? "block" : "space",
          collection_id: null,
          alive: true,
          created_time: now,
          last_edited_time: now,
        }),
      },
      parent
        ? { table: "block", id: parent.id, changes: fields({ content: [...parent.content, id], last_edited_time: now }) }
        : { table: "space", id: s.id, changes: fields({ pages: [...s.pages, id], last_edited_time: now }) },
    ]);
    return id;
  }

  const renamePage = (id: string, title: string) =>
    write([{ table: "block", id, changes: fields({ properties: { title: richText(title) }, last_edited_time: Date.now() }) }]);

  const setPageIcon = (id: string, emoji: string | null) =>
    write([
      {
        table: "block",
        id,
        changes: [
          { path: ["format", "icon"], value: emoji ? { type: "emoji", value: emoji } : null },
          { path: ["last_edited_time"], value: Date.now() },
        ],
      },
    ]);

  const setPageAlive = (id: string, alive: boolean) =>
    write([{ table: "block", id, changes: fields({ alive, last_edited_time: Date.now() }) }]);

  const trashedPages = () =>
    db.select().from(block).where(and(eq(block.type, "page"), eq(block.alive, false)));



  /** Full-text search; hits inside a page are reported against that page. */
  async function search(query: string): Promise<SearchHit[]> {
    const terms = query.trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const match = terms.map((t, i) => `"${t.replaceAll('"', '""')}"${i === terms.length - 1 ? "*" : ""}`).join(" ");
    const rows = (await db.all(sql`
      WITH RECURSIVE hits AS (
        SELECT block.id, block.search_text, block_fts.rank AS rank
        FROM block_fts JOIN block ON block.rowid = block_fts.rowid
        WHERE block_fts MATCH ${match} AND block.alive = 1
        ORDER BY rank LIMIT 50
      ),
      up(id, parent_id, type, hit) AS (
        SELECT b.id, b.parent_id, b.type, b.id FROM block b JOIN hits ON b.id = hits.id
        UNION ALL
        SELECT p.id, p.parent_id, p.type, up.hit FROM block p JOIN up ON p.id = up.parent_id WHERE up.type != 'page'
      )
      SELECT up.id, hits.search_text FROM up
      JOIN hits ON hits.id = up.hit
      JOIN block page ON page.id = up.id
      WHERE up.type = 'page' AND page.alive = 1
      ORDER BY hits.rank
    `)) as [string, string][];
    const seen = new Set<string>();
    return rows.flatMap(([pageId, snippet]) => (seen.has(pageId) ? [] : (seen.add(pageId), [{ pageId, snippet }])));
  }

  return { getSpace, bootstrap, pageTree, getBlock, loadPageBlocks, openPage, createPage, renamePage, setPageIcon, setPageAlive, trashedPages, search };
}

export type Workspace = ReturnType<typeof createWorkspace>;
