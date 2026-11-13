// Themes: small illustrated worlds that live with the sky. Each has three drawings: a
// backdrop (silhouettes far behind the glass, in the sky's own colors), an overhead piece
// hanging from the top of the window, and a corner vignette that sits at the bottom of the
// sidebar (or in the corner of the phone's sky card).
//
// The drawings are plain SVG text built from the sky as it is now: they dim as the light
// goes, their lamps and windows come on at night, snow settles on them and an umbrella comes
// out in the rain. Colors are baked in (no CSS variables), so the same text renders in a
// browser and in react-native-svg. With `animated`, moving parts carry `lm-*` classes that
// the desktop styles; the phone leaves them out.

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

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Paint {
  /** A surface color as lit right now. */
  c: (color: string, lift?: number) => string;
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
  return {
    c: (color, lift = 0) => toHex(scale(mix(mix(hex(color), dusk, k), [255, 255, 255], lift), dim)),
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

const wrap = (width: number, height: number, body: string, aspect = "xMidYMid meet"): SceneArt => ({
  width,
  height,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" preserveAspectRatio="${aspect}" fill="none">${body}</svg>`,
});

/** A pointed leaf from (x, y), `len` long, turned `angle` degrees. */
const leaf = (x: number, y: number, len: number, angle: number, fill: string, fat = 0.42) =>
  `<path d="M0 0Q${n(len / 2)} ${n(-len * fat)} ${n(len)} 0Q${n(len / 2)} ${n(len * fat)} 0 0Z" fill="${fill}" transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})"/>`;

const n3 = (v: number) => +Math.max(0, Math.min(1, v)).toFixed(3);

/** Gradient ids must be unique across every drawing on the page. */
let gradients = 0;

/** A soft light: a radial fade, which both the browser and react-native-svg can draw. */
function halo(x: number, y: number, r: number, color: string, strength: number) {
  const id = `lm-h${++gradients}`;
  return (
    `<defs><radialGradient id="${id}" cx="${n(x)}" cy="${n(y)}" r="${n(r)}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${color}" stop-opacity="${n3(strength * 0.6)}"/><stop offset="0.4" stop-color="${color}" stop-opacity="${n3(strength * 0.22)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>` +
    `</radialGradient></defs><circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="url(#${id})"/>`
  );
}

/** A cone of lamplight from (x, y) down to `bottom`, fading out as it falls. */
function beam(x: number, y: number, top: number, spread: number, bottom: number, color: string, strength: number) {
  const id = `lm-b${++gradients}`;
  return (
    `<defs><linearGradient id="${id}" x1="0" y1="${n(y)}" x2="0" y2="${n(bottom)}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${color}" stop-opacity="${n3(strength)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>` +
    `<path d="M${n(x - top)} ${n(y)}L${n(x - spread)} ${n(bottom)}H${n(x + spread)}L${n(x + top)} ${n(y)}Z" fill="url(#${id})"/>`
  );
}

/** A trailing vine hanging from (x, y): a swaying stem with leaves down both sides. */
function vine(p: Paint, r: () => number, x: number, y: number, length: number, greens: string[], blossom?: string) {
  const bend = (r() - 0.5) * 16;
  const end = { x: x + bend, y: y + length };
  let out = `<path d="M${n(x)} ${n(y)}Q${n(x - bend * 0.6)} ${n(y + length * 0.55)} ${n(end.x)} ${n(end.y)}" stroke="${greens[0]}" stroke-width="1.2" stroke-linecap="round"/>`;
  const count = Math.max(3, Math.round(length / 7));
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 0.4);
    // Point on the quadratic.
    const qx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x - bend * 0.6) + t * t * end.x;
    const qy = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + length * 0.55) + t * t * end.y;
    const side = i % 2 ? 1 : -1;
    out += leaf(qx, qy, 5.5 + r() * 3.5, 90 - side * (52 + r() * 22), greens[i % greens.length]!, 0.5);
  }
  if (blossom) out += flower(end.x, end.y + 1, 3.4, blossom, p.c("#ffe9a8"));
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
  const { c, glow } = p;
  const wood = c("#c0895a");
  const woodDark = c("#8e6040");
  const screenLit = toHex(mix(hex("#dfe8f2"), hex("#a8d4ff"), p.night));
  let s = "";
  // Lamp light falling on the desk.
  s += `<path d="M45 52L18 104H92Z" fill="#ffd58a" opacity="${n3(glow * 0.2)}"/>`;
  s += halo(47, 56, 30, "#ffd58a", glow * 0.9);
  // Screen glow on the wall behind.
  s += halo(120, 66, 62, screenLit, glow * 0.55);
  // The umbrella comes out when it rains: leaning on the desk leg, still dripping.
  if (p.look.rain) {
    s += `<path d="M21 138L33 100" stroke="${c("#4a4458")}" stroke-width="1.6" stroke-linecap="round"/>`;
    s += `<path d="M22.5 133Q14 118 30.5 102Q40 112 29.5 135Z" fill="${c(p.look.accent)}"/>`;
    s += `<path d="M33 100q3 -5 6.5 -2.5" stroke="${c("#4a4458")}" stroke-width="1.8" stroke-linecap="round"/>`;
    s += `<ellipse cx="22" cy="139" rx="9" ry="1.6" fill="${c("#9fc3e8")}" opacity="0.5"/>`;
  }
  // Desk.
  s += `<rect x="40" y="111" width="6" height="29" fill="${woodDark}"/><rect x="232" y="111" width="6" height="29" fill="${woodDark}"/>`;
  s += `<rect x="188" y="111" width="50" height="29" rx="2" fill="${c("#a87750")}"/>`;
  s += `<rect x="193" y="116" width="40" height="9" rx="2" fill="${woodDark}"/><rect x="193" y="128" width="40" height="9" rx="2" fill="${woodDark}"/>`;
  s += `<circle cx="213" cy="120.500" r="1.4" fill="${c("#e8c79a")}"/><circle cx="213" cy="132.500" r="1.4" fill="${c("#e8c79a")}"/>`;
  s += `<rect x="12" y="104" width="248" height="7" rx="3.5" fill="${wood}"/>`;
  s += `<rect x="12" y="104" width="248" height="2.4" rx="1.2" fill="${c("#d9a676")}"/>`;
  // Lamp.
  s += `<rect x="24" y="100" width="24" height="4" rx="2" fill="${c("#3f4257")}"/>`;
  s += `<path d="M36 100L29 74L43 57" stroke="${c("#3f4257")}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<circle cx="29" cy="74" r="2.6" fill="${c("#5a5e78")}"/>`;
  s += `<path d="M36 50L55 55L52 66Q43 68 34 60Z" fill="${c(p.look.accent)}"/>`;
  s += `<ellipse cx="43.500" cy="63" rx="8.500" ry="3" fill="#fff1c4" opacity="${n3(0.35 + glow * 0.65)}" transform="rotate(14 43.500 63)"/>`;
  // Monitor.
  s += `<rect x="116" y="88" width="8" height="14" fill="${c("#4a4d63")}"/><rect x="104" y="100" width="32" height="4" rx="2" fill="${c("#454a66", 0.06)}"/>`;
  s += `<rect x="80" y="40" width="80" height="52" rx="6" fill="${c("#454a66", 0.06)}"/>`;
  s += `<rect x="84" y="44" width="72" height="40" rx="3.5" fill="${toHex(mix(hex(c("#1d2233")), hex("#16203a"), 0.5))}"/>`;
  const lines: [number, number, number, string][] = [
    [89, 50, 18, p.look.accent],
    [110, 50, 26, "#8fb4ff"],
    [93, 56, 30, "#e8e6f0"],
    [93, 62, 14, "#7fe0b0"],
    [110, 62, 22, "#e8e6f0"],
    [97, 68, 34, "#ffb37a"],
    [93, 74, 20, "#e8e6f0"],
    [89, 80, 10, p.look.accent],
  ];
  for (const [x, y, w, color] of lines) s += `<rect x="${x}" y="${y}" width="${w}" height="2.6" rx="1.3" fill="${color}" opacity="${n3(0.5 + glow * 0.42)}"/>`;
  s += `<rect${p.move("blink")} x="116" y="74" width="2" height="3.4" fill="#ffffff" opacity="0.9"/>`;
  s += `<circle cx="120" cy="88" r="1" fill="#7fe0b0" opacity="${n3(0.4 + glow * 0.6)}"/>`;
  // Keyboard and mug.
  s += `<rect x="142" y="99" width="30" height="5" rx="2" fill="${c("#e6e2ee")}"/><rect x="145" y="100.200" width="24" height="1.400" rx="0.700" fill="${c("#b9b4c9")}"/>`;
  s += steam(p, 62, 84, c("#ffffff"));
  s += `<path d="M73 93q6.500 0 6.500 4.500t-6.500 4" stroke="${c("#f1ede4")}" stroke-width="2.2" stroke-linecap="round"/>`;
  s += `<path d="M58 88H74V99Q74 104 69 104H63Q58 104 58 99Z" fill="${c("#f1ede4")}"/>`;
  s += `<rect x="58" y="92" width="16" height="3" fill="${c(p.look.accent)}" opacity="0.85"/>`;
  // Books with the cat asleep on top.
  s += `<rect x="184" y="98" width="46" height="6" rx="1.500" fill="${c("#5b7fb8")}"/><rect x="187" y="92" width="40" height="6" rx="1.500" fill="${c("#d9785c")}"/>`;
  s += `<rect x="190" y="99.800" width="8" height="2.400" rx="1" fill="${c("#e8ecf5")}"/><rect x="215" y="93.800" width="6" height="2.400" rx="1" fill="${c("#f7e3c4")}"/>`;
  const cat = c("#3a3448");
  s += `<path d="M222 92q12 -1 11 -8q-0.500 -4 -4.500 -3" stroke="${cat}" stroke-width="3.2" stroke-linecap="round"/>`;
  s += `<path${p.move("breathe", [207, 92])} d="M190 92Q188 79 204 78Q222 77 225 92Z" fill="${cat}"/>`;
  s += `<path d="M188.500 92Q185 84 192 81.500L192.500 77L196.500 80.500Q199 80.300 200 81L203.500 78L203.800 83.500Q206 88 203 92Z" fill="${cat}"/>`;
  s += `<path d="M192.500 86.500q1.500 1.400 3 0M198 86.500q1.500 1.400 3 0" stroke="${c("#c9c2dd")}" stroke-width="0.9" stroke-linecap="round"/>`;
  // A leafy plant at the end of the desk.
  const g1 = c("#4f9a62");
  const g2 = c("#3a7d52");
  const g3 = c("#72b878");
  s += `<g${p.move("sway", [248, 90], 2, 9)}>`;
  s += leaf(248, 90, 26, -118, g2) + leaf(248, 90, 24, -62, g2) + leaf(248, 90, 30, -92, g1) + leaf(247, 90, 20, -146, g3) + leaf(249, 90, 19, -34, g3) + leaf(248, 90, 16, -78, g3, 0.5);
  s += `</g>`;
  s += `<path d="M239 88H257L254.500 104H241.500Z" fill="${c("#d27a52")}"/><rect x="237.500" y="86" width="21" height="4.500" rx="1.800" fill="${c("#e08e63")}"/>`;
  return s;
}

