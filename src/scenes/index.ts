// Themes: small illustrated worlds that live with the sky. Each has three drawings: a
// backdrop (silhouettes far behind the glass, in the sky's own colors), an overhead piece
// hanging from the top of the window, and a corner vignette that sits at the bottom of the
// sidebar (or in the corner of the phone's sky card).
//
// The drawings are plain SVG text built from the sky as it is now: they dim as the light
// goes, their lamps and windows come on at night, snow settles on them and an umbrella comes
// out in the rain. Colors are baked in (no CSS variables) and light is drawn with gradients
// (no blur filters), so the same text renders in a browser and in react-native-svg. With
// `animated`, moving parts carry `lm-*` classes that the desktop styles; the phone leaves
// them out.
//
// Drawing rules, so things look made rather than stamped: every surface is shaded (a lit
// side and a shadow side), everything that stands on something casts a contact shadow, and
// materials get their detail (grain in wood, glare on glass, a highlight on chrome).

import { hex, lerp, mix, scale, toHex, type Rgb } from "../ambient/color";
import type { SceneId } from "../ambient/environment";
import type { SkyState } from "../ambient/sky";
import type { SceneTint, ThemeTokens } from "../ambient/theme";
import type { IconName } from "../icons/data";

export type { SceneId };

export interface Scene extends SceneTint {
  id: SceneId;
  name: string;
  description: string;
  icon: IconName;
}

export const SCENES: Scene[] = [
  {
    id: "workstation",
    name: "Workstation",
    description: "A desk by the window, string lights, the city outside",
    icon: "monitor",
    accent: ["#b8642a", "#f2b46b"],
    tint: ["#39406b", "#8b6f8f", "#e9b58a"],
    strength: 0.16,
  },
  {
    id: "forest",
    name: "Forest",
    description: "A mossy log under the canopy, pines to the horizon",
    icon: "trees",
    accent: ["#3f8a52", "#8fd6a0"],
    tint: ["#1f4a4a", "#4f8a6a", "#cfe3a8"],
    strength: 0.2,
  },
  {
    id: "restaurant",
    name: "Sci-fi restaurant",
    description: "A neon diner at the edge of the galaxy",
    icon: "rocket",
    accent: ["#b83d8f", "#ff8ad1"],
    tint: ["#1b1446", "#5b2f8f", "#ff7fb0"],
    strength: 0.2,
  },
];

export const sceneOf = (id: SceneId | null | undefined): Scene | undefined => SCENES.find((s) => s.id === id);

/** What the drawings need to know about the moment. */
export interface SceneLook {
  dark: boolean;
  /** 0 = deep night, 1 = full day. */
  daylight: number;
  snow: boolean;
  rain: boolean;
  /** The app's accent now. */
  accent: string;
  /** The sky gradient as shown (top, middle, bottom). */
  sky: [string, string, string];
  /** Add the classes and inline styles the desktop animates. */
  animated: boolean;
}

export function sceneLook(sky: SkyState, theme: ThemeTokens, animated = true): SceneLook {
  return {
    dark: theme.dark,
    daylight: sky.daylight,
    snow: sky.precip === "snow",
    rain: sky.precip === "rain" || sky.precip === "drizzle" || sky.storm,
    accent: theme.accent,
    sky: [theme.skyTop, theme.skyMid, theme.skyBottom],
    animated,
  };
}

export interface SceneArt {
  svg: string;
  width: number;
  height: number;
}

// ---- helpers ----------------------------------------------------------------------------

const n = (v: number) => +v.toFixed(1);
const n3 = (v: number) => +Math.max(0, Math.min(1, v)).toFixed(3);

function rng(seed: number) {
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

type Stop = [offset: number, color: string, opacity?: number];
const stopsOf = (stops: Stop[]) =>
  stops.map(([o, color, a]) => `<stop offset="${o}" stop-color="${color}"${a === undefined ? "" : ` stop-opacity="${n3(a)}"`}/>`).join("");

/** A linear gradient in drawing coordinates; returns the paint to use as a fill or stroke. */
function lin(x1: number, y1: number, x2: number, y2: number, stops: Stop[]) {
  const id = `lm-g${++gradients}`;
  pending.push(`<linearGradient id="${id}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" gradientUnits="userSpaceOnUse">${stopsOf(stops)}</linearGradient>`);
  return `url(#${id})`;
}

function radial(cx: number, cy: number, r: number, stops: Stop[]) {
  const id = `lm-g${++gradients}`;
  pending.push(`<radialGradient id="${id}" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" gradientUnits="userSpaceOnUse">${stopsOf(stops)}</radialGradient>`);
  return `url(#${id})`;
}

/** A soft light: a radial fade, which both the browser and react-native-svg can draw. */
const halo = (x: number, y: number, r: number, color: string, strength: number) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${radial(x, y, r, [[0, color, strength * 0.6], [0.4, color, strength * 0.22], [1, color, 0]])}"/>`;

/** A cone of lamplight from (x, y) down to `bottom`, fading out as it falls. */
const beam = (x: number, y: number, top: number, spread: number, bottom: number, color: string, strength: number) =>
  `<path d="M${n(x - top)} ${n(y)}L${n(x - spread)} ${n(bottom)}H${n(x + spread)}L${n(x + top)} ${n(y)}Z" fill="${lin(0, y, 0, bottom, [[0, color, strength], [1, color, 0]])}"/>`;

interface Paint {
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
  move: (cls: string, origin?: [number, number], delay?: number, duration?: number) => string;
  look: SceneLook;
}

function paint(look: SceneLook): Paint {
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
    move: (cls, origin, delay, duration) => {
      if (!look.animated) return "";
      const style = [
        origin ? `transform-origin:${n(origin[0])}px ${n(origin[1])}px` : "",
        delay !== undefined ? `animation-delay:${n(-delay)}s` : "",
        duration !== undefined ? `animation-duration:${n(duration)}s` : "",
      ].filter(Boolean);
      return ` class="lm-${cls}"${style.length ? ` style="${style.join(";")}"` : ""}`;
    },
    look,
  };
}

