import { describe, expect, it } from "vitest";
import { themeFor, computeSky } from "../ambient";
import { loadSpellchecker, defaultSpelling } from "../spell";
import { eq } from "drizzle-orm";
import { meta } from "../schema/client";
import { createLumen } from "./index";
import { nodeDriver } from "./test-driver";

describe("what's new", () => {
  it("stays quiet on a fresh install, shows once after an update, and goes when dismissed", async () => {
    const fresh = createLumen(nodeDriver());
    await fresh.start();
    await fresh.continueSignedOut();
    expect(await fresh.whatsNew("1.2.0")).toBeUndefined();

    // A device from before this card: notes, but nothing recorded.
    const updated = createLumen(nodeDriver());
    await updated.start();
    await updated.continueSignedOut();
    await updated.db.delete(meta).where(eq(meta.key, "whats_new"));
    expect((await updated.whatsNew("1.2.0"))?.version).toBe("1.2.0");
    expect((await updated.whatsNew("1.2.0"))?.version).toBe("1.2.0"); // until dismissed
    await updated.dismissWhatsNew("1.2.0");
    expect(await updated.whatsNew("1.2.0")).toBeUndefined();
    expect(await updated.whatsNew("1.2.1")).toBeUndefined(); // no notes for that version
  });
});

describe("accent colors", () => {
  it("uses a picked accent, tuned for each mode, and the sky's otherwise", () => {
    const sky = computeSky({ location: null, envTime: "day", envWeather: "clear" });
    const own = themeFor(sky, false, "#d14343");
    expect(own.accent).toBe("#d14343");
    expect(own.accentText).toBe("#ffffff");
    const dark = themeFor(sky, true, "#2f7bd6");
    expect(dark.accent).not.toBe("#2f7bd6"); // brightened for dark glass
    expect(dark.accentText).toBe("#14131a");
    expect(themeFor(sky, false, "not a color").accent).toBe(themeFor(sky, false).accent);
  });
});

describe("spellchecker", () => {
  it("checks British or American English and accepts the person's words", async () => {
    const gb = await loadSpellchecker("en-GB");
    expect(gb.misspelled(["favourite", "colour", "recieve", "Syphry", "well-known"])).toEqual(["recieve", "Syphry"]);
    gb.setPersonal(["Syphry"]);
    expect(gb.misspelled(["Syphry", "syphry"])).toEqual(["syphry"]);
    expect(gb.suggest("recieve")).toContain("receive");
    const us = await loadSpellchecker("en-US");
    expect(us.misspelled(["favourite", "color"])).toEqual(["favourite"]);
    expect(defaultSpelling("en-US")).toBe("en-US");
    expect(defaultSpelling("en-NG")).toBe("en-GB");
  }, 20_000);
});