function workstationOverhead(p: Paint, width: number): string {
  const { c, glow } = p;
  const r = rng(11);
  const end = Math.max(220, width - 210);
  const span = 148;
  const pins = Math.max(2, Math.round(end / span) + 1);
  const step = end / (pins - 1);
  const bulbColors = ["#ffd98a", "#ffc37a", "#ffe6b0", "#ffb38a"];
  let wires = "";
  let bulbs = "";
  let plants = "";
  for (let i = 0; i < pins - 1; i++) {
    const x0 = 8 + i * step;
    const x1 = 8 + (i + 1) * step;
    const sag = 15 + r() * 9;
    const mx = (x0 + x1) / 2;
    wires += `<path d="M${n(x0)} 3Q${n(mx)} ${n(3 + sag * 2)} ${n(x1)} 3" stroke="${c("#4a4658")}" stroke-width="1.2" stroke-linecap="round"/>`;
    for (let j = 1; j <= 4; j++) {
      const t = j / 5;
      const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
      const by = (1 - t) * (1 - t) * 3 + 2 * (1 - t) * t * (3 + sag * 2) + t * t * 3;
      const color = bulbColors[(i + j) % bulbColors.length]!;
      bulbs += `<g${p.move("twinkle", undefined, r() * 5, 3.5 + r() * 3)}>${halo(bx, by + 6.5, 13, color, glow)}</g>`;
      bulbs += `<rect x="${n(bx - 1.6)}" y="${n(by - 0.5)}" width="3.200" height="3.600" rx="0.800" fill="${c("#5a5568")}"/>`;
      bulbs += `<circle cx="${n(bx)}" cy="${n(by + 6.5)}" r="3.900" fill="${toHex(mix(hex(c(color)), hex(color), 0.35 + glow * 0.65))}"/>`;
      bulbs += `<circle cx="${n(bx - 1.1)}" cy="${n(by + 5.4)}" r="1.100" fill="#ffffff" opacity="0.7"/>`;
    }
    // Every other pin holds a hanging planter with trailing vines.
    if (i % 2 === 1 || (pins <= 3 && i === 0)) {
      const px = x0 + (i === 0 ? step * 0.5 : 0);
      const py = 22 + r() * 5;
      const greens = [c("#3f8a58"), c("#5aa868"), c("#78bf7c")];
      let pl = `<path d="M${n(px)} 2L${n(px - 9)} ${n(py)}M${n(px)} 2L${n(px + 9)} ${n(py)}" stroke="${c("#8a8296")}" stroke-width="0.9"/>`;
      pl += vine(p, r, px - 7, py + 3, 16 + r() * 10, greens, r() > 0.45 ? c("#ffb3c8") : undefined);
      pl += vine(p, r, px + 7, py + 3, 12 + r() * 10, greens);
      pl += vine(p, r, px, py + 4, 22 + r() * 12, greens, c("#fff0f4"));
      for (let k = 0; k < 7; k++) pl += leaf(px + (k - 3) * 3, py + 1, 9 + r() * 5, -90 + (k - 3) * 24 + (r() - 0.5) * 14, greens[k % 3]!, 0.46);
      pl += `<path d="M${n(px - 10)} ${n(py)}H${n(px + 10)}L${n(px + 7)} ${n(py + 11)}H${n(px - 7)}Z" fill="${c(i % 4 === 1 ? "#f1ede4" : "#d27a52")}"/>`;
      pl += `<rect x="${n(px - 11)}" y="${n(py - 1.5)}" width="22" height="3.600" rx="1.500" fill="${c(i % 4 === 1 ? "#ffffff" : "#e08e63")}"/>`;
      plants += `<g${p.move("sway", [px, 2], r() * 6, 11)}>${pl}</g>`;
    }
  }
  return wires + plants + bulbs;
}

