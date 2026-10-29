// The slash menu's items, grouped and in a fixed order. Apps render them with their own
// menu component; icons are names from icons/data.ts.

import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu, type BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import type { IconName } from "../icons";

export interface SlashItem {
  key: string;
  title: string;
  subtext: string;
  group: "Basic" | "Lists" | "Blocks";
  icon: IconName;
  /** Markdown-style shortcut that also creates this block, shown as a hint. */
  shortcut?: string;
  aliases: string[];
  onItemClick: () => void;
}

type Def = Omit<SlashItem, "onItemClick"> & { block: PartialBlock<any, any, any> };

const DEFS: Def[] = [
  { key: "text", title: "Text", subtext: "Plain writing", group: "Basic", icon: "pilcrow", aliases: ["paragraph", "p", "plain"], block: { type: "paragraph" } },
  { key: "h1", title: "Heading 1", subtext: "Big section title", group: "Basic", icon: "heading-1", shortcut: "#", aliases: ["h1", "title", "big"], block: { type: "heading", props: { level: 1 } } },
  { key: "h2", title: "Heading 2", subtext: "Medium section title", group: "Basic", icon: "heading-2", shortcut: "##", aliases: ["h2", "subtitle"], block: { type: "heading", props: { level: 2 } } },
  { key: "h3", title: "Heading 3", subtext: "Small section title", group: "Basic", icon: "heading-3", shortcut: "###", aliases: ["h3", "small"], block: { type: "heading", props: { level: 3 } } },
  { key: "bullet", title: "Bulleted list", subtext: "A simple list", group: "Lists", icon: "list", shortcut: "-", aliases: ["ul", "bullet", "unordered", "points"], block: { type: "bulletListItem" } },
  { key: "numbered", title: "Numbered list", subtext: "A list in order", group: "Lists", icon: "list-ordered", shortcut: "1.", aliases: ["ol", "ordered", "numbers", "steps"], block: { type: "numberedListItem" } },
  { key: "todo", title: "To-do list", subtext: "Tasks with checkboxes", group: "Lists", icon: "list-checks", shortcut: "[]", aliases: ["todo", "task", "checkbox", "check"], block: { type: "checkListItem" } },
  { key: "toggle", title: "Toggle list", subtext: "Hide details inside", group: "Lists", icon: "list-collapse", aliases: ["collapse", "details", "fold", "dropdown"], block: { type: "toggleListItem" } },
  { key: "quote", title: "Quote", subtext: "Set a passage apart", group: "Blocks", icon: "text-quote", shortcut: ">", aliases: ["blockquote", "citation"], block: { type: "quote" } },
  { key: "callout", title: "Callout", subtext: "A highlighted note with an icon", group: "Blocks", icon: "message-square-text", aliases: ["note", "tip", "info", "aside", "warning", "highlight"], block: { type: "callout" } },
  { key: "code", title: "Code", subtext: "A monospaced snippet", group: "Blocks", icon: "code-xml", shortcut: "```", aliases: ["snippet", "pre", "codeblock"], block: { type: "codeBlock" } },
  { key: "divider", title: "Divider", subtext: "A quiet line between ideas", group: "Blocks", icon: "separator-horizontal", shortcut: "---", aliases: ["hr", "line", "separator", "rule"], block: { type: "divider" } },
  { key: "image", title: "Image", subtext: "Add a picture", group: "Blocks", icon: "image", aliases: ["img", "picture", "photo"], block: { type: "image" } },
];

export function slashItems(editor: BlockNoteEditor<any, any, any>): SlashItem[] {
  return DEFS.map(({ block, ...item }) => ({ ...item, onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, block) }));
}

/** The items matching what was typed after "/". */
export const filterSlashItems = (items: SlashItem[], query: string): SlashItem[] => filterSuggestionItems(items, query);
