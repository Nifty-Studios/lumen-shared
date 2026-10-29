import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createLumen, pageTitle, type Lumen, type PageNode } from "./index";
import { nodeDriver } from "./test-driver";
import { plainText } from "../text";

const titles = (nodes: PageNode[]): unknown[] =>
  nodes.map((n) => (n.children.length ? [pageTitle(n.page), titles(n.children)] : pageTitle(n.page)));

async function tree(lumen: Lumen) {
  return titles(await lumen.pageTree((await lumen.getSpace())!));
}

// A tiny Notion "Markdown & CSV" export, nested inside an outer zip the way Notion ships it.
function notionExport() {
  const id = (n: number) => String(n).padStart(32, "a");
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const inner = zipSync({
    [`Journal ${id(1)}.md`]: strToU8(
      `# Journal\n\nToday was **good**.\n\n<aside>\n🔥 Keep going\n</aside>\n\n![sunset](Journal%20${id(1)}/sunset.png)\n\n[Trip](Journal%20${id(1)}/Trip%20${id(2)}.md)\n\n[Books](Journal%20${id(1)}/Books%20${id(3)}.csv)`,
    ),
    [`Journal ${id(1)}/sunset.png`]: png,
    [`Journal ${id(1)}/Trip ${id(2)}.md`]: strToU8("# Trip\n\n- [x] Pack\n- [ ] Fly"),
    [`Journal ${id(1)}/Books ${id(3)}.csv`]: strToU8("﻿Name,Author,Done\nDune,Herbert,Yes\nEmma,Austen,No\n"),
    [`Journal ${id(1)}/Books ${id(3)}_all.csv`]: strToU8("﻿Name,Author,Done\nDune,Herbert,Yes\nEmma,Austen,No\n"),
    [`Journal ${id(1)}/Books ${id(3)}/Dune ${id(4)}.md`]: strToU8("# Dune\n\nAuthor: Herbert\nDone: Yes\n\nSpice."),
    [`Ideas ${id(5)}.md`]: strToU8("# Ideas\n\n1. One\n2. Two"),
  });
  return zipSync({ "Export-123-Part-1.zip": inner });
}

describe("Notion import", () => {
  it("imports pages, sub-pages, databases and images, and skips them the second time", async () => {
    const lumen = createLumen(nodeDriver());
    await lumen.start();
    const progress: number[] = [];
    const summary = await lumen.importNotion(notionExport(), { onProgress: (d) => progress.push(d) });
    expect(summary).toMatchObject({ pages: 6, images: 1, databases: 1, skipped: 0 });
    expect(progress.at(-1)).toBe(6);
    expect(await tree(lumen)).toEqual(["Welcome to Lumen", "Ideas", ["Journal", ["Trip", ["Books", ["Dune", "Emma"]]]]]);

    const space = (await lumen.getSpace())!;
    const journal = (await lumen.pageTree(space))[2]!.page;
    const blocks = [...(await lumen.loadPageBlocks(journal.id)).values()];
    expect(blocks.map((b) => b.type)).toEqual(expect.arrayContaining(["text", "callout", "image"]));
    expect(blocks.find((b) => b.type === "callout")!.format.callout_icon).toEqual({ type: "icon", name: "flame" });
    expect(String(blocks.find((b) => b.type === "image")!.properties.source)).toMatch(/^data:image\/png;base64,iVBORw0KGgo=/);

    const dune = (await lumen.search("Spice"))[0]!;
    const duneBlocks = [...(await lumen.loadPageBlocks(dune.pageId)).values()];
    expect(duneBlocks.some((b) => plainText(b.properties.title) === "Author: Herbert")).toBe(true);

    const again = await lumen.importNotion(notionExport());
    expect(again).toMatchObject({ pages: 0, skipped: 6 });
    expect(await tree(lumen)).toEqual(["Welcome to Lumen", "Ideas", ["Journal", ["Trip", ["Books", ["Dune", "Emma"]]]]]);
  });

  it("explains when the zip has no pages", async () => {
    const lumen = createLumen(nodeDriver());
    await lumen.start();
    const summary = await lumen.importNotion(zipSync({ "photo.jpg": new Uint8Array([1]) }));
    expect(summary.pages).toBe(0);
    expect(summary.warnings[0]).toMatch(/Markdown & CSV/);
  });
});

describe("backup", () => {
  it("restores a workspace on a fresh device, history included, and merges idempotently", async () => {
    const a = createLumen(nodeDriver());
    await a.start();
    const space = (await a.getSpace())!;
    const id = await a.createPage(space, null);
    await a.renamePage(id, "Recipes");
    await (await a.openPage(id)).save([
      { id: "b1", type: "paragraph", props: {}, content: [{ type: "text", text: "jollof rice", styles: { bold: true } }], children: [] },
    ] as never);
    const child = await a.createPage((await a.getSpace())!, id);
    await a.renamePage(child, "Soups");

    const backup = await a.exportBackup();
    expect(backup.fileName).toMatch(/^lumen-backup-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/);
    const files = unzipSync(backup.bytes);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["ops.jsonl", "README.txt", "lumen-backup.json", "pages/Recipes.md", "pages/Recipes/Soups.md"]));
    expect(strFromU8(files["pages/Recipes.md"]!)).toContain("**jollof rice**");
    expect(strFromU8(files["pages/Recipes.md"]!)).toContain("[Soups](Recipes/Soups.md)");

    // A brand-new device restores it offline.
    const b = createLumen(nodeDriver());
    await b.start();
    const restored = await b.restoreBackup(backup.bytes);
    expect(restored.ops).toBe(backup.manifest.ops);
    expect(await tree(b)).toEqual(["Welcome to Lumen", ["Recipes", ["Soups"]]]);
    expect((await b.search("jollof")).length).toBe(1);

    // Restoring twice changes nothing.
    await b.restoreBackup(backup.bytes);
    expect(await tree(b)).toEqual(["Welcome to Lumen", ["Recipes", ["Soups"]]]);

    // Edits after a restore win over the restored history.
    await b.renamePage(id, "Family recipes");
    expect((await tree(b))[1]).toEqual(["Family recipes", ["Soups"]]);
  });

  it("rejects things that aren't backups, and points Notion exports to the importer", async () => {
    const lumen = createLumen(nodeDriver());
    await lumen.start();
    await expect(lumen.restoreBackup(new Uint8Array([1, 2, 3]))).rejects.toThrow(/isn't a zip/);
    await expect(lumen.restoreBackup(notionExport())).rejects.toThrow(/Notion export/);
  });
});

describe("settings", () => {
  it("are device-local and survive a reload", async () => {
    const driver = nodeDriver();
    const a = createLumen(driver);
    await a.start();
    expect(a.getSettings().envTime).toBe("live");
    const seen: string[] = [];
    a.onSettings((s) => seen.push(s.theme));
    await a.updateSettings({ theme: "dark", envTime: "night", envWeather: "rain" });
    expect(seen).toEqual(["dark"]);
    const again = createLumen(driver);
    await again.start();
    expect(again.getSettings()).toMatchObject({ theme: "dark", envTime: "night", envWeather: "rain", liveWeather: true });
  });
});