function workstationBackdrop(p: Paint): string {
  const { look } = p;
  const r = rng(5);
  const ink = hex(look.dark ? "#05060f" : "#262a4a");
  const bottom = hex(look.sky[2]);
  const far = toHex(mix(bottom, ink, 0.3));
  const near = toHex(mix(bottom, ink, 0.56));
  const lit = toHex(mix(hex("#ffd58a"), hex("#ffe9c0"), 0.3));
  let s = "";
  const row = (base: number, min: number, max: number, color: string, windows: number) => {
    let x = -10;
    while (x < 1210) {
      const w = 46 + r() * 70;
      const h = min + r() * (max - min);
      const top = base - h;
      s += `<rect x="${n(x)}" y="${n(top)}" width="${n(w)}" height="${n(h + 4)}" fill="${color}"/>`;
      if (r() > 0.6) s += `<rect x="${n(x + w * 0.3)}" y="${n(top - 14)}" width="${n(w * 0.34)}" height="16" fill="${color}"/>`;
      if (r() > 0.75) s += `<rect x="${n(x + w * 0.5)}" y="${n(top - 34)}" width="1.600" height="36" fill="${color}"/><circle cx="${n(x + w * 0.5 + 0.8)}" cy="${n(top - 34)}" r="2" fill="#ff8a7a" opacity="${n3(p.glow)}"/>`;
      if (look.snow) s += `<rect x="${n(x - 1)}" y="${n(top - 2)}" width="${n(w + 2)}" height="4" rx="2" fill="${p.snow}" opacity="0.85"/>`;
      if (windows) {
        for (let wy = top + 10; wy < base - 8; wy += 15) {
          for (let wx = x + 7; wx < x + w - 9; wx += 12) {
            if (r() < windows) s += `<rect x="${n(wx)}" y="${n(wy)}" width="5" height="7" rx="1" fill="${lit}" opacity="${n3(p.glow * (0.45 + r() * 0.55))}"/>`;
          }
        }
      }
      x += w + 2 + r() * 10;
    }
  };
  row(800, 120, 250, far, 0.16);
  row(800, 60, 170, near, 0.3);
  return s;
}

// ---- forest -----------------------------------------------------------------------------

function fern(p: Paint, r: () => number, x: number, y: number, len: number, angle: number, color: string, delay: number) {
  // A frond: a curved rib with leaflets that shrink toward the tip.
  let out = `<path d="M0 0Q${n(len * 0.5)} ${n(-len * 0.16)} ${n(len)} 0" stroke="${color}" stroke-width="1.1" stroke-linecap="round"/>`;
  const count = Math.round(len / 4.2);
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const px = t * len;
    const py = -Math.sin(t * Math.PI) * len * 0.08;
    const size = (1 - t * 0.8) * len * 0.3;
    out += leaf(px, py, size, -62, color, 0.36) + leaf(px, py, size, 62, color, 0.36);
  }
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})"><g${p.move("sway", [0, 0], delay, 7 + r() * 3)}>${out}</g></g>`;
}

function pine(x: number, base: number, h: number, color: string, snow?: string) {
  const w = h * 0.42;
  let out = `<rect x="${n(x - h * 0.03)}" y="${n(base - h * 0.16)}" width="${n(h * 0.06)}" height="${n(h * 0.18)}" fill="${color}"/>`;
  for (let i = 0; i < 4; i++) {
    const top = base - h + i * h * 0.19;
    const half = w * (0.36 + i * 0.22);
    const bottom = top + h * 0.36;
    out += `<path d="M${n(x)} ${n(top)}L${n(x + half)} ${n(bottom)}Q${n(x)} ${n(bottom - h * 0.05)} ${n(x - half)} ${n(bottom)}Z" fill="${color}"/>`;
    if (snow) out += `<path d="M${n(x)} ${n(top)}L${n(x + half * 0.5)} ${n(top + h * 0.17)}Q${n(x)} ${n(top + h * 0.12)} ${n(x - half * 0.5)} ${n(top + h * 0.17)}Z" fill="${snow}" opacity="0.9"/>`;
  }
  return out;
}