/** Builds one drawing: collects the gradients its body asks for into <defs>. */
function draw(width: number, height: number, aspect: string, body: () => string): SceneArt {
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
const leaf = (x: number, y: number, len: number, angle: number, fill: string, fat = 0.42, vein?: string) =>
  `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})"><path d="M0 0Q${n(len / 2)} ${n(-len * fat)} ${n(len)} 0Q${n(len / 2)} ${n(len * fat)} 0 0Z" fill="${fill}"/>${
    vein ? `<path d="M${n(len * 0.08)} 0H${n(len * 0.86)}" stroke="${vein}" stroke-width="0.7" stroke-linecap="round" opacity="0.55"/>` : ""
  }</g>`;

/** A trailing vine hanging from (x, y): a swaying stem with leaves down both sides. */
function vine(p: Paint, r: () => number, x: number, y: number, length: number, greens: string[], blossom?: string) {
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

function flower(x: number, y: number, r: number, petal: string, heart: string) {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    out += `<circle cx="${n(x + Math.cos(a) * r * 0.72)}" cy="${n(y + Math.sin(a) * r * 0.72)}" r="${n(r * 0.62)}" fill="${petal}"/>`;
  }
  return out + `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.42)}" fill="${heart}"/>`;
}

/** Two wisps of steam rising from (x, y). */
const steam = (p: Paint, x: number, y: number, color: string) =>
  [0, 1]
    .map(
      (i) =>
        `<path${p.move("steam", undefined, i * 1.7)} d="M${n(x + i * 6)} ${n(y)}q-3.5 -5 0 -9.5t0 -9.5" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="${p.look.animated ? 0.55 : 0.4}"/>`,
    )
    .join("");

// ---- workstation ------------------------------------------------------------------------

function workstationCorner(p: Paint): string {
  const { c, v, h, glow, shadow } = p;
  const accent = p.look.accent;
  const screenLit = toHex(mix(hex("#dfe8f2"), hex("#a8d4ff"), p.night));
  let s = "";

  // The room: a framed print on the wall, lit by whatever is on.
  s += `<rect x="177.500" y="24" width="40" height="30" rx="2" fill="#05061a" opacity="0.22"/>`;
  s += `<rect x="176" y="22" width="40" height="30" rx="2" fill="${v("#e9dcc6", "#cdbb9f", 22, 52)}"/>`;
  s += `<rect x="179.500" y="25.500" width="33" height="23" fill="${v("#f4c9a0", "#f7e6cf", 25, 49)}"/>`;
  s += `<circle cx="203" cy="33" r="3.600" fill="${c("#fff3d6")}"/>`;
  s += `<path d="M179.500 48.500L190 36L196 42L202 37L212.500 48.500Z" fill="${c("#7d8fb3")}"/><path d="M179.500 48.500L187 41L194 48.500Z" fill="${c("#5c6f96")}"/>`;

  // Light: the lamp's cone and pool, and the screen's wash on the wall.
  s += beam(45, 60, 8, 34, 104, "#ffd58a", glow * 0.42);
  s += halo(46, 58, 34, "#ffd58a", glow * 0.9);
  s += halo(120, 64, 66, screenLit, glow * 0.5);

  // Floor shadow under the whole desk.
  s += shadow(136, 138.5, 126, 4.5, 0.9);

  // The umbrella comes out when it rains: leaning on the desk leg, still dripping.
  if (p.look.rain) {
    s += shadow(23, 139, 11, 2, 0.7);
    s += `<path d="M21 138L33 100" stroke="${c("#4a4458")}" stroke-width="1.600" stroke-linecap="round"/>`;
    s += `<path d="M22.500 133Q14 118 30.500 102Q40 112 29.500 135Z" fill="${c(accent)}"/>`;
    s += `<path d="M22.500 133Q22 116 30.500 102" stroke="${c(accent, 0.35)}" stroke-width="1" opacity="0.7"/><path d="M26.500 134Q34 118 30.500 102" stroke="${c(accent, -0.35)}" stroke-width="1" opacity="0.6"/>`;
    s += `<path d="M33 100q3 -5 6.500 -2.500" stroke="${c("#4a4458")}" stroke-width="1.800" stroke-linecap="round"/>`;
    s += `<ellipse cx="22" cy="139" rx="9" ry="1.500" fill="${c("#9fc3e8")}" opacity="0.5"/>`;
  }

  // Desk: tapered legs, a drawer unit, and a top with a rounded front edge and grain.
  s += `<path d="M40 111H47L45.500 140H41.500Z" fill="${h("#9a6a45", "#6e4a31", 40, 47)}"/>`;
  s += `<rect x="186" y="110" width="54" height="30" rx="2" fill="${h("#b4835a", "#8a5f40", 186, 240)}"/>`;
  s += `<rect x="186" y="110" width="54" height="4" fill="#1a1020" opacity="0.28"/>`;
  for (const y of [116, 128]) {
    s += `<rect x="191" y="${y}" width="44" height="9.500" rx="1.800" fill="${v("#9c6e49", "#86593b", y, y + 9.5)}"/>`;
    s += `<rect x="191" y="${y}" width="44" height="1.200" rx="0.600" fill="${c("#d9a676")}" opacity="0.5"/>`;
    s += `<rect x="207" y="${n(y + 3.6)}" width="12" height="2.400" rx="1.200" fill="${c("#e8c79a")}"/><rect x="207" y="${n(y + 5)}" width="12" height="1" rx="0.500" fill="#1a1020" opacity="0.3"/>`;
  }
  s += `<rect x="10" y="103" width="252" height="8" rx="3.500" fill="${v("#d6a273", "#a8744b", 103, 111)}"/>`;
  s += `<rect x="12" y="103.600" width="248" height="1.400" rx="0.700" fill="${c("#f0c79c")}" opacity="0.8"/>`;
  s += `<path d="M30 107h44M96 108.200h70M190 107h40M150 106.200h22" stroke="${c("#8c5e3c")}" stroke-width="0.700" stroke-linecap="round" opacity="0.45"/>`;

  // Lamp: weighted base, two-part arm with joints, a shade lit from inside.
  s += shadow(36, 103.5, 17, 2.2);
  s += `<path d="M24 103Q24 98.500 36 98.500Q48 98.500 48 103Z" fill="${v("#5b6078", "#34374a", 98, 103)}"/>`;
  s += `<path d="M36 99L29 74L43 57" stroke="${c("#34374a")}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="M35.300 98L28.400 74L42 57.500" stroke="${c("#7d829c")}" stroke-width="0.900" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`;
  s += `<circle cx="29" cy="74" r="3" fill="${c("#4a4e66")}"/><circle cx="28.400" cy="73.400" r="1.100" fill="${c("#9aa0bd")}"/>`;
  s += `<path d="M35 49L56 54.500L52.500 67Q43 69.500 33 60.500Z" fill="${lin(33, 0, 56, 0, [[0, c(accent, 0.25)], [1, c(accent, -0.3)]])}"/>`;
  s += `<path d="M36.500 50.500L54 55" stroke="${c(accent, 0.55)}" stroke-width="1" stroke-linecap="round" opacity="0.8"/>`;
  s += `<ellipse cx="43" cy="64" rx="9.500" ry="3.200" fill="#fff1c4" opacity="${n3(0.4 + glow * 0.6)}" transform="rotate(14 43 64)"/>`;

  // Monitor: bezel, a screen with depth and a glare, stand and foot.
  s += shadow(120, 103.5, 24, 2.4);
  s += `<path d="M115 90H125L126.500 101H113.500Z" fill="${h("#5a5f7c", "#363a50", 113, 127)}"/>`;
  s += `<path d="M102 103Q102 99.500 120 99.500Q138 99.500 138 103Z" fill="${v("#666b88", "#3a3e55", 99, 103)}"/>`;
  s += `<rect x="79" y="38" width="82" height="54" rx="6" fill="${v("#565b78", "#34384e", 38, 92)}"/>`;
  s += `<rect x="81" y="38.800" width="78" height="1.400" rx="0.700" fill="${c("#9aa0bd")}" opacity="0.5"/>`;
  s += `<rect x="83" y="42" width="74" height="42" rx="3" fill="${lin(83, 42, 157, 84, [[0, "#1b2440"], [1, "#0f1528"]])}"/>`;
  const lines: [number, number, number, string][] = [
    [88, 48, 16, accent],
    [107, 48, 28, "#8fb4ff"],
    [92, 54, 30, "#e8e6f0"],
    [92, 60, 13, "#7fe0b0"],
    [108, 60, 24, "#e8e6f0"],
    [96, 66, 36, "#ffb37a"],
    [96, 72, 18, "#e8e6f0"],
    [92, 78, 9, accent],
  ];
  for (const [x, y, w, color] of lines) s += `<rect x="${x}" y="${y}" width="${w}" height="2.600" rx="1.300" fill="${color}" opacity="${n3(0.48 + glow * 0.44)}"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="85" y="${n(48.6 + i * 6)}" width="1.600" height="1.400" rx="0.700" fill="#6f7aa3" opacity="0.6"/>`;
  s += `<rect${p.move("blink")} x="116" y="72" width="2" height="3.400" fill="#ffffff" opacity="0.9"/>`;
  s += `<path d="M83 42H112L92 84H83Z" fill="#ffffff" opacity="0.045"/>`;
  s += `<circle cx="120" cy="88" r="1" fill="#7fe0b0" opacity="${n3(0.4 + glow * 0.6)}"/>`;
  // A note stuck to the corner of the screen.
  s += `<g transform="rotate(6 157 40)"><path d="M152 34H163V44L160.500 46.500H152Z" fill="${c("#ffe07a")}"/><path d="M154 38h6M154 41h4" stroke="${c("#b89430")}" stroke-width="0.800" stroke-linecap="round"/></g>`;

  // Keyboard and mouse.
  s += shadow(158, 104, 19, 1.6, 0.8);
  s += `<path d="M141 103L143 98H173L175 103Z" fill="${v("#f1eef7", "#c9c4d9", 98, 103)}"/>`;
  s += `<path d="M145 99.600h26M144.400 101.300h27.200" stroke="${c("#a8a2bd")}" stroke-width="1" stroke-dasharray="2 0.900" opacity="0.9"/>`;
  s += `<path d="M179 103Q179 98.800 183 98.800Q187 98.800 187 103Z" fill="${v("#f1eef7", "#c4bfd6", 98, 103)}"/>`;

  // Mug, with coffee and a wisp of steam.
  s += shadow(67, 104, 12, 1.8);
  s += steam(p, 63, 85, c("#ffffff"));
  s += `<path d="M74 92.500q7 0 7 4.800t-7 4.200" stroke="${c("#e4dfd3")}" stroke-width="2.200" stroke-linecap="round"/>`;
  s += `<path d="M58 89H75V99.500Q75 104 70 104H63Q58 104 58 99.500Z" fill="${h("#fbf8f1", "#cfc8b8", 58, 75)}"/>`;
  s += `<rect x="58" y="93" width="17" height="3.200" fill="${lin(58, 0, 75, 0, [[0, c(accent, 0.2)], [1, c(accent, -0.25)]])}" opacity="0.92"/>`;
  s += `<ellipse cx="66.500" cy="89" rx="8.500" ry="1.900" fill="${c("#fbf8f1")}"/><ellipse cx="66.500" cy="89.200" rx="7" ry="1.300" fill="${c("#5a3a26")}"/>`;

  // Books, with the cat asleep on top.
  s += shadow(207, 104, 27, 1.8);
  s += `<rect x="183" y="97.500" width="48" height="6.500" rx="1.400" fill="${v("#6b8fc8", "#46669c", 97, 104)}"/><rect x="227" y="98.300" width="3.400" height="4.900" fill="${c("#f3ecdc")}"/>`;
  s += `<path d="M187 97.500v6.500M191 97.500v6.500" stroke="${c("#dfe7f7")}" stroke-width="0.800" opacity="0.7"/>`;
  s += `<rect x="186" y="91.500" width="42" height="6" rx="1.400" fill="${v("#e58a6c", "#b85f45", 91, 98)}"/><rect x="186.800" y="92.300" width="3.200" height="4.400" fill="${c("#f3ecdc")}"/>`;
  s += `<path d="M219 91.500v6M223 91.500v6" stroke="${c("#ffe0c8")}" stroke-width="0.800" opacity="0.7"/>`;
  const fur = "#3f3850";
  s += `<path d="M222 91.500q13 -0.500 12 -8.500q-0.600 -4.400 -5 -3.200" stroke="${c(fur)}" stroke-width="3.400" stroke-linecap="round"/><path d="M229.300 79.900q1.500 -0.300 2.800 0.500" stroke="${c("#8a80a8")}" stroke-width="1.600" stroke-linecap="round"/>`;
  s += `<path${p.move("breathe", [207, 91.5])} d="M190 91.500Q188 78.500 204 77.500Q222 76.500 225 91.500Z" fill="${v("#564c6e", "#322b42", 77, 92)}"/>`;
  s += `<path d="M211 79.500Q219 81 221 91" stroke="${c("#2a2438")}" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`;
  s += `<path d="M188.500 91.500Q185 83.500 192 81L192.500 76.500L196.500 80Q199 79.800 200 80.500L203.500 77.500L203.800 83Q206 87.500 203 91.500Z" fill="${v("#564c6e", "#3a3250", 77, 92)}"/>`;
  s += `<path d="M193 78.500L193.200 80.800L195 80ZM202.800 79.500L201.400 81L203 81.800Z" fill="${c("#e9a3b4")}"/>`;
  s += `<path d="M192.500 86q1.500 1.400 3 0M198 86q1.500 1.400 3 0" stroke="${c("#d6cfe8")}" stroke-width="0.900" stroke-linecap="round"/><path d="M196.300 88.300l0.700 0.800l0.700 -0.800Z" fill="${c("#e9a3b4")}"/>`;
  s += `<path d="M193.500 89.200l-5 -0.800M193.500 90l-4.600 1M200.500 89.200l5 -0.800M200.500 90l4.600 1" stroke="${c("#d6cfe8")}" stroke-width="0.400" opacity="0.7"/>`;

  // A leafy plant at the end of the desk.
  const g1 = c("#4f9a62");
  const g2 = c("#35744b");
  const g3 = c("#78bf7e");
  const rib = c("#2a5f3c");
  s += shadow(248, 104, 13, 1.8);
  s += `<g${p.move("sway", [248, 90], 2, 9)}>`;
  s += leaf(248, 90, 27, -120, g2, 0.4, rib) + leaf(248, 90, 25, -60, g2, 0.4, rib) + leaf(247, 90, 21, -150, g1, 0.42, rib) + leaf(249, 90, 20, -30, g1, 0.42, rib);
  s += leaf(248, 90, 32, -93, g1, 0.36, rib) + leaf(248, 90, 22, -106, g3, 0.36, rib) + leaf(248, 90, 18, -74, g3, 0.44, rib);
  s += `</g>`;
  s += `<path d="M239 89H257L254.300 104H241.700Z" fill="${h("#e2905f", "#a85a3a", 239, 257)}"/>`;
  s += `<rect x="237.500" y="86" width="21" height="4.600" rx="1.800" fill="${h("#f0a273", "#bd6c46", 237, 259)}"/><ellipse cx="248" cy="86.600" rx="9" ry="1.200" fill="${c("#4a3426")}"/>`;
  s += `<path d="M241 92.500Q248 94 255 92.500" stroke="${c("#f6b68a")}" stroke-width="0.800" opacity="0.6"/>`;
  return s;
}

function workstationOverhead(p: Paint, width: number): string {
  const { c, h, glow } = p;
  const r = rng(11);
  const end = Math.max(220, width - 210);
  const span = 148;
  const pins = Math.max(2, Math.round(end / span) + 1);
  const step = end / (pins - 1);
  const bulbColors = ["#ffd98a", "#ffc37a", "#ffe6b0", "#ffb38a"];
  let wires = "";
  let bulbs = "";
  let plants = "";
  for (let i = 0; i < pins; i++) {
    const x = 8 + i * step;
    wires += `<path d="M${n(x - 2.4)} 0H${n(x + 2.4)}L${n(x + 1.4)} 4.500H${n(x - 1.4)}Z" fill="${c("#8a8296")}"/>`;
  }
  for (let i = 0; i < pins - 1; i++) {
    const x0 = 8 + i * step;
    const x1 = 8 + (i + 1) * step;
    const sag = 15 + r() * 9;
    const mx = (x0 + x1) / 2;
    const d = `M${n(x0)} 3.500Q${n(mx)} ${n(3.5 + sag * 2)} ${n(x1)} 3.500`;
    wires += `<path d="${d}" stroke="${c("#2f2b3a")}" stroke-width="1.500" stroke-linecap="round"/>`;
    for (let j = 1; j <= 4; j++) {
      const t = j / 5;
      const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
      const by = (1 - t) * (1 - t) * 3.5 + 2 * (1 - t) * t * (3.5 + sag * 2) + t * t * 3.5;
      const color = bulbColors[(i + j) % bulbColors.length]!;
      const lit = toHex(mix(hex(c(color)), hex(color), 0.35 + glow * 0.65));
      const cy = by + 7.4;
      bulbs += `<g${p.move("twinkle", undefined, r() * 5, 3.5 + r() * 3)}>${halo(bx, cy, 15, color, glow)}</g>`;
      bulbs += `<rect x="${n(bx - 1.9)}" y="${n(by - 0.4)}" width="3.800" height="4" rx="0.900" fill="${h("#7a7488", "#4a4556", bx - 2, bx + 2)}"/><path d="M${n(bx - 1.9)} ${n(by + 1)}h3.800M${n(bx - 1.9)} ${n(by + 2.3)}h3.800" stroke="${c("#2f2b3a")}" stroke-width="0.500" opacity="0.6"/>`;
      // A pear-shaped glass bulb: bright at its heart, amber at the edge.
      bulbs += `<path d="M${n(bx - 1.7)} ${n(by + 3.4)}Q${n(bx - 4.6)} ${n(cy - 1)} ${n(bx - 4.2)} ${n(cy + 1)}A4.200 4.200 0 0 0 ${n(bx + 4.2)} ${n(cy + 1)}Q${n(bx + 4.6)} ${n(cy - 1)} ${n(bx + 1.7)} ${n(by + 3.4)}Z" fill="${radial(bx - 0.6, cy, 5.4, [[0, toHex(mix(hex(lit), [255, 255, 255], 0.55 + glow * 0.3))], [0.6, lit], [1, toHex(mix(hex(lit), hex("#c9742a"), 0.45))]])}"/>`;
      bulbs += `<path d="M${n(bx - 2.5)} ${n(cy - 1.2)}q0.300 -2 1.500 -3" stroke="#ffffff" stroke-width="0.800" stroke-linecap="round" opacity="0.75"/>`;
    }
    // Every other pin holds a hanging planter with trailing vines.
    if (i % 2 === 1 || (pins <= 3 && i === 0)) {
      const px = x0 + (i === 0 ? step * 0.5 : 0);
      const py = 22 + r() * 5;
      const greens = [c("#35744b"), c("#4f9a62"), c("#78bf7e")];
      const white = i % 4 === 1;
      let pl = `<path d="M${n(px)} 3L${n(px - 10)} ${n(py)}M${n(px)} 3L${n(px + 10)} ${n(py)}M${n(px)} 3V${n(py - 2)}" stroke="${c("#c9b79a")}" stroke-width="0.900" stroke-linecap="round"/><circle cx="${n(px)}" cy="7.500" r="1.300" fill="${c("#c9b79a")}"/>`;
      pl += vine(p, r, px - 8, py + 3, 16 + r() * 10, greens, r() > 0.45 ? c("#ffb3c8") : undefined);
      pl += vine(p, r, px + 8, py + 3, 12 + r() * 10, greens);
      pl += vine(p, r, px, py + 4, 22 + r() * 12, greens, c("#fff0f4"));
      for (let k = 0; k < 9; k++) pl += leaf(px + (k - 4) * 2.6, py + 1, 10 + r() * 6, -90 + (k - 4) * 21 + (r() - 0.5) * 14, greens[k % 3]!, 0.44, k % 2 ? c("#2a5f3c") : undefined);
      pl += `<path d="M${n(px - 10.5)} ${n(py)}H${n(px + 10.5)}L${n(px + 7.5)} ${n(py + 11.5)}Q${n(px)} ${n(py + 13.5)} ${n(px - 7.5)} ${n(py + 11.5)}Z" fill="${white ? h("#ffffff", "#c9c4d2", px - 10, px + 10) : h("#e2905f", "#a85a3a", px - 10, px + 10)}"/>`;
      pl += `<rect x="${n(px - 11.5)}" y="${n(py - 1.6)}" width="23" height="3.800" rx="1.600" fill="${white ? h("#ffffff", "#d6d1de", px - 11, px + 11) : h("#f0a273", "#bd6c46", px - 11, px + 11)}"/>`;
      plants += `<g${p.move("sway", [px, 3], r() * 6, 11)}>${pl}</g>`;
    }
  }
  return wires + plants + bulbs;
}

function workstationBackdrop(p: Paint): string {
  const { look } = p;
  const r = rng(5);
  const ink = hex(look.dark ? "#05060f" : "#262a4a");
  const bottom = hex(look.sky[2]);
  const lit = "#ffdf9c";
  let s = "";
  const row = (min: number, max: number, depth: number, windows: number, wmin: number, wmax: number) => {
    const color = toHex(mix(bottom, ink, depth));
    const side = toHex(mix(bottom, ink, Math.min(1, depth + 0.14)));
    let x = -10;
    while (x < 1210) {
      const w = wmin + r() * (wmax - wmin);
      const hgt = min + r() * (max - min);
      const top = 800 - hgt;
      const kind = r();
      s += `<rect x="${n(x)}" y="${n(top)}" width="${n(w)}" height="${n(hgt + 4)}" fill="${color}"/>`;
      // The side away from the light.
      s += `<rect x="${n(x + w * 0.68)}" y="${n(top)}" width="${n(w * 0.32)}" height="${n(hgt + 4)}" fill="${side}"/>`;
      if (kind < 0.3) {
        // Stepped crown.
        s += `<rect x="${n(x + w * 0.16)}" y="${n(top - 14)}" width="${n(w * 0.68)}" height="15" fill="${color}"/><rect x="${n(x + w * 0.34)}" y="${n(top - 26)}" width="${n(w * 0.32)}" height="13" fill="${color}"/>`;
      } else if (kind < 0.48) {
        // Water tower on legs.
        const tx = x + w * 0.3;
        s += `<path d="M${n(tx)} ${n(top)}v-9M${n(tx + 14)} ${n(top)}v-9M${n(tx)} ${n(top - 9)}L${n(tx + 14)} ${n(top)}" stroke="${color}" stroke-width="1.600"/><rect x="${n(tx - 3)}" y="${n(top - 24)}" width="20" height="15" rx="2" fill="${color}"/><path d="M${n(tx - 4)} ${n(top - 24)}L${n(tx + 7)} ${n(top - 32)}L${n(tx + 18)} ${n(top - 24)}Z" fill="${color}"/>`;
      } else if (kind < 0.62) {
        // Pitched roof.
        s += `<path d="M${n(x)} ${n(top + 1)}L${n(x + w / 2)} ${n(top - 18)}L${n(x + w)} ${n(top + 1)}Z" fill="${color}"/>`;
      } else if (kind < 0.76) {
        s += `<rect x="${n(x + w * 0.5)}" y="${n(top - 40)}" width="1.800" height="42" fill="${color}"/><circle${p.move("twinkle", undefined, r() * 4, 2.4)} cx="${n(x + w * 0.5 + 0.9)}" cy="${n(top - 40)}" r="2.200" fill="#ff8a7a" opacity="${n3(p.glow)}"/>`;
      }
      if (look.snow) s += `<rect x="${n(x - 1)}" y="${n(top - 2)}" width="${n(w + 2)}" height="4" rx="2" fill="${p.snow}" opacity="0.85"/>`;
      if (windows) {
        const cols = Math.max(2, Math.floor((w - 10) / 11));
        const gap = (w - 10) / cols;
        for (let wy = top + 10; wy < 792; wy += 14) {
          // Whole floors are sometimes dark, like a real building at night.
          const floorOn = r() < 0.78;
          for (let col = 0; col < cols; col++) {
            const on = floorOn && r() < windows;
            const wx = x + 6 + col * gap;
            s += on
              ? `<rect x="${n(wx)}" y="${n(wy)}" width="5.400" height="7.400" rx="0.800" fill="${lit}" opacity="${n3(p.glow * (0.4 + r() * 0.6))}"/>`
              : `<rect x="${n(wx)}" y="${n(wy)}" width="5.400" height="7.400" rx="0.800" fill="${look.sky[1]}" opacity="0.1"/>`;
          }
        }
      }
      x += w + 1 + r() * 8;
    }
  };
  // Three planes of city, each hazier with distance.
  row(220, 380, 0.14, 0, 60, 130);
  s += `<rect x="0" y="420" width="1200" height="380" fill="${lin(0, 420, 0, 800, [[0, look.sky[2], 0], [1, look.sky[2], 0.55]])}"/>`;
  row(130, 270, 0.32, 0.22, 46, 110);
  s += `<rect x="0" y="560" width="1200" height="240" fill="${lin(0, 560, 0, 800, [[0, look.sky[2], 0], [1, look.sky[2], 0.3]])}"/>`;
  row(60, 180, 0.58, 0.34, 50, 120);
  return s;
}

// ---- forest -----------------------------------------------------------------------------

function fern(p: Paint, r: () => number, x: number, y: number, len: number, angle: number, color: string, delay: number) {
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
function pine(x: number, base: number, hgt: number, color: string, shadeColor: string, snow?: string) {
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

function forestCorner(p: Paint): string {
  const { c, v, h, glow, look, shadow } = p;
  const r = rng(23);
  const moss = c("#5d9a58");
  const mossDark = c("#3d7a4c");
  const mossLight = c("#8cc272");
  const snow = look.snow ? p.snow : undefined;
  let s = "";

  // Far undergrowth, paler with distance, then saplings.
  s += `<path d="M0 124Q10 106 26 112Q36 96 54 106Q70 94 88 108Q104 98 120 110Q140 100 158 110Q176 98 196 108Q214 98 232 108Q250 100 272 112V140H0Z" fill="${c("#86b08f")}" opacity="0.5"/>`;
  s += pine(22, 124, 60, c("#2f6a4c"), c("#22543b"), snow);
  s += pine(254, 122, 48, c("#2f6a4c"), c("#22543b"), snow);
  s += pine(238, 124, 31, c("#3d7a52"), c("#2c6140"), snow);
  s += pine(40, 124, 26, c("#3d7a52"), c("#2c6140"), snow);

  // The lantern's pool of light.
  s += halo(150, 78, 50, "#ffcf7a", glow);

  // Back rise of ground.
  s += `<path d="M0 140V120Q34 106 84 113T176 110T272 117V140Z" fill="${v("#4a8a55", "#2f6842", 108, 140)}"/>`;

  // The fallen log: round in section, lit along the top, rough with bark.
  s += shadow(152, 121, 68, 5);
  s += `<path d="M97 100q-8 -3 -11 -10" stroke="${c("#6c4a36")}" stroke-width="3.400" stroke-linecap="round"/>`;
  s += leaf(86, 90, 10, -128, mossLight, 0.42, mossDark) + leaf(86, 90, 9, -58, moss, 0.42, mossDark);
  s += `<rect x="92" y="92" width="122" height="27" rx="13.500" fill="${v("#b0845e", "#5a3c2c", 92, 119)}"/>`;
  s += `<path d="M103 98.500q16 -2 34 0M146 103q20 -2 42 0M110 110.500q10 -1.500 24 0M166 96.500q8 -1 20 0M100 106q10 -1.500 22 0M140 113.500q18 -1.500 40 0.500M178 108q8 -1 18 0" stroke="${c("#4f3426")}" stroke-width="1.300" stroke-linecap="round" opacity="0.75"/>`;
  s += `<path d="M104 96q14 -1.600 30 -0.400M150 96.500q14 -1.400 30 0" stroke="${c("#d3a57c")}" stroke-width="0.900" stroke-linecap="round" opacity="0.6"/>`;
  s += `<ellipse cx="128" cy="107" rx="4" ry="2.800" fill="${c("#4f3426")}"/><ellipse cx="128" cy="107" rx="2.200" ry="1.400" fill="${c("#7a5640")}"/>`;
  // Cut end: growth rings and a crack.
  s += `<ellipse cx="212" cy="105.500" rx="9.500" ry="13.500" fill="${c("#6c4a36")}"/>`;
  s += `<ellipse cx="212.600" cy="105.500" rx="8.300" ry="12.300" fill="${radial(211, 104, 13, [[0, c("#f0d2a6")], [0.7, c("#d0a877")], [1, c("#b48a5e")]])}"/>`;
  s += `<ellipse cx="212.600" cy="105.500" rx="5.800" ry="8.800" stroke="${c("#b0845c")}" stroke-width="0.700"/><ellipse cx="212.600" cy="105.500" rx="3.400" ry="5.400" stroke="${c("#b0845c")}" stroke-width="0.700"/><ellipse cx="212.600" cy="105.500" rx="1.200" ry="2" fill="${c("#a07850")}"/>`;
  s += `<path d="M212.600 105.500L218 97" stroke="${c("#8a6444")}" stroke-width="0.800" stroke-linecap="round"/>`;
  // Shelf fungus on its side.
  s += `<path d="M160 112q6 -5 12 0Z" fill="${v("#f3e2c4", "#c9a06c", 107, 112)}"/><path d="M170 116q5 -4 10 0Z" fill="${v("#f3e2c4", "#c9a06c", 112, 116)}"/>`;
  // Moss, or snow, lying along the top of the log.
  if (look.snow) {
    s += `<path d="M96 96Q102 84 122 87T160 85.500T206 93Q190 98 160 95.500T96 96Z" fill="${p.snow}"/><path d="M104 93Q130 89 160 91" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`;
  } else {
    s += `<path d="M99 95.500Q104 87 122 89.500T158 88.500T198 94Q182 98 158 96.500T99 95.500Z" fill="${v("#74b060", "#467f4a", 88, 98)}"/>`;
    for (const [mx, my, mr] of [[112, 90.5, 4.2], [121, 89.5, 3], [168, 90, 3.8], [178, 91, 2.8], [142, 90, 2.6]] as const)
      s += `<circle cx="${mx}" cy="${my}" r="${mr}" fill="${moss}"/><circle cx="${n(mx - mr * 0.3)}" cy="${n(my - mr * 0.35)}" r="${n(mr * 0.5)}" fill="${mossLight}"/>`;
  }

  // Lantern on the log: a wire bail, a cap, a glass with a flame inside, a base.
  s += `<path d="M144.500 66.500q5.500 -10 11 0" stroke="${c("#55506a")}" stroke-width="1.300" stroke-linecap="round"/>`;
  s += `<path d="M143 69L145 64.500H155L157 69Z" fill="${v("#6d6885", "#3b374c", 64, 69)}"/>`;
  s += `<rect x="144.200" y="69" width="11.600" height="17" rx="2" fill="${lin(144, 0, 156, 0, [[0, "#fff2c4", 0.5 + glow * 0.5], [0.5, "#ffd98a", 0.45 + glow * 0.5], [1, "#f0a850", 0.45 + glow * 0.45]])}"/>`;
  s += `<path${p.move("flicker", [150, 84.5])} d="M150 72.500q4.400 6 0 11.500q-4.400 -5 0 -11.500Z" fill="#ff9d4a" opacity="${n3(0.6 + glow * 0.4)}"/><path d="M150 77q2 3 0 6.500q-2 -3 0 -6.500Z" fill="#fff2c4" opacity="${n3(0.7 + glow * 0.3)}"/>`;
  s += `<path d="M144.200 69v17M155.800 69v17M150 69v3" stroke="${c("#3b374c")}" stroke-width="1.100"/><path d="M146 71v12" stroke="#ffffff" stroke-width="0.800" stroke-linecap="round" opacity="0.5"/>`;
  s += `<path d="M142.500 86H157.500L156 90H144Z" fill="${v("#6d6885", "#34303f", 86, 90)}"/>`;

  // Front rise of ground, darker at the foot.
  s += `<path d="M0 140V127Q50 117 110 123T210 121T272 127V140Z" fill="${v("#6aa85e", "#3f7a4a", 118, 140)}"/>`;
  s += `<path d="M2 127.500Q50 118 110 124" stroke="${mossLight}" stroke-width="1" stroke-linecap="round" opacity="0.5"/>`;
  // Pebbles.
  for (const [px, py, pr] of [[92, 131, 3.4], [99, 132.5, 2.2], [204, 130, 3], [146, 134, 2.4]] as const)
    s += shadow(px, py + pr * 0.6, pr * 1.3, pr * 0.4, 0.8) + `<ellipse cx="${px}" cy="${py}" rx="${pr}" ry="${n(pr * 0.7)}" fill="${v("#b7b9c4", "#7c7f8e", py - pr, py + pr)}"/>`;

  // Mushrooms: domed caps with gills beneath, and a faint light of their own after dark.
  const shroom = (x: number, y: number, k: number, cap: string) => {
    let o = halo(x, y - 9 * k, 16 * k, "#ffd9c2", glow * 0.8) + shadow(x, y + 0.5, 7 * k, 1.6 * k, 0.9);
    o += `<path d="M${n(x - 2.4 * k)} ${n(y)}Q${n(x - 1.3 * k)} ${n(y - 6 * k)} ${n(x - 1.9 * k)} ${n(y - 10 * k)}H${n(x + 1.9 * k)}Q${n(x + 1.3 * k)} ${n(y - 6 * k)} ${n(x + 2.4 * k)} ${n(y)}Z" fill="${h("#fbf2e2", "#cdbfa6", x - 2.4 * k, x + 2.4 * k)}"/>`;
    o += `<ellipse cx="${n(x)}" cy="${n(y - 9 * k)}" rx="${n(8.4 * k)}" ry="${n(1.9 * k)}" fill="${c("#e9d8bf")}"/>`;
    o += `<path d="M${n(x - 9 * k)} ${n(y - 9 * k)}Q${n(x - 8.4 * k)} ${n(y - 19 * k)} ${n(x)} ${n(y - 19.5 * k)}Q${n(x + 8.4 * k)} ${n(y - 19 * k)} ${n(x + 9 * k)} ${n(y - 9 * k)}Q${n(x)} ${n(y - 7.4 * k)} ${n(x - 9 * k)} ${n(y - 9 * k)}Z" fill="${look.snow ? p.snow : lin(x - 6 * k, y - 20 * k, x + 6 * k, y - 8 * k, [[0, c(cap, 0.25)], [1, c(cap, -0.3)]])}"/>`;
    if (!look.snow)
      o += `<ellipse cx="${n(x - 3.6 * k)}" cy="${n(y - 13 * k)}" rx="${n(1.7 * k)}" ry="${n(1.3 * k)}" fill="#fff6ea" opacity="0.92"/><ellipse cx="${n(x + 2.4 * k)}" cy="${n(y - 15.6 * k)}" rx="${n(1.4 * k)}" ry="${n(1 * k)}" fill="#fff6ea" opacity="0.92"/><ellipse cx="${n(x + 5 * k)}" cy="${n(y - 11.6 * k)}" rx="${n(1.1 * k)}" ry="${n(0.9 * k)}" fill="#fff6ea" opacity="0.92"/><ellipse cx="${n(x - 0.6 * k)}" cy="${n(y - 11 * k)}" rx="${n(0.9 * k)}" ry="${n(0.7 * k)}" fill="#fff6ea" opacity="0.85"/>`;
    return o;
  };
  s += shroom(62, 127, 1.05, "#d9574a") + shroom(78, 129, 0.7, "#e2764a") + shroom(48, 130, 0.58, "#d9574a");

  // Ferns, grass and small flowers.
  s += fern(p, r, 14, 131, 42, -62, mossLight, 0) + fern(p, r, 16, 132, 37, -28, moss, 2) + fern(p, r, 12, 131, 31, -100, moss, 4) + fern(p, r, 18, 133, 27, -6, mossLight, 1) + fern(p, r, 15, 132, 24, -80, mossDark, 3);
  for (let i = 0; i < 16; i++) {
    const gx = 84 + r() * 186;
    const gy = 126 + r() * 9;
    const tall = 6 + r() * 6;
    s += leaf(gx, gy, tall, -112 + r() * 10, i % 2 ? mossLight : mossDark, 0.16) + leaf(gx, gy, tall * 1.25, -92 + r() * 8, i % 2 ? mossDark : moss, 0.16) + leaf(gx, gy, tall * 0.9, -70 + r() * 10, mossLight, 0.16);
  }
  s += flower(112, 121, 2.6, c("#fff4f7"), c("#ffd166")) + flower(196, 119.5, 2.3, c("#ffc2d6"), c("#ffd166")) + flower(120, 127, 1.9, c("#ffc2d6"), c("#ffd166")) + flower(180, 129, 2, c("#fff4f7"), c("#ffd166"));

  // The fox, curled up asleep with its tail around its nose.
  const cream = c("#fbf1e2");
  s += shadow(235, 128, 27, 3);
  s += `<path${p.move("breathe", [236, 127])} d="M214 127Q210 107 232 105Q256 104 259 127Z" fill="${v("#f09246", "#b85c22", 105, 127)}"/>`;
  s += `<path d="M240 108Q254 110 256 124" stroke="${c("#a8521e")}" stroke-width="1" stroke-linecap="round" opacity="0.5"/>`;
  // Tail: thick, darker underneath, white at the tip.
  s += `<path d="M259 125Q264 111 251 107Q262 120 236 127Q250 131 259 125Z" fill="${v("#d97a34", "#a8521e", 107, 130)}"/>`;
  s += `<path d="M213 128Q205 127 207 119.500Q211 112 222 117Q230 122 240 127Q224 131 213 128Z" fill="${v("#f09246", "#cf7030", 114, 130)}"/>`;
  s += `<path d="M206 124Q206 117 213 115.500Q209 121 213 128Q207.500 128 206 124Z" fill="${cream}"/>`;
  // Head, ears with dark tips, a white cheek and muzzle.
  s += `<path d="M219 119Q218 109.500 226 108Q234.500 109 235.500 118Q233.500 126.500 226 127.500Q220 126.500 219 119Z" fill="${v("#f39a4e", "#d2722f", 108, 128)}"/>`;
  s += `<path d="M220.200 113L219.400 103.500L226.200 108.800Z" fill="${c("#d2722f")}"/><path d="M233.800 112.500L236.400 103.500L229 108.300Z" fill="${c("#d2722f")}"/>`;
  s += `<path d="M219.800 107.500L219.400 103.500L222.200 105.700Z" fill="${c("#3a2a2a")}"/><path d="M235.300 107.300L236.400 103.500L233.300 105.500Z" fill="${c("#3a2a2a")}"/>`;
  s += `<path d="M221.200 110.500L221 106.500L224 109Z" fill="${c("#f7cfae")}"/>`;
  s += `<path d="M221 121Q226 129.500 232.500 121Q230 127.500 226 128Q223 127.500 221 121Z" fill="${cream}"/><ellipse cx="226.800" cy="125" rx="1.300" ry="1" fill="${c("#2a1e1e")}"/>`;
  s += `<path d="M222 117.500q1.600 1.400 3.200 0M229 117.500q1.600 1.400 3.200 0" stroke="${c("#2a1e1e")}" stroke-width="0.900" stroke-linecap="round"/>`;
  if (look.snow) s += `<path d="M218 109Q232 100 253 109Q236 106 218 109Z" fill="${p.snow}" opacity="0.9"/>`;

  // Fireflies after dark.
  if (p.night > 0.35) {
    for (let i = 0; i < 7; i++) {
      const fx = 20 + r() * 232;
      const fy = 22 + r() * 70;
      s += `<g${p.move("firefly", undefined, r() * 9, 7 + r() * 6)}>${halo(fx, fy, 6, "#f4ff9a", p.night)}<circle cx="${n(fx)}" cy="${n(fy)}" r="1.200" fill="#fbffc8" opacity="${n3(p.night)}"/></g>`;
    }
  }
  return s;
}

function forestOverhead(p: Paint, width: number): string {
  const { c, look } = p;
  const r = rng(31);
  const deep = [c("#1f5638"), c("#2a6644")];
  const greens = [c("#2f7048"), c("#3f8a58"), c("#5aa868"), c("#7cc07a"), c("#96cc7c")];
  const rib = c("#1f5638");
  const bark = c("#6c4a36");
  const end = Math.max(240, width - 190);
  let far = "";
  let back = "";
  let front = "";
  let hanging = "";
  // A bough reaching in from the top-left corner, lit along its top.
  const reach = Math.min(end, 330);
  const bough = `M-6 -4Q${n(reach * 0.34)} 24 ${n(reach * 0.68)} 15T${n(reach)} 7L${n(reach)} 4.500Q${n(reach * 0.72)} 9 ${n(reach * 0.5)} 9Q${n(reach * 0.2)} 10 -6 -14Z`;
  back += `<path d="${bough}" fill="${lin(0, 2, 0, 22, [[0, c("#8b6246")], [1, c("#4f3426")]])}"/>`;
  back += `<path d="M${n(reach * 0.3)} 15Q${n(reach * 0.36)} 30 ${n(reach * 0.44)} 34" stroke="${bark}" stroke-width="2.400" stroke-linecap="round"/>`;
  // A dark layer of leaves in shadow behind everything gives the canopy depth.
  for (let x = -10; x < end - 40; x += 22 + r() * 16) {
    const depth = 16 + r() * 16 + (x < reach ? 6 : 0);
    for (let i = 0; i < 5; i++) far += leaf(x + (r() - 0.5) * 8, -4 + (x < reach ? 5 : 0), depth * (0.8 + r() * 0.4), 25 + i * 32 + (r() - 0.5) * 16, deep[i % 2]!, 0.42);
  }
  // The canopy: clusters of leaves all along the top, thinning out toward the sun's corner.
  for (let x = -6; x < end; x += 15 + r() * 15) {
    const fade = Math.min(1, (end - x) / 150);
    const depth = (11 + r() * 15) * (0.5 + fade * 0.5) + (x < reach ? 7 : 0);
    const count = 5 + Math.floor(r() * 4);
    const lift = x < reach ? 6 : 0;
    let cluster = "";
    for (let i = 0; i < count; i++) {
      const a = 20 + (i / (count - 1)) * 140 + (r() - 0.5) * 22;
      const len = depth * (0.72 + r() * 0.5);
      cluster += leaf(x, -3 + r() * 4 + lift, len, a, greens[Math.floor(r() * greens.length)]!, 0.4, len > 13 ? rib : undefined);
    }
    if (look.snow && r() > 0.35) cluster += `<ellipse cx="${n(x)}" cy="${n(2 + lift)}" rx="${n(depth * 0.55)}" ry="2.600" fill="${p.snow}" opacity="0.9"/>`;
    const g = `<g${p.move("rustle", [x, 0], r() * 6, 5 + r() * 4)}>${cluster}</g>`;
    if (r() > 0.5) front += g;
    else back += g;
    // Vines, some of them in flower.
    if (r() > 0.6 && fade > 0.5) {
      const bloom = r();
      hanging += vine(p, r, x + 4, 5 + lift, 18 + r() * 30, [greens[1]!, greens[2]!, greens[3]!], bloom > 0.62 ? c("#ffc2d6") : bloom > 0.3 ? c("#fff4f7") : undefined);
    }
    if (r() > 0.78 && fade > 0.4) front += flower(x + (r() - 0.5) * 10, 9 + r() * 8 + lift, 3 + r() * 1.4, r() > 0.5 ? c("#fff4f7") : c("#ffc2d6"), c("#ffd166"));
    // A few sprays of berries.
    if (r() > 0.86 && fade > 0.5) {
      const bx = x + 6;
      const by = 14 + r() * 8 + lift;
      front += `<path d="M${n(bx)} ${n(by - 8)}Q${n(bx + 2)} ${n(by - 3)} ${n(bx)} ${n(by)}M${n(bx)} ${n(by - 5)}Q${n(bx - 3)} ${n(by - 3)} ${n(bx - 4)} ${n(by - 1)}M${n(bx + 0.6)} ${n(by - 4)}Q${n(bx + 3)} ${n(by - 3)} ${n(bx + 4)} ${n(by - 2)}" stroke="${bark}" stroke-width="0.700" stroke-linecap="round"/>`;
      for (const [dx, dy] of [[0, 0.8], [-4, -0.2], [4, -1.2]] as const)
        front += `<circle cx="${n(bx + dx)}" cy="${n(by + dy)}" r="2.100" fill="${c("#d9423f")}"/><circle cx="${n(bx + dx - 0.6)}" cy="${n(by + dy - 0.7)}" r="0.600" fill="#ffffff" opacity="0.7"/>`;
    }
  }
  // A robin on a twig, tail bobbing.
  const bx = reach * 0.58;
  front += `<path d="M${n(bx - 26)} 14Q${n(bx - 6)} 30 ${n(bx + 22)} 27" stroke="${bark}" stroke-width="2.200" stroke-linecap="round"/>` + leaf(bx + 20, 27, 9, 20, greens[2]!, 0.42, rib) + leaf(bx + 14, 27, 8, 70, greens[3]!);
  front += `<g transform="translate(0 17)"><g${p.move("bob", [bx, 8])}>`;
  front += `<path d="M${n(bx - 5)} 6L${n(bx - 16)} 9.500L${n(bx - 4)} 8.500Z" fill="${c("#5a4638")}"/>`;
  front += `<path d="M${n(bx - 7)} 4.500Q${n(bx - 7)} -3.500 ${n(bx)} -3.500Q${n(bx + 6.4)} -3.500 ${n(bx + 6.4)} 2.500Q${n(bx + 5)} 9 ${n(bx - 1)} 9Q${n(bx - 6)} 9 ${n(bx - 7)} 4.500Z" fill="${lin(0, -3, 0, 9, [[0, c("#8a6c54")], [1, c("#6b5140")]])}"/>`;
  front += `<path d="M${n(bx - 3)} 1Q${n(bx - 1)} -2.400 ${n(bx + 4.6)} -0.500Q${n(bx + 6.6)} 3 ${n(bx + 4)} 7Q${n(bx)} 9.400 ${n(bx - 3)} 6.500Q${n(bx - 4.4)} 3.500 ${n(bx - 3)} 1Z" fill="${lin(0, -2, 0, 9, [[0, c("#f08a52")], [1, c("#f4c9a4")]])}"/>`;
  front += `<path d="M${n(bx - 6)} 2Q${n(bx - 2)} 4.500 ${n(bx - 4.6)} 8" stroke="${c("#4f3c30")}" stroke-width="1.400" stroke-linecap="round" opacity="0.7"/>`;
  front += `<path d="M${n(bx + 5.8)} -0.200L${n(bx + 10)} 1.200L${n(bx + 5.8)} 2.400Z" fill="${c("#3a2e2a")}"/><circle cx="${n(bx + 2.8)}" cy="-0.600" r="1" fill="${c("#1e1a1e")}"/><circle cx="${n(bx + 3.1)}" cy="-0.900" r="0.300" fill="#ffffff"/>`;
  front += `<path d="M${n(bx - 1)} 9v3M${n(bx + 1.6)} 9v3" stroke="${c("#3a2e2a")}" stroke-width="0.700" stroke-linecap="round"/></g></g>`;
  let flies = "";
  if (p.night > 0.35) {
    for (let i = 0; i < Math.round(end / 110); i++) {
      const fx = 30 + r() * (end - 60);
      const fy = 30 + r() * 40;
      flies += `<g${p.move("firefly", undefined, r() * 9, 7 + r() * 6)}>${halo(fx, fy, 6, "#f4ff9a", p.night)}<circle cx="${n(fx)}" cy="${n(fy)}" r="1.200" fill="#fbffc8" opacity="${n3(p.night)}"/></g>`;
    }
  }
  return far + back + hanging + front + flies;
}

function forestBackdrop(p: Paint): string {
  const { look } = p;
  const r = rng(9);
  const ink = hex(look.dark ? "#04100c" : "#16382c");
  const bottom = hex(look.sky[2]);
  const snow = look.snow ? p.snow : undefined;
  const haze = (y: number, hgt: number, a: number) => `<rect x="0" y="${y}" width="1200" height="${hgt}" fill="${lin(0, y, 0, y + hgt, [[0, look.sky[2], 0], [0.6, look.sky[2], a], [1, look.sky[2], a * 0.4]])}"/>`;
  let s = "";
  // Mountains far off, barely darker than the sky, with snow on their peaks.
  const peak = toHex(mix(bottom, ink, 0.1));
  const peaks: [number, number][] = [[-40, 640], [120, 470], [250, 570], [410, 430], [560, 560], [700, 480], [860, 590], [1010, 450], [1150, 560], [1260, 620]];
  s += `<path d="M-40 800L${peaks.map(([x, y]) => `${x} ${y}`).join("L")}L1260 800Z" fill="${peak}"/>`;
  for (const [x, y] of peaks.filter(([, py]) => py < 500))
    s += `<path d="M${x} ${y}L${x + 34} ${y + 46}L${x + 16} ${y + 38}L${x + 2} ${y + 52}L${x - 14} ${y + 36}L${x - 36} ${y + 50}Z" fill="${toHex(mix(bottom, [255, 255, 255], 0.55))}" opacity="0.8"/>`;
  s += haze(520, 160, 0.6);
  const ridge = (base: number, wave: number, min: number, max: number, depth: number) => {
    const color = toHex(mix(bottom, ink, depth));
    const shadeColor = toHex(mix(bottom, ink, Math.min(1, depth + 0.13)));
    let hill = `M-10 800V${base}`;
    for (let x = 0; x <= 1200; x += 100) hill += `Q${x + 50} ${n(base - wave * (0.4 + r()))} ${x + 100} ${n(base + (r() - 0.5) * wave * 0.5)}`;
    s += `<path d="${hill}V800Z" fill="${color}"/>`;
    for (let x = -10; x < 1210; x += 18 + r() * 32) s += pine(x, base + 6 + r() * 12, min + r() * (max - min), color, shadeColor, snow && depth > 0.4 ? snow : undefined);
  };
  ridge(640, 34, 60, 130, 0.22);
  s += haze(630, 90, 0.5);
  ridge(712, 26, 90, 190, 0.44);
  s += haze(706, 80, 0.32);
  ridge(782, 18, 110, 240, 0.7);
  return s;
}

// ---- sci-fi restaurant ------------------------------------------------------------------

/** A neon tube: a wide soft stroke under a bright thin one. */
const neon = (d: string, color: string, glow: number, w = 2) =>
  `<path d="${d}" stroke="${color}" stroke-width="${n(w * 3.6)}" stroke-linecap="round" stroke-linejoin="round" opacity="${n3(glow * 0.22)}"/><path d="${d}" stroke="${color}" stroke-width="${n(w * 2)}" stroke-linecap="round" stroke-linejoin="round" opacity="${n3(glow * 0.3)}"/><path d="${d}" stroke="${toHex(mix(hex(color), [255, 255, 255], 0.25 + glow * 0.4))}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round" opacity="${n3(0.55 + glow * 0.45)}"/>`;

function restaurantCorner(p: Paint): string {
  const { c, v, h, chrome, glow, look, shadow } = p;
  const cyan = "#5ef2ff";
  const pink = "#ff6fb5";
  let s = "";

  // A porthole: a riveted steel ring, deep space behind thick glass, a ringed planet going by.
  s += halo(44, 46, 36, cyan, glow * 0.45);
  s += `<circle cx="45" cy="48" r="25" fill="#05061a" opacity="0.3"/>`;
  s += `<circle cx="44" cy="46" r="25" fill="${lin(24, 24, 64, 68, [[0, c("#d9dcf2")], [0.5, c("#8f93b8")], [1, c("#4f5378")]])}"/>`;
  s += `<circle cx="44" cy="46" r="20" fill="${c("#3a3d60")}"/>`;
  s += `<circle cx="44" cy="46" r="18.600" fill="${radial(40, 42, 22, [[0, toHex(mix(hex("#3a4a96"), hex("#1a1f4a"), 0.2 + p.night * 0.6))], [1, toHex(mix(hex("#161a44"), hex("#07081c"), 0.3 + p.night * 0.5))]])}"/>`;
  for (const [sx, sy, sr] of [[34, 38, 0.9], [56, 36, 0.7], [52, 58, 0.8], [31, 54, 0.6], [47, 32, 0.5], [58, 48, 0.5]] as const) s += `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#ffffff" opacity="0.85"/>`;
  s += `<g${p.move("drift", [44, 46])}>`;
  s += `<path d="M59.200 43.600A15 3.600 -18 0 0 30.800 52.400" stroke="#e8c79a" stroke-width="1.500" opacity="0.7"/>`;
  s += `<circle cx="45" cy="48" r="7.600" fill="${radial(42.5, 45.5, 9, [[0, "#ffc9a0"], [0.6, "#ff9d7a"], [1, "#b8553f"]])}"/>`;
  s += `<path d="M38.200 45.800q6.800 -2.600 13.400 0.200M38 49.500q7 2 14 -0.400" stroke="#ffd9b8" stroke-width="1.100" stroke-linecap="round" opacity="0.6"/>`;
  s += `<path d="M30.800 52.400A15 3.600 -18 0 0 59.200 43.600" stroke="#ffe0b8" stroke-width="1.600"/>`;
  s += `</g>`;
  s += `<path d="M30 37A18 18 0 0 1 46 28" stroke="#ffffff" stroke-width="2.200" stroke-linecap="round" opacity="0.28"/>`;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    s += `<circle cx="${n(44 + Math.cos(a) * 22.5)}" cy="${n(46 + Math.sin(a) * 22.5)}" r="1.200" fill="${c("#5a5e84")}"/><circle cx="${n(44 + Math.cos(a) * 22.5 - 0.3)}" cy="${n(46 + Math.sin(a) * 22.5 - 0.3)}" r="0.500" fill="${c("#e9ebfa")}"/>`;
  }

  // A glass shelf of bottles, each lit from inside, on steel brackets.
  s += `<path d="M86 64v6l5 -6ZM148 64v6l-5 -6Z" fill="${c("#6b6f94")}"/>`;
  const bottles: [number, number, number, string][] = [[87, 20, 7, cyan], [99, 15, 8, "#ffd166"], [111, 24, 6.5, pink], [123, 17, 8, "#9dff8a"], [136, 21, 7, "#b79dff"]];
  for (const [x, hgt, w, color] of bottles) {
    const top = 62 - hgt;
    s += halo(x + w / 2, 62 - hgt / 2, 11, color, glow * 0.7);
    s += `<rect x="${n(x + w / 2 - 1.2)}" y="${n(top - 5.5)}" width="2.400" height="6" fill="${c("#c9cce6")}" opacity="0.8"/><rect x="${n(x + w / 2 - 1.6)}" y="${n(top - 7)}" width="3.200" height="2.200" rx="0.800" fill="${c("#8f93b8")}"/>`;
    s += `<path d="M${n(x)} 62V${n(top + 3)}Q${n(x)} ${n(top)} ${n(x + w / 2 - 1.2)} ${n(top - 0.5)}H${n(x + w / 2 + 1.2)}Q${n(x + w)} ${n(top)} ${n(x + w)} ${n(top + 3)}V62Z" fill="${lin(x, 0, x + w, 0, [[0, toHex(mix(hex(color), [255, 255, 255], 0.35)), 0.55 + glow * 0.4], [1, toHex(mix(hex(color), [20, 10, 60], 0.35)), 0.6 + glow * 0.35]])}"/>`;
    s += `<rect x="${n(x + 1)}" y="${n(top + 3)}" width="1.100" height="${n(hgt - 6)}" rx="0.500" fill="#ffffff" opacity="0.55"/>`;
    s += `<rect x="${n(x + 0.6)}" y="${n(62 - hgt * 0.5)}" width="${n(w - 1.2)}" height="${n(hgt * 0.26)}" fill="${c("#f5f1ff")}" opacity="0.75"/>`;
  }
  s += `<rect x="80" y="62" width="72" height="2.600" rx="1.300" fill="${lin(0, 62, 0, 64.6, [[0, c("#e9ebfa")], [1, c("#8f93b8")]])}"/>`;

  // Checkerboard floor, and the counter's glow lying on it.
  for (let i = 0; i < 12; i++) s += `<path d="M${n(4 + i * 22)} 140L${n(12 + i * 21)} 133H${n(33 + i * 21)}L${n(26 + i * 22)} 140Z" fill="${c(i % 2 ? "#3a3d60" : "#c9cce6")}" opacity="${i % 2 ? 0.5 : 0.35}"/>`;
  s += `<path d="M8 140L22 128H214L228 140Z" fill="${lin(0, 128, 0, 140, [[0, cyan, glow * 0.3], [1, cyan, 0]])}"/>`;

  // The counter: fluted front panels, a kick plate, a neon strip under a thick rounded top.
  s += `<rect x="22" y="94" width="190" height="42" fill="${v("#3a3d66", "#1d1f3a", 94, 136)}"/>`;
  for (const x of [28, 76, 124, 172]) {
    const w = x === 172 ? 34 : 42;
    s += `<rect x="${x}" y="105" width="${w}" height="26" rx="2.500" fill="${v("#1a1c36", "#2a2d50", 105, 131)}"/><rect x="${x}" y="105" width="${w}" height="2" rx="1" fill="#05061a" opacity="0.5"/>`;
    for (let k = 1; k < 5; k++) s += `<rect x="${n(x + (w / 5) * k - 0.4)}" y="107" width="0.800" height="22" fill="${c("#454a78")}" opacity="0.6"/>`;
  }
  s += `<rect x="22" y="134" width="190" height="6" fill="${chrome("#8f93b8", 22, 212)}"/><rect x="22" y="134" width="190" height="1" fill="${c("#e9ebfa")}" opacity="0.6"/>`;
  s += `<rect x="22" y="94" width="190" height="5" fill="#05061a" opacity="0.35"/>`;
  s += neon("M26 101.500H208", cyan, glow, 1.5);
  s += `<rect x="13" y="86" width="208" height="8.500" rx="4.200" fill="${v("#fbf9ff", "#b9b4d6", 86, 94.5)}"/>`;
  s += `<rect x="16" y="87" width="202" height="1.400" rx="0.700" fill="#ffffff" opacity="0.8"/><rect x="14" y="92" width="206" height="1.200" rx="0.600" fill="${c("#8a86ad")}" opacity="0.7"/>`;
  if (look.rain) s += `<path d="M36 137.500h40M96 138.500h60M170 137.500h34" stroke="${cyan}" stroke-width="1.200" stroke-linecap="round" opacity="${n3(0.25 + glow * 0.35)}"/>`;

  // A tall fizzing drink: thick glass, ice, a straw.
  s += shadow(104, 87.5, 8, 1.4, 0.7) + halo(104, 76, 14, cyan, glow * 0.7);
  s += `<path d="M97.500 65H110.500L108.800 87H99.200Z" fill="${c("#e9f4ff")}" opacity="0.38"/>`;
  s += `<path d="M98.200 71H109.800L108.800 87H99.200Z" fill="${lin(98, 0, 110, 0, [[0, "#b8fbff", 0.6 + glow * 0.35], [1, "#25b9d6", 0.65 + glow * 0.3]])}"/>`;
  s += `<rect x="100.500" y="72.500" width="3.600" height="3.600" rx="0.800" fill="#ffffff" opacity="0.55" transform="rotate(14 102 74)"/><rect x="104.600" y="74.500" width="3.200" height="3.200" rx="0.800" fill="#ffffff" opacity="0.45" transform="rotate(-10 106 76)"/>`;
  s += `<path d="M106 85.500L111.500 58" stroke="${c(pink)}" stroke-width="1.500" stroke-linecap="round"/>`;
  s += `<path d="M99 67.500L100 85" stroke="#ffffff" stroke-width="0.900" stroke-linecap="round" opacity="0.6"/><ellipse cx="104" cy="65" rx="6.500" ry="1.100" stroke="${c("#e9f4ff")}" stroke-width="0.700" opacity="0.8"/>`;
  for (const [bx, by, d] of [[102, 83, 0], [105.5, 80, 1.2], [103, 78, 2.1]] as const) s += `<circle${p.move("bubble", undefined, d)} cx="${bx}" cy="${by}" r="0.900" fill="#ffffff" opacity="0.85"/>`;

  // A chrome shaker.
  s += shadow(126, 87.5, 4.5, 1, 0.7);
  s += `<path d="M123 87V78Q123 76 126 76Q129 76 129 78V87Z" fill="${chrome("#b9bdd9", 123, 129)}"/><rect x="122.600" y="74.600" width="6.800" height="2.400" rx="1.100" fill="${chrome("#e9ebfa", 122, 130)}"/>`;

  // A steaming bowl of noodles: broth, egg, greens, a swirl of fish cake, chopsticks.
  s += shadow(158, 88, 21, 2);
  s += steam(p, 151, 66, c("#ffffff"));
  s += `<path d="M168 73L190 56.500M172 74L195 59.500" stroke="${lin(168, 0, 195, 0, [[0, c("#c99a5e")], [1, c("#f0d0a0")]])}" stroke-width="1.600" stroke-linecap="round"/>`;
  s += `<path d="M138.500 75Q140.500 88 152 88H164Q175.500 88 177.500 75Z" fill="${lin(139, 0, 178, 0, [[0, c("#ffffff")], [0.6, c("#ebe7f5")], [1, c("#b9b4d6")]])}"/>`;
  s += `<path d="M139.600 79.500Q158 84 176.400 79.500" stroke="${c(pink)}" stroke-width="2" opacity="0.9"/><path d="M140.400 82.800Q158 87 175.600 82.800" stroke="${c("#5b7fd6")}" stroke-width="0.800" opacity="0.8"/>`;
  s += `<rect x="150" y="87.200" width="16" height="1.800" rx="0.900" fill="${c("#b9b4d6")}"/>`;
  s += `<ellipse cx="158" cy="75" rx="19.500" ry="4.800" fill="${c("#f5f1ff")}"/><ellipse cx="158" cy="75.300" rx="17.500" ry="3.800" fill="${radial(156, 74, 18, [[0, c("#ffd98a")], [1, c("#d98a3a")]])}"/>`;
  s += `<path d="M145 75q3.500 -3.500 7 0t7 0t7 0M148 77q3.500 -2.500 7 0t7 0" stroke="${c("#fff0c2")}" stroke-width="1.200" stroke-linecap="round" opacity="0.9"/>`;
  s += `<ellipse cx="149" cy="73.600" rx="3.400" ry="2.200" fill="${c("#fffaf0")}"/><ellipse cx="149.300" cy="73.700" rx="1.600" ry="1.100" fill="${c("#ffab2e")}"/>`;
  s += `<circle cx="166" cy="74.400" r="2.600" fill="${c("#fffaf0")}"/><path d="M164.700 74.400a1.300 1.300 0 1 1 1.300 1.300" stroke="${c(pink)}" stroke-width="0.700"/>`;
  s += `<path d="M156 72q3 -1.400 6 0M158 73.600q2 -1 4.400 0" stroke="${c("#4f9a52")}" stroke-width="1.600" stroke-linecap="round"/>`;

  // Stools: a padded seat with piping, a chrome column with a foot ring, a domed base.
  for (const x of [56, 128]) {
    s += shadow(x, 138.5, 14, 2.2);
    s += `<path d="M${x - 11} 138.500Q${x - 11} 135 ${x} 135Q${x + 11} 135 ${x + 11} 138.500Z" fill="${chrome("#9a9ec0", x - 11, x + 11)}"/>`;
    s += `<rect x="${n(x - 1.9)}" y="118" width="3.800" height="18" fill="${chrome("#b9bdd9", x - 2, x + 2)}"/>`;
    s += `<ellipse cx="${x}" cy="128.500" rx="7.500" ry="1.800" stroke="${c("#c9cce6")}" stroke-width="1.300"/>`;
    s += `<rect x="${n(x - 12.5)}" y="117" width="25" height="2.800" rx="1.400" fill="${chrome("#c9cce6", x - 12, x + 12)}"/>`;
    s += `<path d="M${x - 14} 117Q${x - 14} 109.500 ${x - 8} 109.500H${x + 8}Q${x + 14} 109.500 ${x + 14} 117Z" fill="${lin(0, 109, 0, 117, [[0, c(pink, 0.3)], [1, c(pink, -0.3)]])}"/>`;
    s += `<path d="M${x - 10} 111.300H${x + 6}" stroke="#ffffff" stroke-width="1.300" stroke-linecap="round" opacity="0.45"/><path d="M${x - 14} 116.400H${x + 14}" stroke="${c("#ffd0e6")}" stroke-width="0.700" opacity="0.8"/>`;
  }

  // The robot waiter, hovering with a tray.
  s += `<ellipse${p.move("shadow", [243, 137.5])} cx="243" cy="137.500" rx="14" ry="2.600" fill="${cyan}" opacity="${n3(0.2 + glow * 0.3)}"/>`;
  s += `<g${p.move("float")}>`;
  s += `<path d="M235.500 124.500L239 132.500H247L250.500 124.500Z" fill="${chrome("#8f93b8", 235, 251)}"/>` + halo(243, 133.5, 9, cyan, glow) + `<ellipse cx="243" cy="133" rx="4.600" ry="1.600" fill="${cyan}" opacity="${n3(0.65 + glow * 0.35)}"/>`;
  s += `<path d="M243 64V56" stroke="${c("#8f93b8")}" stroke-width="1.400"/>` + halo(243, 55, 7, pink, glow) + `<circle${p.move("twinkle", undefined, 0, 2.4)} cx="243" cy="55" r="2.300" fill="${radial(242.4, 54.4, 2.6, [[0, "#ffd0e6"], [1, pink]])}"/>`;
  // Arm behind the body, holding the tray.
  s += `<path d="M229 104Q219 106.500 218.500 97" stroke="${c("#8f93b8")}" stroke-width="3.400" stroke-linecap="round"/><path d="M228.600 103Q219.800 105 219.400 97.500" stroke="${c("#e9ebfa")}" stroke-width="0.900" stroke-linecap="round" opacity="0.7"/>`;
  // Body: a shaded capsule with a seam, a chest light and a bow tie.
  s += `<rect x="226.500" y="93.500" width="33" height="32.500" rx="12.500" fill="${lin(226, 0, 260, 0, [[0, c("#ffffff")], [0.45, c("#e3e6f5")], [1, c("#9a9ec0")]])}"/>`;
  s += `<path d="M227 113H259.500Q259.500 126 247 126H239Q227 126 227 113Z" fill="#1a1c40" opacity="0.14"/><path d="M227.500 112.500H259" stroke="${c("#8f93b8")}" stroke-width="0.700" opacity="0.8"/>`;
  s += `<circle cx="243" cy="118.500" r="2.400" fill="${c("#3a3d60")}"/><circle${p.move("twinkle", undefined, 1, 3)} cx="243" cy="118.500" r="1.400" fill="${cyan}" opacity="${n3(0.6 + glow * 0.4)}"/>`;
  s += `<path d="M237.500 102.500l5.500 3.200l5.500 -3.200v7.600l-5.500 -3.200l-5.500 3.200Z" fill="${lin(0, 102, 0, 110, [[0, c(pink, 0.2)], [1, c(pink, -0.25)]])}"/><circle cx="243" cy="106.300" r="1.400" fill="${c(pink, -0.3)}"/>`;
  // Head: ear discs, a dark visor with a glare, two bright eyes.
  s += `<rect x="225.500" y="72.500" width="4" height="9" rx="2" fill="${c(pink)}"/><rect x="256.500" y="72.500" width="4" height="9" rx="2" fill="${c(pink, -0.25)}"/>`;
  s += `<rect x="228.500" y="63.500" width="29" height="27.500" rx="11.500" fill="${lin(228, 0, 258, 0, [[0, c("#ffffff")], [0.45, c("#e9ebfa")], [1, c("#a4a8c9")]])}"/>`;
  s += `<rect x="232" y="70.500" width="22" height="12" rx="6" fill="${v("#2a2d55", "#0f1028", 70, 83)}"/><path d="M235 72.500H246" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.3"/>`;
  s += halo(238.5, 76.5, 4.5, cyan, 0.5 + glow * 0.5) + halo(247.5, 76.5, 4.5, cyan, 0.5 + glow * 0.5);
  s += `<circle${p.move("blink-eye", [238.5, 76.5])} cx="238.500" cy="76.500" r="2.300" fill="${cyan}"/><circle${p.move("blink-eye", [247.5, 76.5])} cx="247.500" cy="76.500" r="2.300" fill="${cyan}"/>`;
  s += `<circle cx="237.800" cy="75.800" r="0.700" fill="#ffffff"/><circle cx="246.800" cy="75.800" r="0.700" fill="#ffffff"/>`;
  s += `<path d="M239.500 86q3.500 1.800 7 0" stroke="${c("#8f93b8")}" stroke-width="1.100" stroke-linecap="round"/>`;
  // Tray and cup.
  s += `<rect x="205" y="93.200" width="26" height="2.800" rx="1.400" fill="${chrome("#c9cce6", 205, 231)}"/>`;
  s += `<path d="M210.500 83.500H221.500L220 93.200H212Z" fill="${h("#fffaf0", "#d9cdb8", 210, 222)}"/><rect x="210" y="82.200" width="12" height="2.600" rx="1.300" fill="${c(pink)}"/>`;
  s += `</g>`;
  return s;
}

function restaurantOverhead(p: Paint, width: number): string {
  const { c, chrome, glow } = p;
  const r = rng(17);
  const cyan = "#5ef2ff";
  const pink = "#ff6fb5";
  const gold = "#ffd166";
  const end = Math.max(240, width - 200);
  // The ceiling rail: a steel channel with a neon line set into its underside.
  let s = `<rect x="-4" y="-2" width="${n(end + 4)}" height="6" rx="3" fill="${lin(0, -2, 0, 4, [[0, c("#6b6f94")], [1, c("#2a2d50")]])}"/>`;
  s += `<rect x="0" y="-0.600" width="${n(end - 4)}" height="1" fill="${c("#c9cce6")}" opacity="0.45"/>`;
  s += neon(`M6 5.500H${n(end - 10)}`, pink, glow, 1.1);
  const slot = 118;
  const count = Math.max(2, Math.floor(end / slot));
  const gap = end / count;
  let signs = 0;
  for (let i = 0; i < count; i++) {
    const x = gap * (i + 0.5);
    const kind = i % 2 === 0 ? "lamp" : signs++ % 3 === 1 ? "drone" : "sign";
    if (kind !== "drone") s += `<rect x="${n(x - (kind === "sign" ? 24 : 4))}" y="1" width="${kind === "sign" ? 48 : 8}" height="4" rx="1.500" fill="${c("#454a78")}"/>`;
    if (kind === "lamp") {
      const drop = 12 + r() * 14;
      const color = [gold, cyan, pink][i % 3]!;
      const lit = toHex(mix(hex(color), [255, 255, 255], 0.3 + glow * 0.4));
      let l = `<path d="M${n(x)} 4V${n(drop)}" stroke="${c("#2a2d50")}" stroke-width="1.400"/>`;
      l += beam(x, drop + 10, 7, 24, 72, color, glow * 0.26);
      l += halo(x, drop + 11, 21, color, glow);
      // A spun-metal shade: bright where the room catches it, a coloured band, a rolled lip.
      l += `<path d="M${n(x - 2.6)} ${n(drop - 3)}H${n(x + 2.6)}V${n(drop)}H${n(x - 2.6)}Z" fill="${chrome("#8f93b8", x - 3, x + 3)}"/>`;
      l += `<path d="M${n(x - 15.5)} ${n(drop + 9)}Q${n(x - 13)} ${n(drop)} ${n(x)} ${n(drop - 1)}Q${n(x + 13)} ${n(drop)} ${n(x + 15.5)} ${n(drop + 9)}Z" fill="${chrome("#c9cce6", x - 15, x + 15)}"/>`;
      l += `<path d="M${n(x - 14.6)} ${n(drop + 6.4)}Q${n(x)} ${n(drop + 3.6)} ${n(x + 14.6)} ${n(drop + 6.4)}" stroke="${c(color, -0.1)}" stroke-width="1.400" opacity="0.9"/>`;
      l += `<rect x="${n(x - 16.5)}" y="${n(drop + 8.2)}" width="33" height="2.600" rx="1.300" fill="${chrome("#e9ebfa", x - 16, x + 16)}"/>`;
      l += `<ellipse cx="${n(x)}" cy="${n(drop + 11.4)}" rx="8" ry="2.600" fill="${radial(x, drop + 11, 8, [[0, "#ffffff", 0.7 + glow * 0.3], [1, lit, 0.55 + glow * 0.4]])}"/>`;
      s += `<g${p.move("sway", [x, 4], r() * 6, 9 + r() * 4)}>${l}</g>`;
    } else if (kind === "sign") {
      const y = 22 + r() * 6;
      // A dark backing plate on two rods, with the tubes standing off it.
      let g = `<path d="M${n(x - 20)} 4V${n(y - 9)}M${n(x + 20)} 4V${n(y - 9)}" stroke="${c("#2a2d50")}" stroke-width="1.200"/>`;
      g += `<rect x="${n(x - 29)}" y="${n(y - 11)}" width="60" height="40" rx="6" fill="${lin(0, y - 11, 0, y + 29, [[0, "#1d1f3a", 0.82], [1, "#0d0e22", 0.86]])}"/>`;
      g += `<rect x="${n(x - 28.2)}" y="${n(y - 10.2)}" width="58.400" height="38.400" rx="5.400" stroke="${c("#6b6f94")}" stroke-width="0.800" opacity="0.7"/>`;
      for (const [dx, dy] of [[-25, -7], [27, -7], [-25, 25], [27, 25]] as const) g += `<circle cx="${n(x + dx)}" cy="${n(y + dy)}" r="0.900" fill="${c("#c9cce6")}"/>`;
      if (signs % 2 === 1) {
        // A noodle bowl in neon tubes, steam and all.
        g += neon(`M${n(x - 20)} ${n(y + 8)}H${n(x + 20)}Q${n(x + 18)} ${n(y + 22)} ${n(x + 6)} ${n(y + 23)}H${n(x - 6)}Q${n(x - 18)} ${n(y + 22)} ${n(x - 20)} ${n(y + 8)}Z`, pink, glow, 1.6);
        g += neon(`M${n(x + 4)} ${n(y + 6)}L${n(x + 19)} ${n(y - 5)}M${n(x + 10)} ${n(y + 6)}L${n(x + 24)} ${n(y - 2)}`, gold, glow, 1.4);
        g += `<g${p.move("twinkle", undefined, 1, 2.8)}>${neon(`M${n(x - 11)} ${n(y + 3)}q-3 -4 0 -7.500M${n(x - 3)} ${n(y + 3)}q-3 -4 0 -7.500`, cyan, glow, 1.3)}</g>`;
      } else {
        // A ringed planet with a star.
        g += neon(`M${n(x - 9)} ${n(y + 10)}a9 9 0 1 1 18 0a9 9 0 1 1 -18 0`, cyan, glow, 1.6);
        g += neon(`M${n(x - 20)} ${n(y + 15)}Q${n(x)} ${n(y + 3)} ${n(x + 20)} ${n(y + 5)}`, gold, glow, 1.4);
        g += `<g${p.move("twinkle", undefined, 0.5, 2.2)}>${neon(`M${n(x + 19)} ${n(y - 6)}v7M${n(x + 15.5)} ${n(y - 2.5)}h7`, pink, glow, 1.3)}</g>`;
      }
      s += `<g${p.move("sway", [x, 4], r() * 5, 12)}>${g}</g>`;
    } else {
      // A little serving drone carrying a covered dish.
      const y = 30;
      let d = halo(x, y + 10, 14, cyan, glow);
      d += `<ellipse cx="${n(x)}" cy="${n(y + 10)}" rx="6" ry="1.800" fill="${cyan}" opacity="${n3(0.6 + glow * 0.4)}"/>`;
      d += `<path d="M${n(x - 18)} ${n(y + 4)}Q${n(x)} ${n(y + 13)} ${n(x + 18)} ${n(y + 4)}Z" fill="${chrome("#8f93b8", x - 18, x + 18)}"/>`;
      d += `<ellipse cx="${n(x)}" cy="${n(y + 4)}" rx="18" ry="3.600" fill="${lin(x - 18, 0, x + 18, 0, [[0, c("#ffffff")], [0.5, c("#e3e6f5")], [1, c("#9a9ec0")]])}"/>`;
      d += `<path d="M${n(x - 9.5)} ${n(y + 2.8)}Q${n(x - 8.5)} ${n(y - 7.5)} ${n(x)} ${n(y - 8)}Q${n(x + 8.5)} ${n(y - 7.5)} ${n(x + 9.5)} ${n(y + 2.8)}Z" fill="${chrome("#e9ebfa", x - 9, x + 9)}"/>`;
      d += `<path d="M${n(x - 6.4)} ${n(y - 1)}Q${n(x - 5.6)} ${n(y - 5.4)} ${n(x - 2.4)} ${n(y - 6.4)}" stroke="#ffffff" stroke-width="1.100" stroke-linecap="round" opacity="0.8"/><circle cx="${n(x)}" cy="${n(y - 9.2)}" r="1.800" fill="${c(pink)}"/>`;
      d += `<circle${p.move("twinkle", undefined, 0, 1.6)} cx="${n(x - 13.5)}" cy="${n(y + 4.4)}" r="1.300" fill="${pink}"/><circle${p.move("twinkle", undefined, 0.8, 1.6)} cx="${n(x + 13.5)}" cy="${n(y + 4.4)}" r="1.300" fill="${gold}"/>`;
      s += `<g${p.move("hover", undefined, r() * 4)}>${d}</g>`;
    }
  }
  return s;
}

function restaurantBackdrop(p: Paint): string {
  const { look, glow } = p;
  const r = rng(13);
  const ink = hex(look.dark ? "#06051a" : "#221a4a");
  const bottom = hex(look.sky[2]);
  const lights = ["#5ef2ff", "#ff6fb5", "#ffd166"];
  let s = "";
  // A huge ringed planet low on the horizon: lit from the upper left, banded, its ring
  // passing behind and then in front of it.
  const lit = toHex(mix(bottom, hex("#ffd9b0"), 0.6));
  const body = toHex(mix(bottom, hex("#ff9d7a"), 0.5));
  const dark = toHex(mix(bottom, ink, 0.35));
  const ring = toHex(mix(bottom, hex("#ffe6c4"), 0.6));
  s += `<path d="M569.100 610.200A330 46 -14 0 0 -70.200 769.800" stroke="${ring}" stroke-width="10" opacity="0.4"/>`;
  s += `<circle cx="250" cy="690" r="210" fill="${radial(170, 600, 330, [[0, lit, 0.75], [0.55, body, 0.7], [1, dark, 0.7]])}"/>`;
  s += `<path d="M58 610Q250 560 440 604M44 668Q250 624 458 662M56 730Q250 694 448 724" stroke="${lit}" stroke-width="13" stroke-linecap="round" opacity="0.2"/>`;
  s += `<path d="M48 640Q250 594 452 634M48 700Q250 660 456 694" stroke="${dark}" stroke-width="8" stroke-linecap="round" opacity="0.22"/>`;
  s += `<path d="M-70.200 769.800A330 46 -14 0 0 569.100 610.200" stroke="${ring}" stroke-width="10" opacity="0.62"/><path d="M-84 784A346 52 -14 0 0 584 598" stroke="${ring}" stroke-width="3" opacity="0.4"/>`;
  // A small moon with craters.
  const moon = toHex(mix(bottom, hex("#d9ccff"), 0.55));
  s += `<circle cx="930" cy="520" r="27" fill="${radial(922, 511, 34, [[0, toHex(mix(hex(moon), [255, 255, 255], 0.4)), 0.8], [1, toHex(mix(hex(moon), ink, 0.4)), 0.7]])}"/>`;
  s += `<circle cx="922" cy="514" r="5" fill="${dark}" opacity="0.2"/><circle cx="938" cy="528" r="6.500" fill="${dark}" opacity="0.18"/><circle cx="940" cy="508" r="3" fill="${dark}" opacity="0.18"/>`;

  const spires = (min: number, max: number, depth: number, litRate: number) => {
    const color = toHex(mix(bottom, ink, depth));
    const side = toHex(mix(bottom, ink, Math.min(1, depth + 0.14)));
    let x = -10;
    while (x < 1210) {
      const w = 22 + r() * 46;
      const hgt = min + r() * (max - min);
      const top = 800 - hgt;
      const style = r();
      const cx = x + w / 2;
      if (style < 0.4) {
        // Round-shouldered tower.
        s += `<path d="M${n(x)} 800V${n(top + w / 2)}Q${n(x)} ${n(top)} ${n(cx)} ${n(top)}Q${n(x + w)} ${n(top)} ${n(x + w)} ${n(top + w / 2)}V800Z" fill="${color}"/>`;
        s += `<path d="M${n(cx + w * 0.16)} 800V${n(top + 2)}Q${n(x + w)} ${n(top + 4)} ${n(x + w)} ${n(top + w / 2)}V800Z" fill="${side}"/>`;
      } else if (style < 0.75) {
        // Needle.
        s += `<path d="M${n(x)} 800V${n(top + 30)}L${n(cx)} ${n(top)}L${n(x + w)} ${n(top + 30)}V800Z" fill="${color}"/><path d="M${n(cx)} 800V${n(top)}L${n(x + w)} ${n(top + 30)}V800Z" fill="${side}"/>`;
      } else {
        // A stem carrying a saucer deck.
        s += `<rect x="${n(x + w * 0.2)}" y="${n(top)}" width="${n(w * 0.6)}" height="${n(hgt)}" fill="${color}"/><rect x="${n(x + w * 0.56)}" y="${n(top)}" width="${n(w * 0.24)}" height="${n(hgt)}" fill="${side}"/>`;
        s += `<ellipse cx="${n(cx)}" cy="${n(top + 5)}" rx="${n(w * 0.85)}" ry="7.500" fill="${color}"/><ellipse cx="${n(cx)}" cy="${n(top + 7.5)}" rx="${n(w * 0.85)}" ry="5" fill="${side}"/>`;
        if (litRate) s += `<path d="M${n(cx - w * 0.6)} ${n(top + 5)}H${n(cx + w * 0.6)}" stroke="${lights[Math.floor(r() * 3)]}" stroke-width="1.600" stroke-dasharray="3 3" stroke-linecap="round" opacity="${n3(glow * 0.8)}"/>`;
      }
      if (look.snow) s += `<ellipse cx="${n(cx)}" cy="${n(top + 5)}" rx="${n(w * 0.34)}" ry="2.600" fill="${p.snow}" opacity="0.8"/>`;
      s += `<rect x="${n(cx - 0.7)}" y="${n(top - 22)}" width="1.400" height="24" fill="${color}"/><circle${p.move("twinkle", undefined, r() * 4, 2 + r() * 2)} cx="${n(cx)}" cy="${n(top - 22)}" r="2.200" fill="${lights[Math.floor(r() * 3)]}" opacity="${n3(glow)}"/>`;
      if (litRate) {
        const color2 = lights[Math.floor(r() * 3)]!;
        for (let wy = top + 36; wy < 790; wy += 12) if (r() < litRate) s += `<rect x="${n(x + w * 0.24)}" y="${n(wy)}" width="${n(w * 0.34)}" height="2.600" rx="1.300" fill="${color2}" opacity="${n3(glow * (0.35 + r() * 0.5))}"/>`;
      }
      x += w + 4 + r() * 22;
    }
  };
  spires(190, 400, 0.16, 0);
  s += `<rect x="0" y="430" width="1200" height="370" fill="${lin(0, 430, 0, 800, [[0, look.sky[2], 0], [1, look.sky[2], 0.5]])}"/>`;
  spires(110, 300, 0.34, 0.24);
  s += `<rect x="0" y="560" width="1200" height="240" fill="${lin(0, 560, 0, 800, [[0, look.sky[2], 0], [1, look.sky[2], 0.28]])}"/>`;
  spires(50, 190, 0.62, 0.42);
  // Traffic: little craft with running lights and a faint trail.
  const craft = toHex(mix(bottom, ink, 0.62));
  for (let i = 0; i < 7; i++) {
    const x = 80 + r() * 1040;
    const y = 400 + r() * 200;
    const color = lights[i % 3]!;
    const left = i % 2 === 1;
    const trail: Stop[] = left ? [[0, color, 0.5 * glow], [1, color, 0]] : [[0, color, 0], [1, color, 0.5 * glow]];
    s += `<g${p.move(left ? "fly-left" : "fly-right", undefined, r() * 30, 38 + r() * 30)}>`;
    s += `<rect x="${n(left ? x + 13 : x - 26)}" y="${n(y + 1)}" width="26" height="1" fill="${lin(left ? x + 13 : x - 26, 0, left ? x + 39 : x, 0, trail)}"/>`;
    s += `<path d="M${n(x)} ${n(y + 3)}Q${n(x + 6.5)} ${n(y - 2.4)} ${n(x + 13)} ${n(y + 3)}Z" fill="${craft}"/><rect x="${n(x - 1)}" y="${n(y + 2.4)}" width="15" height="1.800" rx="0.900" fill="${craft}"/>`;
    s += `<circle cx="${n(left ? x - 0.6 : x + 13.6)}" cy="${n(y + 3.2)}" r="1.700" fill="${color}" opacity="${n3(0.4 + glow * 0.6)}"/></g>`;
  }
  return s;
}

// ---- public ------------------------------------------------------------------------------

export const SCENE_CORNER = { width: 272, height: 140 } as const;
export const SCENE_OVERHEAD_HEIGHT = 96;

/** The vignette for the bottom of the sidebar (272 x 140). */
export function sceneCorner(id: SceneId, look: SceneLook): SceneArt {
  const p = paint(look);
  return draw(SCENE_CORNER.width, SCENE_CORNER.height, "xMidYMax meet", () =>
    id === "workstation" ? workstationCorner(p) : id === "forest" ? forestCorner(p) : restaurantCorner(p),
  );
}

/** What hangs from the top of the window, drawn for a window `width` px wide. */
export function sceneOverhead(id: SceneId, look: SceneLook, width: number): SceneArt {
  const p = paint(look);
  const w = Math.max(320, Math.round(width));
  return draw(w, SCENE_OVERHEAD_HEIGHT, "xMinYMin meet", () =>
    id === "workstation" ? workstationOverhead(p, w) : id === "forest" ? forestOverhead(p, w) : restaurantOverhead(p, w),
  );
}

/** Silhouettes on the horizon, behind everything (1200 x 800; scale to cover, anchored to the bottom). */
export function sceneBackdrop(id: SceneId, look: SceneLook): SceneArt {
  const p = paint(look);
  return draw(1200, 800, "xMidYMax slice", () => (id === "workstation" ? workstationBackdrop(p) : id === "forest" ? forestBackdrop(p) : restaurantBackdrop(p)));
}
