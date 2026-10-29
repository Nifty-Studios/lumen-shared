import { describe, expect, it } from "vitest";
import { localLinks, parseInline, parseMarkdown } from "./markdown";
import { richTextToMarkdown } from "../export/markdown";

describe("inline markdown", () => {
  it("reads marks and links", () => {
    expect(parseInline("plain **bold** and _it_ with `code` and ~~gone~~")).toEqual([
      { text: "plain " },
      { text: "bold", marks: [{ type: "bold" }] },
      { text: " and " },
      { text: "it", marks: [{ type: "italic" }] },
      { text: " with " },
      { text: "code", marks: [{ type: "code" }] },
      { text: " and " },
      { text: "gone", marks: [{ type: "strike" }] },
    ]);
    expect(parseInline("see [**docs**](https://x.dev) now")).toEqual([
      { text: "see " },
      { text: "docs", marks: [{ type: "link", value: "https://x.dev" }, { type: "bold" }] },
      { text: " now" },
    ]);
  });

  it("leaves snake_case, escapes and lonely stars alone", () => {
    expect(parseInline("my_var_name and 2 * 3")).toEqual([{ text: "my_var_name and 2 * 3" }]);
    expect(parseInline("\\*not italic\\*")).toEqual([{ text: "*not italic*" }]);
  });

  it("keeps the text of links to other pages, without the link", () => {
    expect(parseInline("[Child](Child%20abc.md)")).toEqual([{ text: "Child" }]);
    expect(localLinks("a [x](Sub%20Page%20123.md) b [y](https://e.com) [z](img/p.png)")).toEqual(["Sub Page 123.md", "img/p.png"]);
  });

  it("round-trips through the Markdown exporter", () => {
    const rt = parseInline("a **b** _c_ `d` [e](https://e.com)");
    expect(parseInline(richTextToMarkdown(rt))).toEqual(rt);
  });
});

describe("block markdown", () => {
  it("reads Notion's export dialect", () => {
    const md = [
      "## Plan",
      "",
      "First line",
      "second line",
      "",
      "- [ ] buy milk",
      "- [x] call mum",
      "- parent",
      "    - child",
      "        1. deep",
      "",
      "> quoted",
      "",
      "<aside>",
      "💡 Remember this",
      "",
      "</aside>",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "",
      "---",
      "",
      "![Diagram](Plan%20abc/diagram.png)",
      "",
      "| Name | Qty |",
      "| --- | --- |",
      "| Eggs | 12 |",
      "",
      "<details>",
      "<summary>More</summary>",
      "",
      "Hidden text",
      "",
      "</details>",
      "",
      "$$",
      "e = mc^2",
      "$$",
    ].join("\n");
    const blocks = parseMarkdown(md);
    expect(blocks.map((b) => b.type)).toEqual([
      "sub_header", "text", "to_do", "to_do", "bulleted_list", "quote", "callout", "code", "divider", "image", "text", "text", "toggle", "code",
    ]);
    expect(blocks[1]!.title).toEqual([{ text: "First line\nsecond line" }]);
    expect(blocks[2]!.checked).toBe(false);
    expect(blocks[3]!.checked).toBe(true);
    expect(blocks[4]!.children[0]!.type).toBe("bulleted_list");
    expect(blocks[4]!.children[0]!.children[0]!.type).toBe("numbered_list");
    expect(blocks[6]).toMatchObject({ type: "callout", emoji: "💡", title: [{ text: "Remember this" }] });
    expect(blocks[7]).toMatchObject({ language: "ts", title: [{ text: "const a = 1;" }] });
    expect(blocks[9]).toMatchObject({ src: "Plan%20abc/diagram.png", caption: "Diagram" });
    expect(blocks[12]).toMatchObject({ type: "toggle", title: [{ text: "More" }] });
    expect(blocks[12]!.children[0]!.title).toEqual([{ text: "Hidden text" }]);
    expect(blocks[13]).toMatchObject({ language: "latex", title: [{ text: "e = mc^2" }] });
  });
});