function forestCorner(p: Paint): string {
  const { c, glow, look } = p;
  const r = rng(23);
  const moss = c("#5d9a58");
  const mossDark = c("#3d7a4c");
  const mossLight = c("#86bd6c");
  let s = "";
  // Saplings behind.
  s += pine(22, 124, 58, c("#2f6a4c"), look.snow ? p.snow : undefined);
  s += pine(254, 122, 46, c("#2f6a4c"), look.snow ? p.snow : undefined);
  s += pine(238, 124, 30, c("#3d7a52"), look.snow ? p.snow : undefined);
  // The lantern's pool of light.
  s += halo(150, 78, 44, "#ffcf7a", glow);
  // Ground: two soft mossy rises.
  s += `<path d="M0 140V120Q34 106 84 113T176 110T272 117V140Z" fill="${mossDark}"/>`;
  // The fallen log.
  const bark = c("#8b6246");
  const barkDark = c("#6c4a36");
  s += `<rect x="92" y="92" width="122" height="27" rx="13" fill="${bark}"/>`;
  s += `<path d="M104 99h34M150 104h40M112 111h22M168 97h18" stroke="${barkDark}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`;
  s += `<ellipse cx="212" cy="105.500" rx="9" ry="13.500" fill="${c("#d7b48a")}"/><ellipse cx="212" cy="105.500" rx="5.500" ry="8.500" fill="${c("#c39c72")}"/><ellipse cx="212" cy="105.500" rx="2.200" ry="3.600" fill="${c("#a8825c")}"/>`;
  s += `<path d="M132 92q6 -9 12 0M97 100q-7 -3 -10 -9" stroke="${barkDark}" stroke-width="3" stroke-linecap="round"/>`;
  s += leaf(87, 91, 9, -130, mossLight) + leaf(87, 91, 8, -60, moss);
  // Moss, or snow, lying along the top of the log.
  s += look.snow
    ? `<path d="M98 95Q104 86 122 88T160 87T204 93Q190 97 160 95T98 95Z" fill="${p.snow}"/>`
    : `<path d="M100 95Q106 88 122 90T158 89T196 94Q180 97 158 96T100 95Z" fill="${moss}"/><circle cx="118" cy="91" r="3.600" fill="${mossLight}"/><circle cx="170" cy="91" r="3" fill="${mossLight}"/>`;
  // Lantern on the log.
  s += `<path d="M144 66q6 -9 12 0" stroke="${c("#4a4458")}" stroke-width="1.6" stroke-linecap="round"/>`;
  s += `<rect x="143" y="66" width="14" height="3.600" rx="1.500" fill="${c("#4a4458")}"/><rect x="144" y="69" width="12" height="17" rx="2.500" fill="#ffe2a0" opacity="${n3(0.45 + glow * 0.55)}"/>`;
  s += `<path${p.move("flicker", [150, 84])} d="M150 73q4 5.500 0 10q-4 -4.500 0 -10Z" fill="#ff9d4a" opacity="${n3(0.55 + glow * 0.45)}"/>`;
  s += `<rect x="143" y="86" width="14" height="3.600" rx="1.500" fill="${c("#4a4458")}"/><path d="M144 69v17M156 69v17" stroke="${c("#4a4458")}" stroke-width="1.200"/>`;
  // Front rise of ground.
  s += `<path d="M0 140V127Q50 117 110 123T210 121T272 127V140Z" fill="${moss}"/>`;
  // Mushrooms: they keep a faint light of their own after dark.
  const shroom = (x: number, y: number, k: number, cap: string) => {
    let o = halo(x, y - 9 * k, 15 * k, "#ffd9c2", glow * 0.8);
    o += `<path d="M${n(x - 2.2 * k)} ${n(y)}Q${n(x - 1.4 * k)} ${n(y - 6 * k)} ${n(x - 1.8 * k)} ${n(y - 10 * k)}H${n(x + 1.8 * k)}Q${n(x + 1.4 * k)} ${n(y - 6 * k)} ${n(x + 2.2 * k)} ${n(y)}Z" fill="${c("#f3e9d8")}"/>`;
    o += `<path d="M${n(x - 9 * k)} ${n(y - 9 * k)}Q${n(x - 8 * k)} ${n(y - 19 * k)} ${n(x)} ${n(y - 19.5 * k)}Q${n(x + 8 * k)} ${n(y - 19 * k)} ${n(x + 9 * k)} ${n(y - 9 * k)}Q${n(x)} ${n(y - 7 * k)} ${n(x - 9 * k)} ${n(y - 9 * k)}Z" fill="${look.snow ? p.snow : cap}"/>`;
    if (!look.snow)
      o += `<circle cx="${n(x - 3.6 * k)}" cy="${n(y - 13 * k)}" r="${n(1.5 * k)}" fill="#fff6ea" opacity="0.92"/><circle cx="${n(x + 2.6 * k)}" cy="${n(y - 15.5 * k)}" r="${n(1.2 * k)}" fill="#fff6ea" opacity="0.92"/><circle cx="${n(x + 4.6 * k)}" cy="${n(y - 11.4 * k)}" r="${n(1 * k)}" fill="#fff6ea" opacity="0.92"/>`;
    return o;
  };
  s += shroom(62, 126, 1.05, c("#d9574a")) + shroom(78, 128, 0.7, c("#e2764a")) + shroom(48, 129, 0.58, c("#d9574a"));
  // Ferns and grass.
  s += fern(p, r, 14, 130, 40, -62, mossLight, 0) + fern(p, r, 16, 131, 36, -28, moss, 2) + fern(p, r, 12, 130, 30, -100, moss, 4) + fern(p, r, 18, 132, 26, -6, mossLight, 1);
  for (const [gx, gy] of [[100, 126], [128, 128], [186, 126], [262, 130]] as const)
    s += leaf(gx, gy, 9, -108, mossLight, 0.2) + leaf(gx, gy, 11, -88, mossDark, 0.2) + leaf(gx, gy, 8, -64, mossLight, 0.2);
  s += flower(112, 121, 2.6, c("#fff4f7"), c("#ffd166")) + flower(196, 119, 2.3, c("#ffc2d6"), c("#ffd166")) + flower(120, 126, 1.9, c("#ffc2d6"), c("#ffd166"));
  // The fox, curled up asleep.
  const fox = c("#e2813c");
  const foxDark = c("#c96a2c");
  const cream = c("#fbf1e2");
  s += `<path${p.move("breathe", [236, 126])} d="M214 126Q211 108 232 106Q254 105 258 126Z" fill="${fox}"/>`;
  s += `<path d="M258 124Q262 112 250 108Q259 121 240 126Z" fill="${foxDark}"/>`;
  s += `<path d="M212 127Q206 126 208 119Q212 112 222 117Q228 121 240 126Q224 130 212 127Z" fill="${fox}"/><path d="M206.500 123.500Q207 117 213 116Q210 121 213 127Q208 127.500 206.500 123.500Z" fill="${cream}"/>`;
  s += `<path d="M219 119Q218 110 226 108Q234 109 235 118Q233 126 226 127Q220 126 219 119Z" fill="${fox}"/>`;
  s += `<path d="M220 113L219.500 104.500L226 109ZM233.500 112.500L236 104.500L229 108.500Z" fill="${foxDark}"/>`;
  s += `<path d="M222 121Q226 128 232 121Q229 127 226 127.500Q223.500 127 222 121Z" fill="${cream}"/><circle cx="226.800" cy="124.800" r="1.100" fill="${c("#3a2a2a")}"/>`;
  s += `<path d="M222.200 117.500q1.500 1.300 3 0M229 117.500q1.500 1.300 3 0" stroke="${c("#3a2a2a")}" stroke-width="0.9" stroke-linecap="round"/>`;
  if (look.snow) s += `<path d="M218 110Q232 101 252 110Q236 107 218 110Z" fill="${p.snow}" opacity="0.9"/>`;
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
  const greens = [c("#2f7048"), c("#3f8a58"), c("#5aa868"), c("#7cc07a")];
  const bark = c("#6c4a36");
  const end = Math.max(240, width - 190);
  let back = "";
  let front = "";
  let hanging = "";
  // A bough reaching in from the top-left corner.
  const reach = Math.min(end, 330);
  back += `<path d="M-6 -4Q${n(reach * 0.34)} 24 ${n(reach * 0.68)} 15T${n(reach)} 7L${n(reach)} 4.500Q${n(reach * 0.72)} 9 ${n(reach * 0.5)} 9Q${n(reach * 0.2)} 10 -6 -14Z" fill="${bark}"/>`;
  back += `<path d="M${n(reach * 0.3)} 15Q${n(reach * 0.36)} 30 ${n(reach * 0.44)} 34" stroke="${bark}" stroke-width="2.4" stroke-linecap="round"/>`;
  // The canopy: clusters of leaves all along the top, thinning out toward the sun's corner.
  for (let x = -6; x < end; x += 15 + r() * 15) {
    const fade = Math.min(1, (end - x) / 150);
    const depth = (11 + r() * 15) * (0.5 + fade * 0.5) + (x < reach ? 7 : 0);
    const count = 5 + Math.floor(r() * 4);
    let cluster = "";
    for (let i = 0; i < count; i++) {
      const a = 20 + (i / (count - 1)) * 140 + (r() - 0.5) * 22;
      const len = depth * (0.72 + r() * 0.5);
      cluster += leaf(x, -3 + r() * 4 + (x < reach ? 6 : 0), len, a, greens[Math.floor(r() * greens.length)]!, 0.4);
    }
    if (look.snow && r() > 0.35) cluster += `<ellipse cx="${n(x)}" cy="${n(2 + (x < reach ? 6 : 0))}" rx="${n(depth * 0.55)}" ry="2.600" fill="${p.snow}" opacity="0.9"/>`;
    const g = `<g${p.move("rustle", [x, 0], r() * 6, 5 + r() * 4)}>${cluster}</g>`;
    if (r() > 0.5) front += g;
    else back += g;
    // Vines, some of them in flower.
    if (r() > 0.6 && fade > 0.5) {
      const bloom = r();
      hanging += vine(p, r, x + 4, 5 + (x < reach ? 7 : 0), 18 + r() * 30, [greens[1]!, greens[2]!, greens[3]!], bloom > 0.62 ? c("#ffc2d6") : bloom > 0.3 ? c("#fff4f7") : undefined);
    }
    if (r() > 0.78 && fade > 0.4) front += flower(x + (r() - 0.5) * 10, 9 + r() * 8 + (x < reach ? 6 : 0), 3 + r() * 1.4, r() > 0.5 ? c("#fff4f7") : c("#ffc2d6"), c("#ffd166"));
  }
  // A bird on the bough, tail bobbing.
  const bx = reach * 0.58;
  const bird = c("#e8785a");
  front += `<path d="M${n(bx - 26)} 14Q${n(bx - 6)} 30 ${n(bx + 22)} 27" stroke="${bark}" stroke-width="2.200" stroke-linecap="round"/>` + leaf(bx + 20, 27, 9, 20, greens[2]!) + leaf(bx + 14, 27, 8, 70, greens[3]!);
  front += `<g transform="translate(0 17)"><g${p.move("bob", [bx, 8])}><path d="M${n(bx - 7)} 5Q${n(bx - 7)} -3 ${n(bx)} -3Q${n(bx + 6)} -3 ${n(bx + 6)} 3Q${n(bx + 5)} 9 ${n(bx - 1)} 9Q${n(bx - 6)} 9 ${n(bx - 7)} 5Z" fill="${bird}"/><path d="M${n(bx - 6)} 5L${n(bx - 15)} 9L${n(bx - 4)} 8Z" fill="${c("#b85a44")}"/><path d="M${n(bx + 5.6)} 0L${n(bx + 10)} 1.500L${n(bx + 5.6)} 3Z" fill="${c("#ffc95a")}"/><circle cx="${n(bx + 2.6)}" cy="0.600" r="0.900" fill="${c("#2a2230")}"/><path d="M${n(bx - 4)} 3Q${n(bx)} 7 ${n(bx + 3)} 4" stroke="${c("#fbe3d0")}" stroke-width="2" stroke-linecap="round"/></g></g>`;
  let flies = "";
  if (p.night > 0.35) {
    for (let i = 0; i < Math.round(end / 110); i++) {
      const fx = 30 + r() * (end - 60);
      const fy = 30 + r() * 40;
      flies += `<g${p.move("firefly", undefined, r() * 9, 7 + r() * 6)}>${halo(fx, fy, 6, "#f4ff9a", p.night)}<circle cx="${n(fx)}" cy="${n(fy)}" r="1.200" fill="#fbffc8" opacity="${n3(p.night)}"/></g>`;
    }
  }
  return back + hanging + front + flies;
}

