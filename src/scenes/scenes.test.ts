import { describe, expect, it } from "vitest";
import { computeSky, themeFor } from "../ambient";
import { SCENES, sceneBackdrop, sceneCorner, sceneLook, sceneOf, sceneOverhead, type SceneLook } from "./index";

const at = (envTime: "day" | "night", envWeather: "clear" | "rain" | "snow", dark: boolean, animated = true): SceneLook => {
  const sky = computeSky({ envTime, envWeather });
  return sceneLook(sky, themeFor(sky, dark), animated);
};

const drawings = (look: SceneLook) =>
  SCENES.flatMap((s) => [sceneCorner(s.id, look), sceneOverhead(s.id, look, 1200), sceneOverhead(s.id, look, 400), sceneBackdrop(s.id, look)]);

/** Every opened element is closed, in order. */
function balanced(svg: string) {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)((?:"[^"]*"|[^">])*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}

describe("scenes", () => {
  it("draws well-formed SVG in every light and weather", () => {
    for (const look of [at("day", "clear", false), at("night", "clear", true), at("day", "snow", false), at("night", "rain", true), at("day", "rain", true, false)]) {
      for (const art of drawings(look)) {
        expect(art.svg.startsWith("<svg ")).toBe(true);
        expect(balanced(art.svg)).toBe(true);
        expect(art.svg).not.toMatch(/NaN|undefined|Infinity/);
        expect(art.width).toBeGreaterThan(0);
      }
    }
  });

  it("carries animation classes only when animated", () => {
    for (const art of drawings(at("night", "clear", true, false))) expect(art.svg).not.toMatch(/class=|style=/);
    expect(sceneCorner("forest", at("night", "clear", true)).svg).toMatch(/class="lm-/);
  });

  it("answers to the weather and the hour", () => {
    for (const s of SCENES) {
      const day = sceneCorner(s.id, at("day", "clear", false)).svg;
      expect(sceneCorner(s.id, at("night", "clear", false)).svg).not.toBe(day);
    }
    expect(sceneCorner("forest", at("day", "snow", false, false)).svg).not.toBe(sceneCorner("forest", at("day", "clear", false, false)).svg);
    expect(sceneCorner("workstation", at("day", "rain", false, false)).svg.length).toBeGreaterThan(sceneCorner("workstation", at("day", "clear", false, false)).svg.length);
    // Fireflies only come out after dark.
    expect(sceneCorner("forest", at("day", "clear", false)).svg).not.toMatch(/lm-firefly/);
    expect(sceneCorner("forest", at("night", "clear", false)).svg).toMatch(/lm-firefly/);
  });

  it("gives every gradient its own id", () => {
    const ids = [...drawings(at("night", "clear", true)).map((a) => a.svg).join("").matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tints the sky and sets the accent, unless one was picked", () => {
    const sky = computeSky({ envTime: "day", envWeather: "clear" });
    const forest = sceneOf("forest")!;
    const plain = themeFor(sky, false);
    const themed = themeFor(sky, false, null, null, forest);
    expect(themed.accent).toBe(forest.accent[0]);
    expect(themed.skyTop).not.toBe(plain.skyTop);
    expect(themeFor(sky, false, "#d14343", null, forest).accent).toBe(themeFor(sky, false, "#d14343").accent);
    expect(sceneOf(null)).toBeUndefined();
  });
});
