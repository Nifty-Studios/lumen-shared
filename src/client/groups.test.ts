import { describe, expect, it } from "vitest";
import { createLumen, isGroup, pageTitle } from "./index";
import { nodeDriver } from "./test-driver";

describe("groups and moving pages", () => {
  it("moves pages into groups and pages, never into themselves", async () => {
    const lumen = createLumen(nodeDriver());
    await lumen.start();
    const space = async () => (await lumen.getSpace())!;
    const work = await lumen.createGroup(await space(), "Work");
    const notes = await lumen.createPage(await space(), null);
    await lumen.renamePage(notes, "Meeting notes");
    const child = await lumen.createPage(await space(), notes);

    await lumen.movePage(notes, work);
    const tree = await lumen.pageTree(await space());
    const group = tree.find((n) => n.page.id === work)!;
    expect(isGroup(group.page)).toBe(true);
    expect(pageTitle(group.page)).toBe("Work");
    expect(group.children.map((n) => pageTitle(n.page))).toEqual(["Meeting notes"]);
    expect(tree.map((n) => n.page.id)).not.toContain(notes);

    await expect(lumen.movePage(notes, child)).rejects.toThrow(/inside itself/);
    await lumen.movePage(notes, null);
    expect((await lumen.pageTree(await space())).map((n) => n.page.id).at(-1)).toBe(notes);
    expect((await lumen.getBlock(work))!.content).toEqual([]);
  });
});

describe("writing Markdown into a page", () => {
  it("appends and replaces text, keeping sub-pages", async () => {
    const lumen = createLumen(nodeDriver());
    await lumen.start();
    const space = (await lumen.getSpace())!;
    const id = await lumen.createPage(space, null);
    const sub = await lumen.createPage(space, id);
    await lumen.writeMarkdown(id, "# Plan\n\n- [ ] book flights\n- [x] pack");
    await lumen.writeMarkdown(id, "One more line");
    const texts = async () => {
      const blocks = await lumen.loadPageBlocks(id);
      return (await lumen.getBlock(id))!.content.map((c) => (c === sub ? "<sub-page>" : `${blocks.get(c)?.type}:${blocks.get(c)?.properties.title?.[0]?.text}`));
    };
    expect(await texts()).toEqual(["header:Plan", "to_do:book flights", "to_do:pack", "text:One more line", "<sub-page>"]);
    await lumen.writeMarkdown(id, "Fresh start", "replace");
    expect(await texts()).toEqual(["text:Fresh start", "<sub-page>"]);
  });
});
