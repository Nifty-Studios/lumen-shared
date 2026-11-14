// The drawing kit the themes share: paint that follows the light, gradients collected per
// drawing, and small parts (leaves, vines, steam, pines, neon) used in more than one world.

import { hex, lerp, mix, scale, toHex, type Rgb } from "../ambient/color";
import type { SkyState } from "../ambient/sky";
import type { ThemeTokens } from "../ambient/theme";

/** What the drawings need to know about the moment. */
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface SceneLook {
  dark: boolean;
  /** 0 = deep night, 1 = full day. */
  daylight: number;
  snow: boolean;
  rain: boolean;
  storm: boolean;
  /** The app's accent now. */
  accent: string;
  /** The sky gradient as shown (top, middle, bottom). */
  sky: [string, string, string];
  /** Add the classes and inline styles the desktop animates. */
  animated: boolean;
  /** The special day being celebrated, if any ("christmas", "birthday"...). */
  celebration: string | null;
  /** The season where the device is (always summer in the tropics). */
  season: Season;
  /** Today: day of the month, month (0-11) and weekday (0 = Sunday). */
  day: number;
  month: number;
  weekday: number;
}

export function seasonAt(now: number, latitude?: number | null): Season {
  if (latitude != null && Math.abs(latitude) < 23.5) return "summer";
  const m = (new Date(now).getMonth() + (latitude != null && latitude < 0 ? 6 : 0)) % 12;
  return m < 2 || m === 11 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
}

export function sceneLook(sky: SkyState, theme: ThemeTokens, animated = true, extra?: { celebration?: string | null; latitude?: number | null }): SceneLook {
  const d = new Date(sky.now);
  return {
    dark: theme.dark,
    daylight: sky.daylight,
    snow: sky.precip === "snow",
    rain: sky.precip === "rain" || sky.precip === "drizzle" || sky.storm,
    storm: sky.storm,
    accent: theme.accent,
    sky: [theme.skyTop, theme.skyMid, theme.skyBottom],
    animated,
    celebration: extra?.celebration ?? null,
    season: seasonAt(sky.now, extra?.latitude),
    day: d.getDate(),
    month: d.getMonth(),
    weekday: d.getDay(),
  };
}

export interface SceneArt {
  svg: string;
  width: number;
  height: number;
}

// ---- helpers ----------------------------------------------------------------------------

export const n = (v: number) => +v.toFixed(1);
export const n3 = (v: number) => +Math.max(0, Math.min(1, v)).toFixed(3);

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gradient ids must be unique across every drawing on the page. */
let gradients = 0;
/** Gradient definitions of the drawing being built; `draw` puts them in its <defs>. */
let pending: string[] = [];

export type Stop = [offset: number, color: string, opacity?: number];
export const stopsOf = (stops: Stop[]) =>
  stops.map(([o, color, a]) => `<stop offset="${o}" stop-color="${color}"${a === undefined ? "" : ` stop-opacity="${n3(a)}"`}/>`).join("");

/** A linear gradient in drawing coordinates; returns the paint to use as a fill or stroke. */
export function lin(x1: number, y1: number, x2: number, y2: number, stops: Stop[]) {
  const id = `lm-g${++gradients}`;
  pending.push(`<linearGradient id="${id}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" gradientUnits="userSpaceOnUse">${stopsOf(stops)}</linearGradient>`);
  return `url(#${id})`;
}

export function radial(cx: number, cy: number, r: number, stops: Stop[]) {
  const id = `lm-g${++gradients}`;
  pending.push(`<radialGradient id="${id}" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" gradientUnits="userSpaceOnUse">${stopsOf(stops)}</radialGradient>`);
  return `url(#${id})`;
}

/** A soft light: a radial fade, which both the browser and react-native-svg can draw. */
export const halo = (x: number, y: number, r: number, color: string, strength: number) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${radial(x, y, r, [[0, color, strength * 0.6], [0.4, color, strength * 0.22], [1, color, 0]])}"/>`;