function forestBackdrop(p: Paint): string {
  const { look } = p;
  const r = rng(9);
  const ink = hex(look.dark ? "#04100c" : "#16382c");
  const bottom = hex(look.sky[2]);
  const snow = look.snow ? p.snow : undefined;
  let s = "";
  const ridge = (base: number, wave: number, min: number, max: number, depth: number) => {
    const color = toHex(mix(bottom, ink, depth));
    let hill = `M-10 800V${base}`;
    for (let x = 0; x <= 1200; x += 100) hill += `Q${x + 50} ${n(base - wave * (0.4 + r()))} ${x + 100} ${n(base + (r() - 0.5) * wave * 0.5)}`;
    s += `<path d="${hill}V800Z" fill="${color}"/>`;
    for (let x = -10; x < 1210; x += 20 + r() * 34) s += pine(x, base + 6 + r() * 10, min + r() * (max - min), color, snow && depth > 0.4 ? snow : undefined);
  };
  ridge(640, 34, 60, 130, 0.22);
  // Mist lying between the ridges.
  s += `<rect x="0" y="640" width="1200" height="70" fill="${look.sky[2]}" opacity="0.28"/>`;
  ridge(712, 26, 90, 190, 0.44);
  ridge(782, 18, 110, 240, 0.7);
  return s;
}

// ---- sci-fi restaurant ------------------------------------------------------------------

/** A neon tube: a wide soft stroke under a bright thin one. */
const neon = (d: string, color: string, glow: number, w = 2) =>
  `<path d="${d}" stroke="${color}" stroke-width="${n(w * 3.6)}" stroke-linecap="round" stroke-linejoin="round" opacity="${n3(glow * 0.22)}"/><path d="${d}" stroke="${color}" stroke-width="${n(w * 2)}" stroke-linecap="round" stroke-linejoin="round" opacity="${n3(glow * 0.3)}"/><path d="${d}" stroke="${toHex(mix(hex(color), [255, 255, 255], 0.25 + glow * 0.4))}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round" opacity="${n3(0.55 + glow * 0.45)}"/>`;

