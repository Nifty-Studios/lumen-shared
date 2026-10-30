// UI colors that breathe with the sky. Dark mode lifts a little while the sun is up and
// sinks to a deep shade at night; light mode is crisp at noon and turns into soft,
// warm paper after dark. Accents follow the hour: rose at dawn, blue by day, amber at
// golden hour, lavender at night.

import { hex, hsl, lerp, mix, rgba, scale, toHex, type Rgb } from "./color";
import type { SkyState } from "./sky";

export interface ThemeTokens {
  dark: boolean;
  /** The sky gradient after toning it for the mode. */
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  /** Translucent sheet over the sky (sidebar, page). */
  glass: string;
  /** Nearly opaque surface (menus, dialogs). */
  surface: string;
  /** Opaque version of the glass, for places without backdrop blur. */
  solid: string;
  glassBorder: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  hover: string;
  active: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  selection: string;
  shadow: string;
  scrim: string;
  danger: string;
}

/** Weights of the four looks of the day; they sum to 1. */
function hourWeights(sky: SkyState) {
  const night = 1 - sky.daylight;
  const warm = sky.warmth * sky.daylight;
  const dawn = sky.rising ? warm : 0;
  const golden = sky.rising ? 0 : warm;
  const day = Math.max(0, 1 - night - warm);
  return { night, dawn, golden, day };
}

function blend(weights: ReturnType<typeof hourWeights>, colors: Record<keyof ReturnType<typeof hourWeights>, Rgb>): Rgb {
  const out: Rgb = [0, 0, 0];
  let total = 0;
  for (const key of Object.keys(weights) as (keyof typeof weights)[]) {
    const w = weights[key];
    total += w;
    for (let i = 0; i < 3; i++) out[i]! += colors[key][i]! * w;
  }
  return scale(out, 1 / (total || 1));
}

/** Accent colors to pick from (Settings > Appearance); any other hex works too. */
export const ACCENT_PRESETS: { name: string; color: string }[] = [
  { name: "Blue", color: "#2f7bd6" },
  { name: "Violet", color: "#7c5cd6" },
  { name: "Rose", color: "#d0577f" },
  { name: "Red", color: "#d14343" },
  { name: "Amber", color: "#c4741c" },
  { name: "Green", color: "#2f9e5b" },
  { name: "Teal", color: "#1f9aa3" },
  { name: "Graphite", color: "#5d6577" },
];

export const isHexColor = (s: string) => /^#[0-9a-f]{6}$/i.test(s.trim());

const luminance = (c: Rgb) => (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;

/** A picked accent, tuned for the mode: brighter on dark glass, deeper on light paper. */
function customAccent(color: string, dark: boolean): Rgb {
  let c = hex(color);
  if (dark) while (luminance(c) < 0.55) c = mix(c, [255, 255, 255], 0.18);
  else while (luminance(c) > 0.55) c = mix(c, [0, 0, 0], 0.15);
  return c;
}

export function themeFor(sky: SkyState, dark: boolean, accentColor?: string | null): ThemeTokens {
  const w = hourWeights(sky);
  const d = sky.daylight;
  let top = hex(sky.skyTop);
  let mid = hex(sky.skyMid);
  let bottom = hex(sky.skyBottom);

  if (dark) {
    // Keep the sky behind dark glass dim: by day a deep version of itself, at night as is.
    const k = lerp(0.95, 0.42, d);
    top = scale(top, k);
    mid = scale(mid, k * 0.95);
    bottom = scale(bottom, k * 0.9);
  } else {
    // Light mode never goes pitch black: nights become a soft twilight lavender.
    const lift = (1 - d) * 0.38;
    top = mix(top, hex("#7b84bf"), lift);
    mid = mix(mid, hex("#9a98c8"), lift);
    bottom = mix(bottom, hex("#c3b3c9"), lift);
  }

  const base = dark
    ? blend(w, {
        night: hsl(232, 0.24, 0.07),
        dawn: hsl(330, 0.12, 0.13),
        golden: hsl(28, 0.16, 0.13),
        day: hsl(216, 0.12, 0.15),
      })
    : blend(w, {
        night: hsl(36, 0.36, 0.905),
        dawn: hsl(345, 0.5, 0.97),
        golden: hsl(36, 0.6, 0.955),
        day: hsl(210, 0.32, 0.985),
      });

  const text: Rgb = dark ? mix(hex("#d9d5cc"), hex("#eeebe5"), d) : mix(hex("#3b342c"), hex("#2a2926"), d);
  const picked = accentColor && isHexColor(accentColor) ? customAccent(accentColor, dark) : undefined;
  const accent = picked
    ? picked
    : dark
    ? blend(w, { night: hex("#a99cff"), dawn: hex("#f08fb0"), golden: hex("#f2aa5c"), day: hex("#6cb2ff") })
    : blend(w, { night: hex("#6c5fd3"), dawn: hex("#d0577f"), golden: hex("#c4741c"), day: hex("#2f7bd6") });
  const ink: Rgb = dark ? [255, 255, 255] : [0, 0, 0];
  const glassAlpha = dark ? lerp(0.8, 0.7, d) : lerp(0.8, 0.74, d);

  return {
    dark,
    skyTop: toHex(top),
    skyMid: toHex(mid),
    skyBottom: toHex(bottom),
    glass: rgba(base, glassAlpha),
    surface: rgba(dark ? mix(base, [255, 255, 255], 0.04) : mix(base, [255, 255, 255], 0.5), 0.96),
    solid: toHex(mix(base, mid, dark ? 0.12 : 0.06)),
    glassBorder: rgba(ink, dark ? 0.09 : 0.07),
    text: toHex(text),
    muted: toHex(mix(text, base, dark ? 0.42 : 0.45)),
    faint: toHex(mix(text, base, dark ? 0.66 : 0.7)),
    border: rgba(ink, dark ? 0.1 : 0.09),
    hover: rgba(ink, dark ? 0.065 : 0.05),
    active: rgba(ink, dark ? 0.11 : 0.085),
    accent: toHex(accent),
    accentSoft: rgba(accent, dark ? 0.2 : 0.14),
    accentText: picked ? (luminance(picked) > 0.5 ? "#14131a" : "#ffffff") : dark ? "#14131a" : "#ffffff",
    selection: rgba(accent, dark ? 0.32 : 0.22),
    shadow: rgba(dark ? [0, 0, 0] : mix(hex("#2c2a45"), [0, 0, 0], 0.4), dark ? 0.45 : 0.16),
    scrim: rgba(dark ? [0, 0, 0] : hex("#1d1b2e"), dark ? 0.5 : 0.28),
    danger: dark ? "#ff8a80" : "#d14343",
  };
}

/** Readable text color over a sky color (for the clock and labels drawn on the sky). */
export const textOnSky = (sky: string, dark: boolean) => {
  const c = hex(sky);
  const light = (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;
  return light > (dark ? 0.62 : 0.58) ? "#1f2230" : "#f7f5f0";
};

