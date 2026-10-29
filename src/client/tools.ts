// The note tools an assistant gets: list, read, search, create, write, rename, group, move and
// trash pages. The server's AI connection (MCP) and the desktop Claude panel both run these
// against a Lumen client, so an assistant's edits are ordinary ops like any other.

import { pageToMarkdown } from "../export/markdown";
import type { Lumen } from "./index";
import { isGroup, pageTitle, type PageNode } from "./workspace";

export interface NoteTool {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: readonly string[] };
  /** Changes notes (the caller may want to sync afterwards). */
  writes: boolean;
}

export const NOTE_TOOLS: readonly NoteTool[] = [
  {
    name: "list_pages",
    description: "Lists every page the person can see, as an indented outline with ids: their workspaces (groups marked [group]) and pages shared with them.",
    inputSchema: { type: "object", properties: {} },
    writes: false,
  },
  {
    name: "read_page",
    description: "Reads a page as Markdown, with the titles and ids of the pages inside it.",
    inputSchema: { type: "object", properties: { page_id: { type: "string" } }, required: ["page_id"] },
    writes: false,
  },
  {
    name: "search",
    description: "Full-text search over every page. Returns matching pages with a snippet.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    writes: false,
  },
  {
    name: "create_page",
    description: "Creates a page, optionally inside another page or a group (parent_id), with Markdown content.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" }, markdown: { type: "string" }, parent_id: { type: "string", description: "A page or group id; omit for the top level." } },
      required: ["title"],
    },
    writes: true,
  },
  {
    name: "write_page",
    description: "Adds Markdown to the end of a page (mode \"append\", the default) or replaces its text (mode \"replace\"; pages inside it are kept).",
    inputSchema: {
      type: "object",
      properties: { page_id: { type: "string" }, markdown: { type: "string" }, mode: { type: "string", enum: ["append", "replace"] } },
      required: ["page_id", "markdown"],
    },
    writes: true,
  },
  {
    name: "rename_page",
    description: "Changes a page's or group's title.",
    inputSchema: { type: "object", properties: { page_id: { type: "string" }, title: { type: "string" } }, required: ["page_id", "title"] },
    writes: true,
  },
  {
    name: "create_group",
    description: "Creates a group: a sidebar section that holds pages (for sorting). Returns its id.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    writes: true,
  },
  {
    name: "move_page",
    description: "Moves a page into another page or a group (to_id), or to the top level (to_id null). Use it to sort and organise.",
    inputSchema: { type: "object", properties: { page_id: { type: "string" }, to_id: { type: ["string", "null"] } }, required: ["page_id", "to_id"] },
    writes: true,
  },
  {
    name: "trash_page",
    description: "Moves a page to the trash (it can be restored from the app).",
    inputSchema: { type: "object", properties: { page_id: { type: "string" } }, required: ["page_id"] },
    writes: true,
  },
];

type Args = Record<string, unknown>;
const str = (args: Args, key: string) => {
  const v = args[key];
  if (typeof v !== "string" || !v) throw new Error(`"${key}" is required.`);
  return v;
};

const outline = (nodes: PageNode[], depth = 0): string[] =>
  nodes.flatMap((n) => [`${"  ".repeat(depth)}- ${pageTitle(n.page)}${isGroup(n.page) ? " [group]" : ""} (id: ${n.page.id})`, ...outline(n.children, depth + 1)]);

/** Runs one note tool and returns its text result. Throws with a readable message on bad input. */
export async function runNoteTool(lumen: Lumen, name: string, args: Args): Promise<string> {
  const space = await lumen.getSpace();
  switch (name) {
    case "list_pages": {
      const lines: string[] = [];
      for (const s of await lumen.listSpaces()) lines.push(`Workspace "${s.space.name}" (${s.role})`, ...outline(await lumen.pageTree(s.space), 1));
      const shared = await lumen.sharedPages();
      if (shared.length) lines.push("Shared with them", ...shared.map((p) => `  - ${pageTitle(p.page)} (id: ${p.page.id}, ${p.role})`));
      return lines.join("\n") || "No pages yet.";
    }
    case "read_page": {
      const page = await lumen.getBlock(str(args, "page_id"));
      if (!page?.alive) throw new Error("No such page.");
      const children = await lumen.childPages(page.id);
      const md = pageToMarkdown(page, await lumen.loadPageBlocks(page.id));
      const inside = children.length ? `\n\nPages inside:\n${children.map((c) => `- ${pageTitle(c)} (id: ${c.id})`).join("\n")}` : "";
      return md + inside;
    }
    case "search": {
      const hits = await lumen.search(str(args, "query"));
      if (!hits.length) return "Nothing found.";
      const lines = await Promise.all(hits.map(async (h) => `- ${pageTitle((await lumen.getBlock(h.pageId))!)} (id: ${h.pageId}): ${h.snippet.slice(0, 200)}`));
      return lines.join("\n");
    }
    case "create_page": {
      if (!space) throw new Error("No workspace to create pages in.");
      const parent = typeof args.parent_id === "string" && args.parent_id ? args.parent_id : null;
      const target = parent ? await lumen.getBlock(parent) : undefined;
      const id = await lumen.createPage(target ? ({ id: target.space_id } as never) : space, parent);
      await lumen.renamePage(id, str(args, "title"));
      if (typeof args.markdown === "string" && args.markdown.trim()) await lumen.writeMarkdown(id, args.markdown);
      return `Created "${args.title}" (id: ${id}).`;
    }
    case "write_page": {
      const mode = args.mode === "replace" ? "replace" : "append";
      await lumen.writeMarkdown(str(args, "page_id"), str(args, "markdown"), mode);
      return mode === "replace" ? "Replaced the page's text." : "Added to the page.";
    }
    case "rename_page":
      await lumen.renamePage(str(args, "page_id"), str(args, "title"));
      return "Renamed.";
    case "create_group": {
      if (!space) throw new Error("No workspace to create groups in.");
      const id = await lumen.createGroup(space, str(args, "name"));
      return `Created group "${args.name}" (id: ${id}).`;
    }
    case "move_page": {
      const to = typeof args.to_id === "string" && args.to_id ? args.to_id : null;
      await lumen.movePage(str(args, "page_id"), to);
      return "Moved.";
    }
    case "trash_page":
      await lumen.setPageAlive(str(args, "page_id"), false);
      return "Moved to the trash.";
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