function restaurantCorner(p: Paint): string {
  const { c, glow, look } = p;
  const cyan = "#5ef2ff";
  const pink = "#ff6fb5";
  const panel = c("#2a2c4a");
  const panelDark = c("#1d1f38");
  const cream = c("#ebe7f5");
  let s = "";
  // A porthole with a ringed planet going by.
  s += halo(44, 46, 34, cyan, glow * 0.5);
  s += `<circle cx="44" cy="46" r="24" fill="${c("#8f93b8")}"/><circle cx="44" cy="46" r="19.500" fill="${toHex(mix(hex("#27306a"), hex("#0e1030"), 0.3 + p.night * 0.6))}"/>`;
  s += `<circle cx="34" cy="38" r="0.900" fill="#ffffff" opacity="0.9"/><circle cx="56" cy="36" r="0.700" fill="#ffffff" opacity="0.8"/><circle cx="52" cy="58" r="0.800" fill="#ffffff" opacity="0.8"/><circle cx="31" cy="54" r="0.600" fill="#ffffff" opacity="0.7"/>`;
  s += `<g${p.move("drift", [44, 46])}><ellipse cx="45" cy="48" rx="15" ry="3.600" stroke="#ffd9a0" stroke-width="1.500" transform="rotate(-18 45 48)" opacity="0.9"/><circle cx="45" cy="48" r="7.500" fill="#ff9d7a"/><path d="M38 46.500q7 -3 14 0" stroke="#ffc9a0" stroke-width="1.600" stroke-linecap="round" opacity="0.8"/><path d="M30.800 52.600A15 3.600 -18 0 0 59.200 43.400" stroke="#ffd9a0" stroke-width="1.500"/></g>`;
  s += `<circle cx="44" cy="46" r="21.800" stroke="${c("#c9cce6")}" stroke-width="2.200"/>`;
  for (let i = 0; i < 8; i++) s += `<circle cx="${n(44 + Math.cos((i / 8) * Math.PI * 2 + 0.4) * 21.8)}" cy="${n(46 + Math.sin((i / 8) * Math.PI * 2 + 0.4) * 21.8)}" r="1" fill="${c("#6b6f94")}"/>`;
  // A shelf of bottles lit from inside.
  s += `<rect x="82" y="62" width="68" height="3" rx="1.500" fill="${c("#8f93b8")}"/>`;
  const bottles: [number, number, string][] = [[88, 20, cyan], [100, 15, "#ffd166"], [111, 23, pink], [124, 17, "#9dff8a"], [136, 21, "#b79dff"]];
  for (const [x, h, color] of bottles) {
    s += halo(x + 3.5, 62 - h / 2, 10, color, glow * 0.7);
    s += `<rect x="${x}" y="${62 - h}" width="7" height="${h}" rx="2.400" fill="${color}" opacity="${n3(0.5 + glow * 0.45)}"/><rect x="${x + 2.3}" y="${62 - h - 4.5}" width="2.400" height="5.500" rx="1" fill="${c("#c9cce6")}"/>`;
  }
  // Glow under the counter.
  s += `<path d="M10 136H226L216 96H20Z" fill="${cyan}" opacity="${n3(glow * 0.1)}"/>`;
  // The counter.
  s += `<path d="M22 96H212V140H22Z" fill="${panel}"/><rect x="30" y="106" width="52" height="34" rx="3" fill="${panelDark}"/><rect x="90" y="106" width="52" height="34" rx="3" fill="${panelDark}"/><rect x="150" y="106" width="54" height="34" rx="3" fill="${panelDark}"/>`;
  s += neon("M24 99.500H210", cyan, glow, 1.5);
  s += `<rect x="14" y="88" width="206" height="7" rx="3.500" fill="${cream}"/><rect x="14" y="92.600" width="206" height="2.400" rx="1.200" fill="${c("#b9b4d6")}"/>`;
  // Wet floor shine in the rain; a dusting on the counter's edge in the snow.
  if (look.rain) s += `<path d="M36 137h40M96 138.500h60M170 137h34" stroke="${cyan}" stroke-width="1.200" stroke-linecap="round" opacity="${n3(0.25 + glow * 0.35)}"/>`;
  // A tall fizzing drink.
  s += halo(104, 76, 13, cyan, glow * 0.7);
  s += `<path d="M98 66H110L108.500 88H99.500Z" fill="${c("#dfe6ff")}" opacity="0.5"/><path d="M98.800 72H109.200L108.500 88H99.500Z" fill="${cyan}" opacity="${n3(0.55 + glow * 0.4)}"/>`;
  s += `<path d="M106 86L111 59" stroke="${pink}" stroke-width="1.400" stroke-linecap="round"/>`;
  for (const [bx, by, d] of [[102, 82, 0], [105.500, 78, 1.2], [103, 76, 2.1]] as const) s += `<circle${p.move("bubble", undefined, d)} cx="${bx}" cy="${by}" r="0.900" fill="#ffffff" opacity="0.85"/>`;
  // A steaming bowl of noodles with chopsticks.
  s += steam(p, 152, 66, c("#ffffff"));
  s += `<path d="M168 73L188 57M172 74L193 60" stroke="${c("#e6c08a")}" stroke-width="1.500" stroke-linecap="round"/>`;
  s += `<ellipse cx="158" cy="75" rx="19" ry="4.600" fill="${c("#ffd98a")}"/><path d="M144 74q4 -4 8 0t8 0t8 0" stroke="${c("#f2b25a")}" stroke-width="1.300" stroke-linecap="round"/>`;
  s += `<circle cx="150" cy="73.500" r="2.600" fill="${c("#fff4e0")}"/><circle cx="150" cy="73.500" r="1.200" fill="${c("#ffb347")}"/><path d="M162 72.500h7" stroke="${c("#6fbf73")}" stroke-width="2" stroke-linecap="round"/>`;
  s += `<path d="M139 75Q141 88 152 88H164Q175 88 177 75Z" fill="${cream}"/><path d="M140.300 79Q158 83.500 175.700 79" stroke="${pink}" stroke-width="2" opacity="0.9"/>`;
  // Stools.
  for (const x of [56, 128]) {
    s += `<rect x="${x - 1.5}" y="118" width="3" height="19" fill="${c("#8f93b8")}"/><ellipse cx="${x}" cy="138" rx="11" ry="2.400" fill="${c("#6b6f94")}"/>`;
    s += `<rect x="${x - 14}" y="111" width="28" height="8" rx="4" fill="${c(pink)}"/><rect x="${x - 14}" y="111" width="28" height="3" rx="1.500" fill="${c("#ff9acb")}"/>`;
  }
  // The robot waiter, hovering with a tray.
  const body = c("#e3e6f5");
  const shade = c("#b4b9d6");
  s += `<ellipse${p.move("shadow", [243, 137])} cx="243" cy="137" rx="14" ry="2.600" fill="${cyan}" opacity="${n3(0.18 + glow * 0.3)}"/>`;
  s += `<g${p.move("float")}>`;
  s += `<path d="M236 125L239 132H247L250 125Z" fill="${shade}"/>` + halo(243, 133, 8, cyan, glow) + `<ellipse cx="243" cy="132.500" rx="4.500" ry="1.500" fill="${cyan}" opacity="${n3(0.6 + glow * 0.4)}"/>`;
  s += `<path d="M243 64V56" stroke="${shade}" stroke-width="1.400"/>` + halo(243, 55, 6, pink, glow) + `<circle${p.move("twinkle", undefined, 0, 2.4)} cx="243" cy="55" r="2.200" fill="${pink}"/>`;
  s += `<rect x="227" y="94" width="32" height="32" rx="12" fill="${body}"/><path d="M227 112H259V114Q259 126 247 126H239Q227 126 227 114Z" fill="${shade}"/>`;
  s += `<path d="M238 103l5 3l5 -3v7l-5 -3l-5 3Z" fill="${pink}"/>`;
  s += `<rect x="229" y="64" width="28" height="27" rx="11" fill="${body}"/><rect x="232.500" y="71" width="21" height="11" rx="5.500" fill="${c("#1d1f38")}"/>`;
  s += `<circle${p.move("blink-eye", [238.5, 76.5])} cx="238.500" cy="76.500" r="2.300" fill="${cyan}"/><circle${p.move("blink-eye", [247.5, 76.5])} cx="247.500" cy="76.500" r="2.300" fill="${cyan}"/>`;
  s += `<path d="M239 85.500q4 2 8 0" stroke="${shade}" stroke-width="1.200" stroke-linecap="round"/>`;
  // Arm and tray, with a cup.
  s += `<path d="M228 104Q219 106 218 97" stroke="${shade}" stroke-width="3.200" stroke-linecap="round"/><rect x="206" y="93.500" width="24" height="2.600" rx="1.300" fill="${c("#c9cce6")}"/>`;
  s += `<path d="M211 84H221L219.500 93.500H212.500Z" fill="${c("#fff4e0")}"/><rect x="210.500" y="83" width="11" height="2.400" rx="1.200" fill="${c(pink)}"/>`;
  s += `</g>`;
  return s;
}