/** A cone of lamplight from (x, y) down to `bottom`, fading out as it falls. */
export const beam = (x: number, y: number, top: number, spread: number, bottom: number, color: string, strength: number) =>
  `<path d="M${n(x - top)} ${n(y)}L${n(x - spread)} ${n(bottom)}H${n(x + spread)}L${n(x + top)} ${n(y)}Z" fill="${lin(0, y, 0, bottom, [[0, color, strength], [1, color, 0]])}"/>`;

export interface Paint {
  /** A surface color as lit right now. `shift` lightens (0..1) or darkens (-1..0) it first. */
  c: (color: string, shift?: number) => string;
  /** Top-to-bottom shading between y1 and y2. */
  v: (top: string, bottom: string, y1: number, y2: number) => string;
  /** Left-to-right shading between x1 and x2 (light comes from the left). */
  h: (left: string, right: string, x1: number, x2: number) => string;
  /** Polished metal across x1..x2: dark, a bright streak, dark. */
  chrome: (color: string, x1: number, x2: number) => string;
  /** The shadow something casts where it stands. */
  shadow: (x: number, y: number, rx: number, ry: number, k?: number) => string;
  /** Strength of lamps, windows and neon: faint by day, full at night. */
  glow: number;
  night: number;
  snow: string;
  /** class/style attributes for a moving part (empty when not animated). */
  move: (cls: string, origin?: [number, number], delay?: number, duration?: number, vars?: string) => string;
  /** Marks something the desktop lets you poke (it wiggles); "light" also switches the lights. */
  poke: (name: string) => string;
  /** Marks light that a poked lamp switches off. */
  light: string;
  look: SceneLook;
}

export function paint(look: SceneLook): Paint {
  const night = 1 - look.daylight;
  const dusk: Rgb = hex(look.dark ? "#0b0e1f" : "#2c3058");
  const k = night * (look.dark ? 0.5 : 0.42);
  const dim = look.dark ? lerp(0.8, 0.9, night) : 1;
  /** Lit as the scene is now; takes colors already adjusted by `raw`. */
  const toned = (base: Rgb) => toHex(scale(mix(base, dusk, k), dim));
  const raw = (color: string, shift: number): Rgb => (shift >= 0 ? mix(hex(color), [255, 255, 255], shift) : mix(hex(color), [12, 10, 24], -shift));
  const c = (color: string, shift = 0) => toned(raw(color, shift));
  const shade = look.dark ? 0.6 : 0.34;
  return {
    c,
    v: (top, bottom, y1, y2) => lin(0, y1, 0, y2, [[0, c(top)], [1, c(bottom)]]),
    h: (left, right, x1, x2) => lin(x1, 0, x2, 0, [[0, c(left)], [1, c(right)]]),
    chrome: (color, x1, x2) => lin(x1, 0, x2, 0, [[0, c(color, -0.3)], [0.32, c(color, 0.55)], [0.5, c(color)], [1, c(color, -0.4)]]),
    shadow: (x, y, rx, ry, strength = 1) => {
      const id = `lm-g${++gradients}`;
      pending.push(`<radialGradient id="${id}"><stop offset="0" stop-color="#05061a" stop-opacity="${n3(shade * strength)}"/><stop offset="0.55" stop-color="#05061a" stop-opacity="${n3(shade * strength * 0.5)}"/><stop offset="1" stop-color="#05061a" stop-opacity="0"/></radialGradient>`);
      return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})"/>`;
    },
    glow: lerp(look.dark ? 0.45 : 0.16, 1, night * night * (3 - 2 * night)),
    night,
    snow: toHex(mix(hex("#ffffff"), dusk, k * 0.45)),
    move: (cls, origin, delay, duration, vars) => {
      if (!look.animated) return "";
      const style = [
        origin ? `transform-origin:${n(origin[0])}px ${n(origin[1])}px` : "",
        delay !== undefined ? `animation-delay:${n(-delay)}s` : "",
        duration !== undefined ? `animation-duration:${n(duration)}s` : "",
        vars ?? "",
      ].filter(Boolean);
      return ` class="lm-${cls}"${style.length ? ` style="${style.join(";")}"` : ""}`;
    },
    poke: (name) => (look.animated ? ` data-poke="${name}"` : ""),
    light: look.animated ? ` class="lm-light"` : "",
    look,
  };
}

