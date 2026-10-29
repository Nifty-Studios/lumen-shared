// Workspace queries and edits on top of a LocalStore. Every edit goes through store.write.

import { and, asc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import type { Block as EditorBlock, PartialBlock } from "@blocknote/core";
import { strongerRole, type PageRole, type Role, type SpaceRole } from "../account";
import { uuidv7 } from "../ids";
import type { BlockType, Icon, Json, TableName } from "../model";
import { setPath, type FieldChange, type RecordWrite } from "../ops";
import { plainText, richText } from "../text";
import { block, collection, collection_view, field_clock, meta, ops, space, type Block, type Space } from "../schema/client";
import { diffPage } from "../editor/diff";
import { isEditorBlock, toEditorBlock } from "../editor/convert";
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

/** What the signed-in account may see. Signed out, everything on the device is the user's own. */
export interface AccessView {
  signedIn: boolean;
  spaces: { id: string; role: SpaceRole }[];
  pages: { id: string; space_id: string; role: PageRole }[];
}

/** Another device changed an open page. */
export interface RemoteUpdate {
  /** The page's editor blocks as now stored. */
  doc: PartialBlock[];
  /** Top-level blocks that changed, appeared or disappeared. */
  changed: string[];
  title: string;
}

const CURRENT_SPACE = "current_space";
const BOOTSTRAP = "bootstrap";
const SIGNED_OUT: AccessView = { signedIn: false, spaces: [], pages: [] };

/** The editor's view of a page: its alive, editable top-level blocks. */
export function editorDoc(page: Block, blocks: Map<string, Block>): PartialBlock[] {
  return page.content
    .map((id) => blocks.get(id))
    .filter((b): b is Block => !!b && b.alive && isEditorBlock(b.type))
    .map((b) => toEditorBlock(b, blocks));
}

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

export function createWorkspace(store: LocalStore, access: () => AccessView = () => SIGNED_OUT) {
  const { db, write } = store;

  const readMeta = async (key: string) => (await db.select().from(meta).where(eq(meta.key, key)))[0]?.value;
  const writeMeta = (key: string, value: string) =>
    db.insert(meta).values({ key, value }).onConflictDoUpdate({ target: meta.key, set: { value } });

  /**
   * Workspaces on this device the user can open, oldest first, with their role. Signed in,
   * that's what the account can access, plus any created on this device (the server makes
   * their creator the owner, and access may not have been refreshed since).
   */
  async function listSpaces(): Promise<{ space: Space; role: SpaceRole }[]> {
    const rows = await db.select().from(space).where(eq(space.alive, true)).orderBy(asc(space.created_time), asc(space.id));
    const a = access();
    if (!a.signedIn) return rows.map((s) => ({ space: s, role: "owner" as const }));
    const roles = new Map(a.spaces.map((s) => [s.id, s.role]));
    const createdHere = new Set(
      (
        await db
          .selectDistinct({ id: ops.record_id })
          .from(ops)
          .where(and(eq(ops.table_name, "space"), eq(ops.path, ["created_time"]), eq(ops.device_id, store.deviceId)))
      ).map((r) => r.id),
    );
    return rows.flatMap((s) => {
      const role = roles.get(s.id) ?? (createdHere.has(s.id) ? "owner" : undefined);
      return role ? [{ space: s, role }] : [];
    });
  }

  /** The workspace in view: the one picked last, else the oldest (so devices agree). */
  async function getSpace(): Promise<Space | undefined> {
    const spaces = await listSpaces();
    const picked = await readMeta(CURRENT_SPACE);
    return (spaces.find((s) => s.space.id === picked) ?? spaces[0])?.space;
  }

  const setCurrentSpace = (id: string) => writeMeta(CURRENT_SPACE, id);

  /** Pages shared with the user on their own (outside workspaces they're in). */
  async function sharedPages(): Promise<{ page: Block; role: PageRole }[]> {
    const a = access();
    const member = new Set(a.spaces.map((s) => s.id));
    const shares = a.pages.filter((p) => !member.has(p.space_id));
    if (!shares.length) return [];
    const rows = await db.select().from(block).where(and(inArray(block.id, shares.map((p) => p.id)), eq(block.alive, true)));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return shares.flatMap((p) => {
      const page = byId.get(p.id);
      return page ? [{ page, role: p.role }] : [];
    });
  }

  /** The user's role on a block or page: their workspace role, or a share on it or a page above it. */
  async function roleOf(id: string): Promise<Role | undefined> {
    const a = access();
    if (!a.signedIn) return "owner";
    let cur = await getBlock(id);
    if (!cur) return undefined;
    const spaceId = cur.space_id;
    let role: Role | undefined = (await listSpaces()).find((s) => s.space.id === spaceId)?.role;
    const shares = new Map(a.pages.map((p) => [p.id, p.role]));
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id) && role !== "owner") {
      seen.add(cur.id);
      role = strongerRole(role, shares.get(cur.id));
      cur = cur.parent_table === "block" ? await getBlock(cur.parent_id) : undefined;
    }
    return role;
  }

  /** First launch: create the workspace and a welcome page. */
  async function bootstrap(): Promise<Space> {
    const existing = await getSpace();
    if (existing) return existing;
    const now = Date.now();
    const spaceId = uuidv7();
    const pageId = uuidv7();
    const welcome: [BlockType, string, Record<string, Json>?][] = [
      ["text", "Lumen keeps every note on this device and syncs quietly in the background. Nothing here needs the internet."],
      ["callout", "Press / anywhere to add headings, lists, to-dos, callouts, code and more.", { callout_icon: { type: "icon", name: "lightbulb" } }],
      ["sub_header", "A few things to try"],
      ["to_do", "Click anywhere below the last line to keep writing"],
      ["to_do", "Open Settings at the bottom of the sidebar and pick a mood for your sky"],
      ["to_do", "Search everything with Ctrl K"],
      ["to_do", "Export a backup from Settings, then restore it on any device, even offline"],
      ["quote", "The sky follows your real sun and weather. Change it whenever you like."],
    ];
    const blocks = welcome.map(([type, text, format]) => ({ id: uuidv7(), type, text, format: format ?? {} }));
    const record = (values: Record<string, Json>): Record<string, Json> => ({
      space_id: spaceId,
      content: [],
      format: {},
      parent_table: "block",
      collection_id: null,
      alive: true,
      created_time: now,
      last_edited_time: now,
      ...values,
    });
    await write([
      {
        table: "space",
        id: spaceId,
        changes: fields({ name: "My workspace", icon: null, pages: [pageId], alive: true, created_time: now, last_edited_time: now }),
      },
      {
        table: "block",
        id: pageId,
        changes: fields(
          record({
            type: "page",
            properties: { title: richText("Welcome to Lumen") },
            content: blocks.map((b) => b.id),
            format: { icon: { type: "icon", name: "sparkles", color: "yellow" } },
            parent_id: spaceId,
            parent_table: "space",
          }),
        ),
      },
      ...blocks.map((b) => ({
        table: "block" as const,
        id: b.id,
        changes: fields(record({ type: b.type, properties: { title: richText(b.text) }, format: b.format, parent_id: pageId })),
      })),
    ]);
    // Remembered so a later sign-in can drop this workspace if it was never used.
    await writeMeta(BOOTSTRAP, JSON.stringify({ space_id: spaceId, hlc: (await readMeta("last_hlc")) ?? "" }));
    return (await getSpace())!;
  }

  /** The workspace made at first launch, if nothing in it has changed since. */
  async function untouchedBootstrap(): Promise<string | undefined> {
    const raw = await readMeta(BOOTSTRAP);
    if (!raw) return undefined;
    const { space_id, hlc } = JSON.parse(raw) as { space_id: string; hlc: string };
    const inSpace = db.select({ id: block.id }).from(block).where(eq(block.space_id, space_id));
    const [later] = await db
      .select({ id: ops.id })
      .from(ops)
      .where(and(gt(ops.hlc, hlc), or(eq(ops.record_id, space_id), inArray(ops.record_id, inSpace))))
      .limit(1);
    const [alive] = await db.select({ id: space.id }).from(space).where(and(eq(space.id, space_id), eq(space.alive, true)));
    return alive && !later ? space_id : undefined;
  }

  /**
   * Removes records from this device only (no ops): a workspace or shared page the account
   * lost access to, or an unused first-launch workspace. Their unsent ops go too.
   */
  async function forget(scope: { space: string } | { page: string }) {
    let ids: { table: TableName; id: string }[];
    if ("space" in scope) {
      const tables = [
        ["block", block],
        ["collection", collection],
        ["collection_view", collection_view],
      ] as const;
      const rows = await Promise.all(
        tables.map(async ([table, t]) => (await db.select({ id: t.id }).from(t).where(eq(t.space_id, scope.space))).map((r) => ({ table, id: r.id }))),
      );
      ids = [{ table: "space" as TableName, id: scope.space }, ...rows.flat()];
    } else {
      const rows = (await db.all(sql`
        WITH RECURSIVE tree(id) AS (SELECT ${scope.page} UNION SELECT block.id FROM block JOIN tree ON block.parent_id = tree.id)
        SELECT id FROM tree
      `)) as [string][];
      ids = rows.map(([id]) => ({ table: "block" as TableName, id }));
    }
    const tablesByName = { space, block, collection, collection_view } as const;
    const statements: any[] = [];
    for (let i = 0; i < ids.length; i += 400) {
      const byTable = new Map<TableName, string[]>();
      for (const { table, id } of ids.slice(i, i + 400)) byTable.set(table, [...(byTable.get(table) ?? []), id]);
      for (const [table, list] of byTable) {
        const t = tablesByName[table] as any;
        statements.push(db.delete(t).where(inArray(t.id, list)));
        statements.push(db.delete(field_clock).where(and(eq(field_clock.table_name, table), inArray(field_clock.record_id, list))));
        statements.push(db.delete(ops).where(and(eq(ops.table_name, table), inArray(ops.record_id, list))));
      }
    }
    if (statements.length) await db.batch(statements as [any, ...any[]]);
    return ids.length;
  }

  /** Alive child pages of a page, in order (shown under "Pages inside"). */
  async function childPages(pageId: string): Promise<Block[]> {
    const parent = await getBlock(pageId);
    if (!parent) return [];
    const rows = await db.select().from(block).where(and(eq(block.parent_id, pageId), eq(block.type, "page"), eq(block.alive, true)));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return parent.content.flatMap((id) => byId.get(id) ?? []);
  }

  /** The page's ancestors from the top level down (for breadcrumbs), not including the page. */
  async function pagePath(pageId: string): Promise<Block[]> {
    const out: Block[] = [];
    let cur = await getBlock(pageId);
    const seen = new Set<string>();
    while (cur && cur.parent_table === "block" && !seen.has(cur.parent_id)) {
      seen.add(cur.parent_id);
      const parent = await getBlock(cur.parent_id);
      if (!parent) break;
      if (parent.type === "page") out.unshift(parent);
      cur = parent;
    }
    return out;
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
    let page = await getBlock(pageId);
    let queue: Promise<unknown> = Promise.resolve();
    const enqueue = <T>(task: () => Promise<T>) => {
      const run = queue.then(task);
      queue = run.catch(() => {});
      return run;
    };
    const saveNow = async (doc: EditorBlock[]) => {
      const current = await getBlock(pageId);
      if (!current) return;
      const writes = diffPage(current, base, doc);
      await write(writes);
      base = advanceBase(base, pageId, writes);
    };

    // Other devices' changes to this page: reload, and tell the editor which top-level blocks moved on.
    const listeners = new Set<(u: RemoteUpdate) => void>();
    const offStore = store.onChange((changed, { remote }) => {
      if (!remote || !listeners.size) return;
      const ids = new Set(changed.filter((c) => c.table === "block").map((c) => c.id));
      if (!ids.size) return;
      void enqueue(async () => {
        const next = await loadPageBlocks(pageId);
        const nextPage = await getBlock(pageId);
        if (!nextPage || !(ids.has(pageId) || [...ids].some((id) => base.has(id) || next.has(id)))) return;
        const top = (id: string): string | undefined => {
          const seen = new Set<string>();
          for (let cur: string | undefined = id; cur && !seen.has(cur); ) {
            seen.add(cur);
            const rec: Block | undefined = next.get(cur) ?? base.get(cur);
            if (!rec) return undefined;
            if (rec.parent_id === pageId) return cur;
            cur = rec.parent_id;
          }
          return undefined;
        };
        const changedTop = new Set([...ids].flatMap((id) => top(id) ?? []));
        const before = page?.content ?? [];
        for (const id of nextPage.content) if (!before.includes(id)) changedTop.add(id);
        for (const id of before) if (!nextPage.content.includes(id)) changedTop.add(id);
        base = next;
        page = nextPage;
        const update: RemoteUpdate = { doc: editorDoc(nextPage, next), changed: [...changedTop], title: plainText(nextPage.properties.title) };
        for (const l of listeners) l(update);
      });
    });

    return {
      blocks: base,
      save: (doc: EditorBlock[]): Promise<void> => enqueue(() => saveNow(doc)),
      onRemote(listener: (u: RemoteUpdate) => void) {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
      close: () => offStore(),
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

  const setPageIcon = (id: string, icon: Icon | null) =>
    write([
      {
        table: "block",
        id,
        changes: [
          { path: ["format", "icon"], value: icon },
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

  return {
    getSpace,
    listSpaces,
    setCurrentSpace,
    sharedPages,
    roleOf,
    untouchedBootstrap,
    forget,
    bootstrap,
    pageTree,
    getBlock,
    loadPageBlocks,
    childPages,
    pagePath,
    openPage,
    createPage,
    renamePage,
    setPageIcon,
    setPageAlive,
    trashedPages,
    search,
  };
}

export type Workspace = ReturnType<typeof createWorkspace>;
