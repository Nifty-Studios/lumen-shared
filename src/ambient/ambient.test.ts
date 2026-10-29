import { describe, expect, it } from "vitest";
import { hex, luminance } from "./color";
import { moonLitPath, moonPhase, sunPosition, sunTimes } from "./astro";
import { computeSky } from "./sky";
import { themeFor } from "./theme";
import { describeWeather } from "./weather";
import { MOODS } from "./environment";

const LAGOS = { lat: 6.5244, lon: 3.3792, label: "Lagos", source: "city" as const };
const LONDON = { lat: 51.5072, lon: -0.1276, label: "London", source: "city" as const };
const at = (iso: string) => new Date(iso).getTime();
const minutes = (ms: number) => Math.round(ms / 60_000);

describe("sun and moon", () => {
  it("puts sunrise and sunset in Lagos at the right times", () => {
    // Lagos, 29 Oct 2026: sunrise ~06:33 WAT (05:33Z), sunset ~18:27 WAT (17:27Z).
    const t = sunTimes(at("2026-10-29T12:00:00Z"), LAGOS.lat, LAGOS.lon);
    expect(Math.abs(minutes(t.sunrise! - at("2026-10-29T05:33:00Z")))).toBeLessThan(8);
    expect(Math.abs(minutes(t.sunset! - at("2026-10-29T17:27:00Z")))).toBeLessThan(8);
  });

  it("knows London's short winter day", () => {
    const t = sunTimes(at("2026-12-21T12:00:00Z"), LONDON.lat, LONDON.lon);
    expect(Math.abs(minutes(t.sunrise! - at("2026-12-21T08:04:00Z")))).toBeLessThan(8);
    expect(Math.abs(minutes(t.sunset! - at("2026-12-21T15:54:00Z")))).toBeLessThan(8);
  });

  it("has the sun high at noon and below the horizon at midnight", () => {
    expect(sunPosition(at("2026-10-29T11:40:00Z"), LAGOS.lat, LAGOS.lon).altitude).toBeGreaterThan(65);
    expect(sunPosition(at("2026-10-29T23:40:00Z"), LAGOS.lat, LAGOS.lon).altitude).toBeLessThan(-60);
  });

  it("tracks the moon's phase", () => {
    // Full moon on 2026-10-26 04:12Z, new moon on 2026-11-09 07:02Z.
    expect(moonPhase(at("2026-10-26T04:12:00Z")).illumination).toBeGreaterThan(0.99);
    expect(moonPhase(at("2026-11-09T07:02:00Z")).illumination).toBeLessThan(0.01);
    expect(moonLitPath(0.25)).toMatch(/^M 0 -1 A 1 1 0 0 1 0 1/);
  });
});

describe("sky", () => {
  it("follows the real sun when live", () => {
    const noon = computeSky({ now: at("2026-10-29T11:40:00Z"), location: LAGOS });
    const night = computeSky({ now: at("2026-10-29T23:40:00Z"), location: LAGOS });
    expect(noon.daylight).toBe(1);
    expect(noon.phase).toBe("day");
    expect(night.daylight).toBe(0);
    expect(night.phase).toBe("night");
    expect(night.label).toBe("Night"); // no weather reading, so no claim about clouds
    expect(night.stars).toBeGreaterThan(0.5);
    expect(luminance(hex(noon.skyTop))).toBeGreaterThan(luminance(hex(night.skyTop)));
  });

  it("rains when the weather says so, and dims the sun", () => {
    const weather = { fetchedAt: at("2026-10-29T11:00:00Z"), code: 63, temperature: 26, cloudCover: 0.9, precipitation: 2, windSpeed: 12, isDay: true };
    const sky = computeSky({ now: at("2026-10-29T11:40:00Z"), location: LAGOS, weather });
    expect(sky.precip).toBe("rain");
    expect(sky.label).toBe("Rain");
    expect(sky.sun.dim).toBeGreaterThan(0.6);
    expect(sky.temperature).toBe(26);
  });

  it("ignores stale weather", () => {
    const weather = { fetchedAt: at("2026-10-28T11:00:00Z"), code: 95, temperature: 26, cloudCover: 1, precipitation: 9, windSpeed: 40, isDay: true };
    expect(computeSky({ now: at("2026-10-29T11:40:00Z"), location: LAGOS, weather }).storm).toBe(false);
  });

  it("lets a mood override time and weather", () => {
    const now = at("2026-10-29T11:40:00Z");
    for (const mood of MOODS) {
      const sky = computeSky({ now, location: LAGOS, envTime: mood.time, envWeather: mood.weather });
      expect(sky.live).toBe(mood.id === "live");
    }
    const storm = computeSky({ now, location: LAGOS, envTime: "night", envWeather: "storm" });
    expect(storm.phase).toBe("night");
    expect(storm.storm).toBe(true);
    expect(storm.precip).toBe("rain");
    expect(computeSky({ now, envTime: "day", envWeather: "snow" }).precip).toBe("snow");
  });

  it("maps WMO codes", () => {
    expect(describeWeather(0).label).toBe("Clear");
    expect(describeWeather(45).fog).toBe(true);
    expect(describeWeather(75).precip).toBe("snow");
    expect(describeWeather(99).storm).toBe(true);
  });
});

describe("theme", () => {
  const day = computeSky({ now: at("2026-10-29T11:40:00Z"), location: LAGOS });
  const night = computeSky({ now: at("2026-10-29T23:40:00Z"), location: LAGOS });
  const lightness = (rgba: string) => {
    const [r, g, b] = rgba.match(/[\d.]+/g)!.map(Number) as [number, number, number];
    return luminance([r, g, b]);
  };

  it("lifts dark mode a little by day and sinks it at night", () => {
    expect(lightness(themeFor(day, true).glass)).toBeGreaterThan(lightness(themeFor(night, true).glass));
    expect(lightness(themeFor(night, true).glass)).toBeLessThan(0.01);
  });

  it("keeps light mode bright by day and softer at night", () => {
    expect(lightness(themeFor(day, false).glass)).toBeGreaterThan(lightness(themeFor(night, false).glass));
    expect(lightness(themeFor(night, false).glass)).toBeGreaterThan(0.6);
  });

  it("keeps text readable on the glass", () => {
    for (const sky of [day, night])
      for (const dark of [true, false]) {
        const t = themeFor(sky, dark);
        const fg = luminance(hex(t.text));
        const bg = lightness(t.glass);
        const contrast = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        expect(contrast).toBeGreaterThan(7);
      }
  });
});
