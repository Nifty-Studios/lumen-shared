import { describe, expect, it } from "vitest";
import type { Op } from "../ops";
import { pullQuerySchema, pushRequestSchema } from "../sync";
import { createLumen, pageTitle } from "./index";
import { nodeDriver } from "./test-driver";

/** In-memory stand-in for lumen-server: same endpoints, auth and cursor rules. */
function fakeServer(token: string) {
  const log: (Op & { seq: number })[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (new Headers(init?.headers).get("authorization") !== `Bearer ${token}`) return new Response("", { status: 401 });
    if (url.pathname === "/sync/push") {
      const { ops } = pushRequestSchema.parse(JSON.parse(String(init?.body)));
      let accepted = 0;
      for (const op of ops)
        if (!log.some((o) => o.id === op.id)) {
          log.push({ ...(op as Op), seq: log.length + 1 });
          accepted++;
        }
      return Response.json({ accepted });
    }
    const q = pullQuerySchema.parse(Object.fromEntries(url.searchParams));
    const page = log.filter((o) => o.seq > q.since).slice(0, q.limit);
    return Response.json({
      ops: page.filter((o) => o.device_id !== q.device_id).map(({ seq: _, ...op }) => op),
      cursor: page.at(-1)?.seq ?? q.since,
      has_more: log.some((o) => o.seq > (page.at(-1)?.seq ?? q.since)) && page.length === q.limit,
    });
  };
  return { fetch: fetch as typeof globalThis.fetch, log };
}

const titles = async (lumen: ReturnType<typeof createLumen>) =>
  (await lumen.pageTree((await lumen.getSpace())!)).map((n) => pageTitle(n.page));

describe("sync client", () => {
  it("lets a new device join the workspace and keeps both in step", async () => {
    const server = fakeServer("secret");
    const sync = { url: "https://sync.test/", token: "secret", fetch: server.fetch };

    const desktop = createLumen(nodeDriver(), { sync });
    const space = await desktop.start();
    const id = await desktop.createPage(space, null);
    await desktop.renamePage(id, "Plans");
    await desktop.sync!.sync();

    // A fresh phone pulls before bootstrapping, so it gets the same space and no extra welcome page.
    const phone = createLumen(nodeDriver(), { sync });
    expect((await phone.start()).id).toBe(space.id);
    expect(await titles(phone)).toEqual(["Welcome to Lumen", "Plans"]);

    // Concurrent edits to one field: the later HLC wins on both devices.
    await desktop.renamePage(id, "Plans (desktop)");
    await new Promise((r) => setTimeout(r, 2));
    await phone.renamePage(id, "Plans (phone)");
    await desktop.sync!.sync();
    await phone.sync!.sync();
    await desktop.sync!.sync();
    expect(await titles(desktop)).toEqual(["Welcome to Lumen", "Plans (phone)"]);
    expect(await titles(phone)).toEqual(["Welcome to Lumen", "Plans (phone)"]);

    // Nothing left to push, and the server never stored an op twice.
    const before = server.log.length;
    await phone.sync!.sync();
    expect(server.log.length).toBe(before);
    expect(new Set(server.log.map((o) => o.id)).size).toBe(server.log.length);
    expect(phone.sync!.current.state).toBe("idle");
  });

  it("reports a bad token as an error and keeps ops for later", async () => {
    const server = fakeServer("secret");
    const lumen = createLumen(nodeDriver(), { sync: { url: "https://sync.test", token: "wrong", fetch: server.fetch } });
    await lumen.start();
    await expect(lumen.sync!.sync()).rejects.toThrow(/401/);
    expect(lumen.sync!.current.state).toBe("error");
    expect(server.log).toEqual([]);
  });
});