/** A short label drawn into the art (signs, the desk calendar). Keep to plain letters and digits. */
export const label = (x: number, y: number, str: string, size: number, fill: string, opts: { anchor?: "start" | "middle" | "end"; weight?: number; spacing?: number; opacity?: number } = {}) =>
  `<text x="${n(x)}" y="${n(y)}" font-family="Inter, Segoe UI, Roboto, sans-serif" font-size="${n(size)}" font-weight="${opts.weight ?? 700}" text-anchor="${opts.anchor ?? "middle"}"${opts.spacing ? ` letter-spacing="${n(opts.spacing)}"` : ""} fill="${fill}"${opts.opacity === undefined ? "" : ` opacity="${n3(opts.opacity)}"`}>${str}</text>`;

/** Builds one drawing: collects the gradients its body asks for into <defs>. */
export function draw(width: number, height: number, aspect: string, body: () => string): SceneArt {
  pending = [];
  const content = body();
  const defs = pending.length ? `<defs>${pending.join("")}</defs>` : "";
  pending = [];
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" preserveAspectRatio="${aspect}" fill="none">${defs}${content}</svg>`,
  };
}

/** A pointed leaf from (x, y), `len` long, turned `angle` degrees; `vein` draws its midrib. */
export const leaf = (x: number, y: number, len: number, angle: number, fill: string, fat = 0.42, vein?: string) =>
  `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})"><path d="M0 0Q${n(len / 2)} ${n(-len * fat)} ${n(len)} 0Q${n(len / 2)} ${n(len * fat)} 0 0Z" fill="${fill}"/>${
    vein ? `<path d="M${n(len * 0.08)} 0H${n(len * 0.86)}" stroke="${vein}" stroke-width="0.7" stroke-linecap="round" opacity="0.55"/>` : ""
  }</g>`;

/** A trailing vine hanging from (x, y): a swaying stem with leaves down both sides. */
export function vine(p: Paint, r: () => number, x: number, y: number, length: number, greens: string[], blossom?: string) {
  const bend = (r() - 0.5) * 16;
  const end = { x: x + bend, y: y + length };
  let out = `<path d="M${n(x)} ${n(y)}Q${n(x - bend * 0.6)} ${n(y + length * 0.55)} ${n(end.x)} ${n(end.y)}" stroke="${greens[0]}" stroke-width="1.2" stroke-linecap="round"/>`;
  const count = Math.max(3, Math.round(length / 6));
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 0.4);
    const qx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x - bend * 0.6) + t * t * end.x;
    const qy = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + length * 0.55) + t * t * end.y;
    const side = i % 2 ? 1 : -1;
    out += leaf(qx, qy, 5.5 + r() * 3.5, 90 - side * (52 + r() * 22), greens[i % greens.length]!, 0.5);
  }
  if (blossom) out += flower(end.x, end.y + 1, 3.4, blossom, p.c("#ffd166"));
  return `<g${p.move("sway", [x, y], r() * 8, 6 + r() * 4)}>${out}</g>`;
}

export function flower(x: number, y: number, r: number, petal: string, heart: string) {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    out += `<circle cx="${n(x + Math.cos(a) * r * 0.72)}" cy="${n(y + Math.sin(a) * r * 0.72)}" r="${n(r * 0.62)}" fill="${petal}"/>`;
  }
  return out + `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.42)}" fill="${heart}"/>`;
}

/** Two wisps of steam rising from (x, y). */
export const steam = (p: Paint, x: number, y: number, color: string) =>
  [0, 1]
    .map(
      (i) =>
        `<path${p.move("steam", undefined, i * 1.7)} d="M${n(x + i * 6)} ${n(y)}q-3.5 -5 0 -9.5t0 -9.5" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="${p.look.animated ? 0.55 : 0.4}"/>`,
    )
    .join("");

