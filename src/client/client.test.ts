import { describe, expect, it } from "vitest";
import { createLumen, pageTitle } from "./index";
import { nodeDriver } from "./test-driver";

describe("local client", () => {
  it("bootstraps a workspace, edits pages and searches them", async () => {
    const lumen = createLumen(nodeDriver());
    expect(await lumen.start()).toEqual({ needsAuth: false }); // no server configured: no sign-in
    const space = (await lumen.getSpace())!;
    expect(space.name).toBe("My workspace");

    const tree = await lumen.pageTree(space);
    expect(tree.map((n) => pageTitle(n.page))).toEqual(["Welcome to Lumen"]);

    const id = await lumen.createPage((await lumen.getSpace())!, null);
    await lumen.renamePage(id, "Groceries");
    await (await lumen.openPage(id)).save([
      { id: "b1", type: "paragraph", props: {}, content: [{ type: "text", text: "oat milk and bread", styles: {} }], children: [] },
    ] as never);

    const hits = await lumen.search("bre");
    expect(hits.map((h) => h.pageId)).toEqual([id]);

    await lumen.setPageAlive(id, false);
    expect((await lumen.trashedPages()).map((p) => p.id)).toEqual([id]);
    expect(await lumen.search("bread")).toEqual([]);
    expect(lumen.store.deviceId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