function restaurantOverhead(p: Paint, width: number): string {
  const { c, glow } = p;
  const r = rng(17);
  const cyan = "#5ef2ff";
  const pink = "#ff6fb5";
  const gold = "#ffd166";
  const metal = c("#8f93b8");
  const end = Math.max(240, width - 200);
  let s = `<rect x="-4" y="-2" width="${n(end + 4)}" height="5" rx="2.500" fill="${c("#3a3d60")}"/>`;
  s += neon(`M6 5.500H${n(end - 10)}`, pink, glow, 1.1);
  // Slots along the rail, filled in turn: lamp, sign, lamp, drone, lamp, sign...
  const slot = 118;
  const count = Math.max(2, Math.floor(end / slot));
  const gap = end / count;
  let signs = 0;
  for (let i = 0; i < count; i++) {
    const x = gap * (i + 0.5);
    const kind = i % 2 === 0 ? "lamp" : signs++ % 3 === 1 ? "drone" : "sign";
    if (kind === "lamp") {
      const drop = 12 + r() * 14;
      const color = [gold, cyan, pink][i % 3]!;
      let l = `<path d="M${n(x)} 3V${n(drop)}" stroke="${metal}" stroke-width="1.200"/>`;
      l += beam(x, drop + 10, 7, 24, 72, color, glow * 0.26);
      l += halo(x, drop + 11, 20, color, glow);
      l += `<path d="M${n(x - 15)} ${n(drop + 9)}Q${n(x - 13)} ${n(drop)} ${n(x)} ${n(drop - 1)}Q${n(x + 13)} ${n(drop)} ${n(x + 15)} ${n(drop + 9)}Z" fill="${c("#e3e6f5")}"/>`;
      l += `<rect x="${n(x - 16)}" y="${n(drop + 8)}" width="32" height="2.800" rx="1.400" fill="${c("#b4b9d6")}"/>`;
      l += `<ellipse cx="${n(x)}" cy="${n(drop + 11.6)}" rx="7" ry="2.600" fill="${toHex(mix(hex(color), [255, 255, 255], 0.3 + glow * 0.4))}" opacity="${n3(0.6 + glow * 0.4)}"/>`;
      s += `<g${p.move("sway", [x, 3], r() * 6, 9 + r() * 4)}>${l}</g>`;
    } else if (kind === "sign") {
      const y = 22 + r() * 6;
      let g = `<path d="M${n(x - 20)} 3V${n(y - 6)}M${n(x + 20)} 3V${n(y - 6)}" stroke="${metal}" stroke-width="1"/>`;
      if (signs % 2 === 1) {
        // A noodle bowl in neon tubes, steam and all.
        g += neon(`M${n(x - 20)} ${n(y + 8)}H${n(x + 20)}Q${n(x + 18)} ${n(y + 24)} ${n(x + 6)} ${n(y + 25)}H${n(x - 6)}Q${n(x - 18)} ${n(y + 24)} ${n(x - 20)} ${n(y + 8)}Z`, pink, glow, 1.6);
        g += neon(`M${n(x + 4)} ${n(y + 6)}L${n(x + 20)} ${n(y - 6)}M${n(x + 10)} ${n(y + 6)}L${n(x + 25)} ${n(y - 3)}`, gold, glow, 1.4);
        g += `<g${p.move("twinkle", undefined, 1, 2.8)}>${neon(`M${n(x - 11)} ${n(y + 3)}q-3 -4 0 -7.500M${n(x - 3)} ${n(y + 3)}q-3 -4 0 -7.500`, cyan, glow, 1.3)}</g>`;
      } else {
        // A ringed planet with a star.
        g += neon(`M${n(x - 9)} ${n(y + 10)}a9 9 0 1 1 18 0a9 9 0 1 1 -18 0`, cyan, glow, 1.6);
        g += neon(`M${n(x - 20)} ${n(y + 15)}Q${n(x)} ${n(y + 3)} ${n(x + 20)} ${n(y + 5)}`, gold, glow, 1.4);
        g += `<g${p.move("twinkle", undefined, 0.5, 2.2)}>${neon(`M${n(x + 19)} ${n(y - 6)}v7M${n(x + 15.5)} ${n(y - 2.5)}h7`, pink, glow, 1.3)}</g>`;
      }
      s += `<g${p.move("sway", [x, 3], r() * 5, 12)}>${g}</g>`;
    } else {
      // A little serving drone carrying a covered dish.
      const y = 30;
      let d = halo(x, y + 9, 13, cyan, glow);
      d += `<ellipse cx="${n(x)}" cy="${n(y + 9.5)}" rx="6" ry="1.800" fill="${cyan}" opacity="${n3(0.55 + glow * 0.45)}"/>`;
      d += `<path d="M${n(x - 17)} ${n(y + 4)}Q${n(x)} ${n(y + 12)} ${n(x + 17)} ${n(y + 4)}Z" fill="${c("#b4b9d6")}"/><ellipse cx="${n(x)}" cy="${n(y + 4)}" rx="17" ry="3.400" fill="${c("#e3e6f5")}"/>`;
      d += `<path d="M${n(x - 9)} ${n(y + 2.6)}Q${n(x - 8)} ${n(y - 7)} ${n(x)} ${n(y - 7.5)}Q${n(x + 8)} ${n(y - 7)} ${n(x + 9)} ${n(y + 2.6)}Z" fill="${c("#f5f1ff")}"/><circle cx="${n(x)}" cy="${n(y - 8.6)}" r="1.700" fill="${c(pink)}"/>`;
      d += `<circle${p.move("twinkle", undefined, 0, 1.6)} cx="${n(x - 13)}" cy="${n(y + 4.2)}" r="1.200" fill="${pink}"/><circle${p.move("twinkle", undefined, 0.8, 1.6)} cx="${n(x + 13)}" cy="${n(y + 4.2)}" r="1.200" fill="${gold}"/>`;
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
  const far = toHex(mix(bottom, ink, 0.3));
  const near = toHex(mix(bottom, ink, 0.6));
  const lights = ["#5ef2ff", "#ff6fb5", "#ffd166"];
  let s = "";
  // A huge ringed planet low on the horizon.
  const planet = toHex(mix(bottom, hex("#ffb38a"), 0.42));
  s += `<circle cx="250" cy="690" r="210" fill="${planet}" opacity="0.55"/>`;
  s += `<path d="M70 640Q250 590 440 610M96 700Q260 660 452 684" stroke="${toHex(mix(bottom, ink, 0.12))}" stroke-width="16" stroke-linecap="round" opacity="0.2"/>`;
  s += `<ellipse cx="250" cy="690" rx="330" ry="46" stroke="${toHex(mix(bottom, hex("#ffe0b8"), 0.5))}" stroke-width="9" opacity="0.5" transform="rotate(-14 250 690)"/>`;
  s += `<circle cx="930" cy="520" r="26" fill="${toHex(mix(bottom, hex("#c9b8ff"), 0.5))}" opacity="0.6"/>`;
  const spires = (base: number, min: number, max: number, color: string, lit: number) => {
    let x = -10;
    while (x < 1210) {
      const w = 22 + r() * 46;
      const h = min + r() * (max - min);
      const top = base - h;
      const style = r();
      if (style < 0.4) s += `<path d="M${n(x)} 800V${n(top + w / 2)}Q${n(x)} ${n(top)} ${n(x + w / 2)} ${n(top)}Q${n(x + w)} ${n(top)} ${n(x + w)} ${n(top + w / 2)}V800Z" fill="${color}"/>`;
      else if (style < 0.75) s += `<path d="M${n(x)} 800V${n(top + 30)}L${n(x + w / 2)} ${n(top)}L${n(x + w)} ${n(top + 30)}V800Z" fill="${color}"/>`;
      else s += `<rect x="${n(x + w * 0.2)}" y="${n(top)}" width="${n(w * 0.6)}" height="${n(h)}" fill="${color}"/><ellipse cx="${n(x + w / 2)}" cy="${n(top + 4)}" rx="${n(w * 0.8)}" ry="7" fill="${color}"/>`;
      if (look.snow) s += `<ellipse cx="${n(x + w / 2)}" cy="${n(top + 5)}" rx="${n(w * 0.34)}" ry="2.600" fill="${p.snow}" opacity="0.8"/>`;
      s += `<rect x="${n(x + w / 2 - 0.7)}" y="${n(top - 22)}" width="1.400" height="24" fill="${color}"/><circle cx="${n(x + w / 2)}" cy="${n(top - 22)}" r="2.200" fill="${lights[Math.floor(r() * 3)]}" opacity="${n3(glow)}"/>`;
      if (lit) {
        const color2 = lights[Math.floor(r() * 3)]!;
        for (let wy = top + 34; wy < base - 10; wy += 13) if (r() < lit) s += `<rect x="${n(x + w * 0.3)}" y="${n(wy)}" width="${n(w * 0.4)}" height="2.600" rx="1.300" fill="${color2}" opacity="${n3(glow * (0.35 + r() * 0.5))}"/>`;
      }
      x += w + 4 + r() * 22;
    }
  };
  spires(800, 110, 300, far, 0.22);
  spires(800, 50, 190, near, 0.4);
  // Traffic: little craft with running lights.
  for (let i = 0; i < 7; i++) {
    const x = 80 + r() * 1040;
    const y = 420 + r() * 200;
    const color = lights[i % 3]!;
    s += `<g${p.move(i % 2 ? "fly-left" : "fly-right", undefined, r() * 30, 38 + r() * 30)}><rect x="${n(x)}" y="${n(y)}" width="13" height="3" rx="1.500" fill="${near}"/><circle cx="${n(i % 2 ? x : x + 13)}" cy="${n(y + 1.5)}" r="1.700" fill="${color}" opacity="${n3(0.4 + glow * 0.6)}"/></g>`;
  }
  return s;
}

// ---- public ------------------------------------------------------------------------------

export const SCENE_CORNER = { width: 272, height: 140 } as const;
export const SCENE_OVERHEAD_HEIGHT = 96;

/** The vignette for the bottom of the sidebar (272 x 140). */
export function sceneCorner(id: SceneId, look: SceneLook): SceneArt {
  const p = paint(look);
  const body = id === "workstation" ? workstationCorner(p) : id === "forest" ? forestCorner(p) : restaurantCorner(p);
  return wrap(SCENE_CORNER.width, SCENE_CORNER.height, body, "xMidYMax meet");
}

/** What hangs from the top of the window, drawn for a window `width` px wide. */
export function sceneOverhead(id: SceneId, look: SceneLook, width: number): SceneArt {
  const p = paint(look);
  const w = Math.max(320, Math.round(width));
  const body = id === "workstation" ? workstationOverhead(p, w) : id === "forest" ? forestOverhead(p, w) : restaurantOverhead(p, w);
  return wrap(w, SCENE_OVERHEAD_HEIGHT, body, "xMinYMin meet");
}

/** Silhouettes on the horizon, behind everything (1200 x 800; scale to cover, anchored to the bottom). */
export function sceneBackdrop(id: SceneId, look: SceneLook): SceneArt {
  const p = paint(look);
  const body = id === "workstation" ? workstationBackdrop(p) : id === "forest" ? forestBackdrop(p) : restaurantBackdrop(p);
  return wrap(1200, 800, body, "xMidYMax slice");
}