export function fern(p: Paint, r: () => number, x: number, y: number, len: number, angle: number, color: string, delay: number) {
  // A frond: a curved rib with leaflets that shrink toward the tip.
  let out = `<path d="M0 0Q${n(len * 0.5)} ${n(-len * 0.16)} ${n(len)} 0" stroke="${color}" stroke-width="1.100" stroke-linecap="round"/>`;
  const count = Math.round(len / 3.6);
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const px = t * len;
    const py = -Math.sin(t * Math.PI) * len * 0.08;
    const size = (1 - t * 0.8) * len * 0.3;
    out += leaf(px, py, size, -62, color, 0.36) + leaf(px, py, size, 62, color, 0.36);
  }
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})"><g${p.move("sway", [0, 0], delay, 7 + r() * 3)}>${out}</g></g>`;
}

/** A pine with a lit side and a shaded side; `snow` lies on its boughs. */
export function pine(x: number, base: number, hgt: number, color: string, shadeColor: string, snow?: string) {
  const w = hgt * 0.42;
  let out = `<rect x="${n(x - hgt * 0.03)}" y="${n(base - hgt * 0.16)}" width="${n(hgt * 0.06)}" height="${n(hgt * 0.18)}" fill="${shadeColor}"/>`;
  for (let i = 0; i < 4; i++) {
    const top = base - hgt + i * hgt * 0.19;
    const half = w * (0.36 + i * 0.22);
    const bottom = top + hgt * 0.36;
    out += `<path d="M${n(x)} ${n(top)}L${n(x + half)} ${n(bottom)}Q${n(x)} ${n(bottom - hgt * 0.05)} ${n(x - half)} ${n(bottom)}Z" fill="${color}"/>`;
    out += `<path d="M${n(x)} ${n(top)}L${n(x + half)} ${n(bottom)}Q${n(x + half * 0.5)} ${n(bottom - hgt * 0.035)} ${n(x)} ${n(bottom - hgt * 0.025)}Z" fill="${shadeColor}"/>`;
    if (snow) out += `<path d="M${n(x)} ${n(top)}L${n(x + half * 0.5)} ${n(top + hgt * 0.17)}Q${n(x)} ${n(top + hgt * 0.12)} ${n(x - half * 0.5)} ${n(top + hgt * 0.17)}Z" fill="${snow}" opacity="0.92"/>`;
  }
  return out;
}

/** A neon tube: a wide soft stroke under a bright thin one. */
export const neon = (d: string, color: string, glow: number, w = 2) =>
  `<path d="${d}" stroke="${color}" stroke-width="${n(w * 3.6)}" stroke-linecap="round" stroke-linejoin="round" opacity="${n3(glow * 0.22)}"/><path d="${d}" stroke="${color}" stroke-width="${n(w * 2)}" stroke-linecap="round" stroke-linejoin="round" opacity="${n3(glow * 0.3)}"/><path d="${d}" stroke="${toHex(mix(hex(color), [255, 255, 255], 0.25 + glow * 0.4))}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round" opacity="${n3(0.55 + glow * 0.45)}"/>`;

// ---- shorthand for the shapes the drawings are made of ----

