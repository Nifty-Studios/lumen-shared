import { describe, expect, it } from "vitest";
import { computeSky, themeFor } from "../ambient";
import { SCENES, sceneBackdrop, sceneCorner, sceneCrest, sceneFloor, sceneLook, sceneOf, sceneOverhead, scenePerch, sceneRail, seasonAt, type SceneLook } from "./index";

const at = (envTime: "day" | "night", envWeather: "clear" | "rain" | "snow" | "storm", dark: boolean, animated = true, celebration: string | null = null): SceneLook => {
  const sky = computeSky({ envTime, envWeather });
  return sceneLook(sky, themeFor(sky, dark), animated, { celebration });
};

const drawings = (look: SceneLook) =>
  SCENES.flatMap((s) => [
    sceneCorner(s.id, look),
    sceneOverhead(s.id, look, 1200),
    sceneOverhead(s.id, look, 400),
    sceneBackdrop(s.id, look),
    sceneCrest(s.id, look),
    sceneRail(s.id, look, 420),
    sceneRail(s.id, look, 1100),
    sceneFloor(s.id, look, 320),
    sceneFloor(s.id, look, 1500),
    scenePerch(s.id, look),
  ]);

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
    const looks = [at("day", "clear", false), at("night", "clear", true), at("day", "snow", false), at("night", "rain", true), at("day", "rain", true, false), at("night", "storm", false)];
    for (const day of ["christmas", "birthday", "halloween", "valentine", "easter", "new-year"]) looks.push(at("day", "clear", false, true, day), at("night", "snow", true, false, day));
    for (const season of ["spring", "autumn", "winter"] as const) looks.push({ ...at("day", "clear", false), season });
    for (const look of looks) {
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

  it("brings the day, the season and the weather into every theme", () => {
    const plain = at("day", "clear", false, false);
    for (const s of SCENES) {
      expect(sceneRail(s.id, at("day", "clear", false, false, "christmas"), 800).svg).not.toBe(sceneRail(s.id, plain, 800).svg);
      expect(sceneRail(s.id, at("day", "rain", false, false), 800).svg).not.toBe(sceneRail(s.id, plain, 800).svg);
    }
    expect(sceneRail("forest", { ...plain, season: "autumn" }, 800).svg).not.toBe(sceneRail("forest", plain, 800).svg);
    // The diner's board follows the weather; the desk calendar shows the date.
    expect(sceneRail("restaurant", at("day", "rain", false, false), 800).svg).toContain("RAMEN");
    expect(sceneRail("workstation", { ...plain, day: 23, month: 4 }, 900).svg).toMatch(/>MAY<[\s\S]*>23</);
    // Things to poke are marked only where they can be poked.
    expect(sceneRail("workstation", at("day", "clear", false), 800).svg).toMatch(/data-poke="light"/);
    expect(sceneRail("workstation", plain, 800).svg).not.toMatch(/data-poke/);
  });

  it("knows the season by hemisphere, and that the tropics have none", () => {
    const november = new Date(2026, 10, 14).getTime();
    expect(seasonAt(november, 51)).toBe("autumn");
    expect(seasonAt(november, -34)).toBe("spring");
    expect(seasonAt(november, 6)).toBe("summer");
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