export const op = (a: number) => ` opacity="${n3(a)}"`;
export const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0, extra = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${n(rx)}"` : ""} fill="${fill}"${extra}/>`;
export const path = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}"${extra}/>`;
export const stroke = (d: string, color: string, w = 1, extra = "") => `<path d="${d}" stroke="${color}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
export const circ = (x: number, y: number, r: number, fill: string, extra = "") => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"${extra}/>`;
export const ell = (x: number, y: number, rx: number, ry: number, fill: string, extra = "") => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${extra}/>`;

/** Keeps what is drawn with the returned attribute inside `shape` (an SVG element). */
export function clip(shape: string) {
  const id = `lm-g${++gradients}`;
  pending.push(`<clipPath id="${id}">${shape}</clipPath>`);
  return ` clip-path="url(#${id})"`;
}

/** A row of books standing on `base`, from x rightward: [width, height, color]. Returns the art and where it ended. */
export function books(p: Paint, x: number, base: number, list: [number, number, string][]): string {
  let s = "";
  for (const [w, h, color] of list) {
    s += rect(x, base - h, w, h, p.h(color, color, x, x + w), 0.8);
    s += rect(x + w * 0.62, base - h, w * 0.38, h, "#05061a", 0.8, op(0.16));
    s += rect(x + 0.8, base - h * 0.78, w - 1.6, 1.2, p.c("#f6ead2"), 0, op(0.7));
    if (h > 14) s += rect(x + 0.8, base - h * 0.24, w - 1.6, 1.2, p.c("#f6ead2"), 0, op(0.5));
    x += w + 0.6;
  }
  return s;
}

/** A small weather picture (about 2r across) for boards and signs. */
export function weatherMark(p: Paint, x: number, y: number, r: number, ink: string): string {
  const { look } = p;
  const cloud = (cx: number, cy: number, k: number, fill: string) =>
    `<path d="M${n(cx - 8 * k)} ${n(cy + 4 * k)}a${n(4 * k)} ${n(4 * k)} 0 0 1 ${n(1 * k)} ${n(-8 * k)}a${n(6 * k)} ${n(6 * k)} 0 0 1 ${n(11 * k)} ${n(-1 * k)}a${n(4.5 * k)} ${n(4.5 * k)} 0 0 1 ${n(3 * k)} ${n(9 * k)}Z" fill="${fill}"/>`;
  const k = r / 10;
  if (look.snow) {
    let s = "";
    for (let i = 0; i < 3; i++) s += `<path d="M${n(x - r * 0.8)} ${n(y)}H${n(x + r * 0.8)}" stroke="${ink}" stroke-width="${n(1.4 * k)}" stroke-linecap="round" transform="rotate(${i * 60} ${n(x)} ${n(y)})"/>`;
    return s + circ(x, y, 1.6 * k, ink);
  }
  if (look.storm) return cloud(x, y - 3 * k, k, ink) + path(`M${n(x)} ${n(y + 1 * k)}l${n(-3 * k)} ${n(5 * k)}h${n(2.6 * k)}l${n(-1.6 * k)} ${n(4.4 * k)}l${n(5 * k)} ${n(-6.4 * k)}h${n(-2.6 * k)}l${n(1.6 * k)} ${n(-3 * k)}Z`, "#ffd166");
  if (look.rain) return cloud(x, y - 3 * k, k, ink) + stroke(`M${n(x - 4 * k)} ${n(y + 4 * k)}l${n(-1.4 * k)} ${n(4 * k)}M${n(x)} ${n(y + 4 * k)}l${n(-1.4 * k)} ${n(4 * k)}M${n(x + 4 * k)} ${n(y + 4 * k)}l${n(-1.4 * k)} ${n(4 * k)}`, "#5aa8e8", 1.4 * k);
  if (look.daylight < 0.35) return path(`M${n(x + 2 * k)} ${n(y - 8 * k)}a${n(8 * k)} ${n(8 * k)} 0 1 0 ${n(6 * k)} ${n(11 * k)}a${n(6.4 * k)} ${n(6.4 * k)} 0 0 1 ${n(-6 * k)} ${n(-11 * k)}Z`, "#f4d58a") + circ(x - 6 * k, y - 6 * k, 0.9 * k, "#f4d58a");
  let s = circ(x, y, 4.6 * k, "#ffb347");
  for (let i = 0; i < 8; i++) s += `<path d="M${n(x)} ${n(y - 6.6 * k)}V${n(y - 9 * k)}" stroke="#ffb347" stroke-width="${n(1.4 * k)}" stroke-linecap="round" transform="rotate(${i * 45} ${n(x)} ${n(y)})"/>`;
  return s;
}
