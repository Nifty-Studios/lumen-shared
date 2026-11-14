// Sci-fi restaurant, the rest of the diner: the sign over the sidebar, a booth, a jukebox and a
// viewport onto space up the right side of the page, the tiled floor along the bottom, and the
// little robot that sits on top of dialogs. The specials board follows the weather.

import { hex, mix, toHex } from "../ambient/color";
import { circ, clip, ell, halo, label, lin, n, n3, neon, op, path, radial, rect, rng, steam, stroke, weatherMark, type Paint } from "./kit";
import { festiveLine, festiveProp, gift } from "./props";

const CYAN = "#5ef2ff";
const PINK = "#ff6fb5";
const GOLD = "#ffd166";

/** Glowing letters: a soft wide copy under a bright one. */
function neonText(x: number, y: number, str: string, size: number, color: string, glow: number, spacing = 0) {
  const base = `x="${n(x)}" y="${n(y)}" font-family="Inter, Segoe UI, Roboto, sans-serif" font-size="${n(size)}" font-weight="800" text-anchor="middle"${spacing ? ` letter-spacing="${n(spacing)}"` : ""}`;
  return (
    `<text ${base} fill="${color}" stroke="${color}" stroke-width="${n(size * 0.22)}" stroke-linejoin="round" opacity="${n3(glow * 0.22)}">${str}</text>` +
    `<text ${base} fill="${toHex(mix(hex(color), [255, 255, 255], 0.25 + glow * 0.4))}" opacity="${n3(0.6 + glow * 0.4)}">${str}</text>`
  );
}

/** What the kitchen is pushing today: the weather decides, unless it is a special day. */
export function todaysSpecial(p: Paint): [string, string] {
  const { look } = p;
  switch (look.celebration) {
    case "christmas":
      return ["STARDUST", "PUDDING"];
    case "birthday":
      return ["BIRTHDAY", "CAKE POPS"];
    case "halloween":
      return ["PUMPKIN", "PLASMA PIE"];
    case "valentine":
      return ["DOUBLE", "HEART SODA"];
    case "easter":
      return ["MOON EGG", "BENEDICT"];
    case "new-year":
      return ["SUPERNOVA", "FIZZ"];
  }
  if (look.storm) return ["THUNDER", "DUMPLINGS"];
  if (look.rain) return ["RAINY DAY", "RAMEN"];
  if (look.snow) return ["COMET", "COCOA"];
  if (look.daylight < 0.3) return ["MIDNIGHT", "NOODLES"];
  if (look.daylight < 0.7) return ["NEBULA", "SOUP"];
  return ["SOLAR", "SORBET"];
}

function stool(p: Paint, x: number, g: number, seat = PINK) {
  const { c, chrome } = p;
  let s = p.shadow(x, g + 0.5, 14, 2.2);
  s += path(`M${x - 11} ${g}Q${x - 11} ${g - 3.5} ${x} ${g - 3.5}Q${x + 11} ${g - 3.5} ${x + 11} ${g}Z`, chrome("#9a9ec0", x - 11, x + 11));
  s += rect(x - 1.9, g - 20, 3.8, 18, chrome("#b9bdd9", x - 2, x + 2));
  s += `<ellipse cx="${x}" cy="${g - 10}" rx="7.500" ry="1.800" stroke="${c("#c9cce6")}" stroke-width="1.300"/>`;
  s += rect(x - 12.5, g - 21.5, 25, 2.8, chrome("#c9cce6", x - 12, x + 12), 1.4);
  s += path(`M${x - 14} ${g - 21.5}Q${x - 14} ${g - 29} ${x - 8} ${g - 29}H${x + 8}Q${x + 14} ${g - 29} ${x + 14} ${g - 21.5}Z`, lin(0, g - 29, 0, g - 21, [[0, c(seat, 0.3)], [1, c(seat, -0.3)]]));
  s += stroke(`M${x - 10} ${g - 27.2}H${x + 6}`, "#ffffff", 1.3, op(0.45));
  return s;
}

// ---- crest: the sign over the sidebar (272 x 60) ----

export function restaurantCrest(p: Paint): string {
  const { c, glow, look } = p;
  let s = festiveLine(p, 10, 262, 3, 4);
  // The marquee: a dark plate with a chasing border of bulbs.
  s += rect(12, 10, 164, 44, "#05061a", 9, op(0.3)) + rect(10, 8, 164, 44, lin(0, 8, 0, 52, [[0, "#23254a", 0.92], [1, "#0d0e22", 0.94]]), 9);
  s += `<rect x="11" y="9" width="162" height="42" rx="8" stroke="${c("#6b6f94")}" stroke-width="0.800" opacity="0.8"/>`;
  const bulbs: [number, number][] = [];
  for (let x = 20; x <= 164; x += 12) bulbs.push([x, 13], [x, 47]);
  for (const y of [24, 36]) bulbs.push([15, y], [169, y]);
  bulbs.forEach(([bx, by]) => {
    s += `<g${p.move("chase", undefined, ((bx + by) % 36) / 36, 1.2)}>${halo(bx, by, 4.5, GOLD, glow * 0.9)}${circ(bx, by, 1.4, toHex(mix(hex(c(GOLD)), hex("#fff6d8"), 0.3 + glow * 0.7)))}</g>`;
  });
  s += `<g${p.poke("light")}><g${p.light}>${halo(92, 30, 60, PINK, glow * 0.5)}</g>`;
  s += `<g${p.move("neon-buzz", undefined, 0, 9)}>${neonText(92, 43, "DINER", 22, PINK, glow, 3)}</g>`;
  s += `</g>`;
  s += label(92, 20, "LUMEN", 6, c(CYAN), { spacing: 3.4, opacity: 0.55 + glow * 0.45 });
  // A small OPEN sign and a ringed planet in tubes.
  s += stroke(`M214 0v12M246 0v12`, c("#2a2d50"), 1.1);
  s += `<g${p.move("sway", [230, 0], 1, 8)}>`;
  s += rect(194, 12, 72, 26, lin(0, 12, 0, 38, [[0, "#1d1f3a", 0.9], [1, "#0d0e22", 0.92]]), 6);
  s += `<g${p.light}>${halo(230, 25, 34, CYAN, glow * 0.5)}</g>`;
  s += neon(`M199 17h62v16h-62Z`, CYAN, glow, 1) + neonText(230, 29.5, look.daylight < 0.12 && look.celebration === null ? "LATE" : "OPEN", 11, CYAN, glow, 2.4);
  s += `</g>`;
  // Steam vents along the ceiling pipe.
  s += rect(182, 44, 86, 5, p.chrome("#8f93b8", 182, 268), 2.5) + rect(200, 42.5, 5, 8, c("#6b6f94"), 1) + rect(244, 42.5, 5, 8, c("#6b6f94"), 1);
  s += steam(p, 222, 44, c("#ffffff"));
  return s;
}

// ---- rail: the booth by the viewport, up the right side of the page (240 wide, any height) ----

/** A round viewport onto space; the weather outside shows up as meteors, ice dust or lightning. */
function viewport(p: Paint, x: number, y: number, R: number) {
  const { c, look, glow } = p;
  const r = rng(71);
  let s = circ(x + 2, y + 3, R + 10, "#05061a", op(0.3));
  s += circ(x, y, R + 10, lin(x - R, y - R, x + R, y + R, [[0, c("#d9dcf2")], [0.5, c("#8f93b8")], [1, c("#4f5378")]]));
  s += circ(x, y, R + 3, c("#3a3d60"));
  const glass = clip(circ(x, y, R, "#000"));
  let inside = circ(x, y, R, radial(x - R * 0.3, y - R * 0.3, R * 1.6, [[0, toHex(mix(hex(look.sky[1]), hex("#2a2f7a"), 0.55))], [1, toHex(mix(hex(look.sky[0]), hex("#07081c"), 0.6))]]));
  for (let i = 0; i < 26; i++) inside += `<circle${p.move("twinkle", undefined, r() * 4, 2 + r() * 3)} cx="${n(x - R + r() * R * 2)}" cy="${n(y - R + r() * R * 2)}" r="${n(0.4 + r() * 0.9)}" fill="#ffffff" opacity="${n3(0.5 + r() * 0.5)}"/>`;
  // A nebula in the room's colors.
  inside += ell(x + R * 0.3, y - R * 0.2, R * 0.9, R * 0.4, radial(x + R * 0.3, y - R * 0.2, R * 0.9, [[0, PINK, 0.35], [1, PINK, 0]]), ` transform="rotate(-24 ${n(x)} ${n(y)})"`);
  inside += ell(x - R * 0.4, y + R * 0.3, R * 0.7, R * 0.34, radial(x - R * 0.4, y + R * 0.3, R * 0.7, [[0, CYAN, 0.28], [1, CYAN, 0]]), ` transform="rotate(18 ${n(x)} ${n(y)})"`);
  // The planet the diner orbits, turning slowly.
  const px = x - R * 0.28;
  const py = y + R * 0.42;
  inside += `<g${p.move("drift", [px, py], 0, 18)}>`;
  inside += `<path d="M${n(px + R * 0.86)} ${n(py - R * 0.2)}A${n(R * 0.9)} ${n(R * 0.2)} -14 0 0 ${n(px - R * 0.86)} ${n(py + R * 0.24)}" stroke="#e8c79a" stroke-width="2.200" opacity="0.6"/>`;
  inside += circ(px, py, R * 0.5, radial(px - R * 0.18, py - R * 0.2, R * 0.66, [[0, "#ffd9b0"], [0.6, "#ff9d7a"], [1, "#8a3f4a"]]));
  inside += stroke(`M${n(px - R * 0.44)} ${n(py - R * 0.12)}q${n(R * 0.44)} ${n(-R * 0.14)} ${n(R * 0.88)} 0M${n(px - R * 0.46)} ${n(py + R * 0.12)}q${n(R * 0.46)} ${n(R * 0.12)} ${n(R * 0.92)} -0.500`, "#ffe6c8", 2, op(0.45));
  inside += `<path d="M${n(px - R * 0.86)} ${n(py + R * 0.24)}A${n(R * 0.9)} ${n(R * 0.2)} -14 0 0 ${n(px + R * 0.86)} ${n(py - R * 0.2)}" stroke="#ffe6c4" stroke-width="2.400"/>`;
  inside += `</g>`;
  // A shuttle crossing now and then.
  inside += `<g${p.move("cross", undefined, 3, 26, `--span:${n(R * 3)}px`)}><g transform="translate(${n(x - R * 1.5)} ${n(y - R * 0.45)})">${rect(-22, 1, 22, 1.2, lin(-22, 0, 0, 0, [[0, CYAN, 0], [1, CYAN, 0.7]]))}${path(`M0 3q7 -6 15 -1.500l4 1.500l-4 1.500q-8 2 -15 -1.500Z`, "#e9ebfa")}${circ(9, 2.4, 1.3, "#2a2d55")}</g></g>`;
  if (look.rain) {
    // Rain down there is a meteor shower up here.
    for (let i = 0; i < 9; i++) {
      const mx = x - R + r() * R * 2.4;
      const my = y - R * 1.4 + r() * R;
      inside += `<path${p.move("meteor", undefined, r() * 3, 1.4 + r() * 1.6)} d="M${n(mx)} ${n(my)}l-20 26" stroke="${lin(mx, my, mx - 20, my + 26, [[0, "#ffffff", 0], [1, "#fff6d8", 0.95]])}" stroke-width="1.500" stroke-linecap="round"/>`;
    }
  }
  if (look.snow) for (let i = 0; i < 26; i++) inside += `<circle${p.move("snowfall", undefined, r() * 7, 6 + r() * 4)} cx="${n(x - R + r() * R * 2)}" cy="${n(y - R * 1.3 + r() * R * 2)}" r="${n(0.8 + r() * 1.3)}" fill="#dff6ff" opacity="0.9"/>`;
  if (look.storm) inside += `<circle${p.move("flash", undefined, 0, 7)} cx="${n(x)}" cy="${n(y)}" r="${n(R)}" fill="#d9e6ff" opacity="0"/>`;
  s += `<g${glass}>${inside}</g>`;
  if (look.snow) for (const a of [0.6, 2.2, 3.9, 5.4]) s += circ(x + Math.cos(a) * R, y + Math.sin(a) * R, R * 0.5, radial(x + Math.cos(a) * R, y + Math.sin(a) * R, R * 0.5, [[0, "#ffffff", 0.6], [1, "#ffffff", 0]]), glass);
  s += stroke(`M${n(x - R * 0.72)} ${n(y - R * 0.42)}A${n(R * 0.84)} ${n(R * 0.84)} 0 0 1 ${n(x - R * 0.1)} ${n(y - R * 0.83)}`, "#ffffff", 3, op(0.22));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    s += circ(x + Math.cos(a) * (R + 6.5), y + Math.sin(a) * (R + 6.5), 1.5, c("#5a5e84")) + circ(x + Math.cos(a) * (R + 6.5) - 0.4, y + Math.sin(a) * (R + 6.5) - 0.4, 0.6, c("#e9ebfa"));
  }
  s += `<g${p.light}>${halo(x, y, R + 30, CYAN, glow * 0.25)}</g>`;
  return s;
}

function specialsBoard(p: Paint, x: number, y: number) {
  const { c, glow } = p;
  const [a, b] = todaysSpecial(p);
  const w = 124;
  const h = 76;
  let s = rect(x + 2, y + 3, w, h, "#05061a", 8, op(0.3)) + rect(x, y, w, h, lin(0, y, 0, y + h, [[0, "#23254a", 0.94], [1, "#0d0e22", 0.96]]), 8);
  s += `<rect x="${n(x + 1)}" y="${n(y + 1)}" width="${w - 2}" height="${h - 2}" rx="7" stroke="${c("#6b6f94")}" stroke-width="0.800" opacity="0.8"/>`;
  s += `<g${p.light}>${halo(x + w / 2, y + h / 2, 70, GOLD, glow * 0.3)}</g>`;
  s += label(x + w / 2, y + 15, "TODAY'S SPECIAL", 6.4, c(CYAN), { spacing: 1.8, opacity: 0.6 + glow * 0.4 });
  s += stroke(`M${n(x + 14)} ${n(y + 21)}H${n(x + w - 14)}`, CYAN, 0.7, op(0.3 + glow * 0.4));
  s += neonText(x + w / 2 - 12, y + 41, a, 12, GOLD, glow, 0.6) + neonText(x + w / 2 - 12, y + 57, b, 12, PINK, glow, 0.6);
  s += `<g${p.move("float", undefined, 0, 4)}>${weatherMark(p, x + w - 20, y + 44, 9, c("#c9cce6"))}</g>`;
  // The price, in credits.
  s += label(x + w / 2, y + 69, "4.20 CR", 5.4, c("#c9cce6"), { spacing: 1.4, opacity: 0.7 });
  for (const [dx, dy] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]] as const) s += circ(x + dx, y + dy, 1, c("#c9cce6"));
  return `<g${p.poke("light")}>${s}</g>`;
}

function jukebox(p: Paint, x: number, g: number) {
  const { c, chrome, glow } = p;
  const w = 58;
  const h = 96;
  const top = g - h;
  let s = p.shadow(x, g + 1, 36, 4);
  s += `<g${p.light}>${halo(x, g - 52, 70, PINK, glow * 0.45)}</g>`;
  // Cabinet with an arched top.
  s += path(`M${x - w / 2} ${g}V${top + 29}a${w / 2} 29 0 0 1 ${w} 0V${g}Z`, lin(x - w / 2, 0, x + w / 2, 0, [[0, c("#5b2f6f")], [0.4, c("#3a2050")], [1, c("#1d1230")]]));
  // The glowing tubes around the arch, with bubbles rising in them.
  const arch = `M${x - w / 2 + 5} ${g - 8}V${top + 30}a${w / 2 - 5} 24 0 0 1 ${w - 10} 0V${g - 8}`;
  s += neon(arch, GOLD, glow, 2.6);
  s += neon(`M${x - w / 2 + 11} ${g - 30}V${top + 32}a${w / 2 - 11} 18 0 0 1 ${w - 22} 0V${g - 30}`, PINK, glow, 1.6);
  for (const [bx, d] of [[x - w / 2 + 5, 0], [x + w / 2 - 5, 1.1], [x - w / 2 + 5, 2], [x + w / 2 - 5, 0.5]] as const)
    s += `<circle${p.move("bubble-rise", undefined, d, 3)} cx="${bx}" cy="${g - 14}" r="1.300" fill="#ffffff" opacity="0.9"/>`;
  // The window onto the records.
  s += path(`M${x - 16} ${top + 44}V${top + 34}a16 13 0 0 1 32 0V${top + 44}Z`, lin(0, top + 20, 0, top + 44, [[0, "#1a1c36"], [1, "#2a2d50"]]));
  s += `<g${p.move("spin", [x, top + 38], 0, 4)}>${circ(x, top + 38, 8.4, "#0d0e22")}${circ(x, top + 38, 3, c(CYAN))}${stroke(`M${x - 6} ${top + 38}a6 6 0 0 1 6 -6`, "#ffffff", 0.7, op(0.4))}</g>`;
  s += path(`M${x - 16} ${top + 44}V${top + 34}a16 13 0 0 1 12 -12.500L${x - 10} ${top + 44}Z`, "#ffffff", op(0.07));
  // Buttons and the speaker grille.
  s += rect(x - 18, top + 48, 36, 7, chrome("#c9cce6", x - 18, x + 18), 2);
  for (let i = 0; i < 6; i++) s += rect(x - 15.5 + i * 5.4, top + 49.6, 3.6, 3.8, c([PINK, GOLD, CYAN][i % 3]!), 0.8, op(0.6 + glow * 0.4));
  s += rect(x - 18, top + 60, 36, 26, c("#1a1230"), 4);
  for (let i = 0; i < 6; i++) s += stroke(`M${x - 14} ${top + 64.5 + i * 3.6}h28`, c("#8a5fb0"), 1, op(0.7));
  s += circ(x, top + 73, 8, "none", ` stroke="${c(GOLD)}" stroke-width="1.200" opacity="${n3(0.5 + glow * 0.5)}"`);
  s += rect(x - w / 2 - 2, g - 6, w + 4, 6, chrome("#8f93b8", x - w / 2, x + w / 2), 2);
  // Music, drifting up.
  const note = (nx: number, d: number, color: string) =>
    `<g${p.move("note", undefined, d, 4.5)}>${ell(nx, top - 2, 2.6, 2, color)}${stroke(`M${nx + 2.2} ${top - 2}v-9l5 -1.500`, color, 1.1)}</g>`;
  if (p.look.animated) s += note(x - 12, 0, c(CYAN, 0.2)) + note(x + 6, 1.6, c(PINK, 0.2)) + note(x - 2, 3, c(GOLD, 0.2));
  return `<g${p.poke("jukebox")}>${s}</g>`;
}

function booth(p: Paint, g: number) {
  const { c, v, chrome, glow, look } = p;
  let s = p.shadow(74, g + 1, 70, 5);
  // The bench: channelled upholstery with chrome piping.
  s += rect(8, g - 108, 30, 104, lin(8, 0, 38, 0, [[0, c(PINK, 0.15)], [1, c(PINK, -0.35)]]), 13);
  s += rect(12, g - 104, 22, 60, lin(12, 0, 34, 0, [[0, c(PINK, 0.4)], [1, c(PINK, -0.1)]]), 10);
  for (const dy of [14, 28, 42]) s += stroke(`M13 ${g - 104 + dy}h20`, c(PINK, -0.4), 0.9, op(0.55));
  s += rect(8, g - 46, 78, 18, v(toHex(mix(hex(PINK), [255, 255, 255], 0.35)), toHex(mix(hex(PINK), [20, 10, 60], 0.25)), g - 46, g - 28), 8);
  s += rect(8, g - 30, 78, 26, v("#3a3d66", "#1d1f3a", g - 30, g - 4), 4) + rect(8, g - 30, 78, 2.4, chrome("#c9cce6", 8, 86), 1.2) + rect(8, g - 6, 78, 6, chrome("#8f93b8", 8, 86), 2);
  s += stroke(`M14 ${g - 42}h64`, "#ffffff", 1.4, op(0.35));
  // The table on its pedestal.
  const tx = 108;
  const ty = g - 56;
  s += path(`M${tx - 16} ${g}q0 -4.500 16 -4.500t16 4.500Z`, chrome("#9a9ec0", tx - 16, tx + 16)) + rect(tx - 2.6, ty, 5.2, 56 - 4, chrome("#b9bdd9", tx - 3, tx + 3));
  s += ell(tx, ty + 2, 40, 4.6, "#05061a", op(0.22)) + ell(tx, ty, 40, 5, v("#fbf9ff", "#b9b4d6", ty - 5, ty + 5)) + ell(tx, ty - 1, 37, 3.4, "#ffffff", op(0.5));
  s += `<g${p.light}>${ell(tx, ty + 4.6, 34, 2, CYAN, op(glow * 0.4))}</g>`;
  const special = festiveProp(p, tx - 8, ty - 1, 0.62);
  if (special) s += special;
  else {
    // A milkshake with a cherry on top.
    const mx = tx - 14;
    s += `<g${p.poke("shake")}>`;
    s += stroke(`M${mx + 2} ${ty - 26}L${mx + 8} ${ty - 42}`, c(CYAN), 1.6);
    s += path(`M${mx - 7} ${ty - 28}H${mx + 7}L${mx + 4} ${ty - 6}H${mx - 4}Z`, lin(mx - 7, 0, mx + 7, 0, [[0, c("#ffd9e8")], [1, c("#e88ab4")]])) + path(`M${mx - 7} ${ty - 28}H${mx + 7}L${mx + 4} ${ty - 6}H${mx - 4}Z`, "#ffffff", op(0.16));
    s += circ(mx - 3.4, ty - 29.5, 4, c("#fffaf2")) + circ(mx + 3, ty - 30, 4.4, c("#fff4ea")) + circ(mx, ty - 33, 3.6, c("#ffffff")) + circ(mx + 0.6, ty - 37, 2.2, c("#e0304a")) + circ(mx, ty - 37.6, 0.6, "#ffffff", op(0.7));
    s += rect(mx - 1.4, ty - 6, 2.8, 4, c("#e9ebfa")) + ell(mx, ty - 1.6, 6, 1.6, c("#e9ebfa"));
    s += stroke(`M${mx - 4.6} ${ty - 25}L${mx - 3} ${ty - 9}`, "#ffffff", 0.9, op(0.6)) + `</g>`;
    // Ketchup and mustard.
    s += rect(tx + 22, ty - 15, 5, 14, p.h("#f04a4a", "#b02a2a", tx + 22, tx + 27), 2) + path(`M${tx + 23} ${ty - 15}l1.500 -4l1.500 4Z`, c("#f04a4a"));
    s += rect(tx + 29, ty - 13, 5, 12, p.h("#ffd23a", "#c99a1a", tx + 29, tx + 34), 2) + path(`M${tx + 30} ${ty - 13}l1.500 -4l1.500 4Z`, c("#ffd23a"));
  }
  // A plate of dumplings (hot in bad weather).
  const px = tx + 6;
  if (look.rain || look.snow) s += steam(p, px - 3, ty - 12, c("#ffffff"));
  s += ell(px, ty - 2.4, 13, 2.8, c("#f5f1ff")) + ell(px, ty - 2.8, 10, 1.9, c("#d9d4ee"));
  for (const dx of [-5, 1, 6]) s += path(`M${px + dx - 4} ${ty - 3}q4 -7 8 0Z`, v("#fff6e0", "#e6cfa0", ty - 8, ty - 3)) + stroke(`M${px + dx - 2} ${ty - 5.4}q2 -1.400 4 0`, c("#c9a877"), 0.6);
  return s;
}

export function restaurantRail(p: Paint, H: number): string {
  const { c, chrome, glow } = p;
  const g = H - 8;
  let s = "";
  // The pylon: steel, riveted, with a neon line up its side.
  s += rect(204, -6, 24, g + 6, lin(204, 0, 228, 0, [[0, c("#8f93b8")], [0.3, c("#c9cce6")], [0.5, c("#6b6f94")], [1, c("#2a2d50")]]));
  for (let y = 30; y < g - 20; y += 64) s += rect(202, y, 28, 5, chrome("#6b6f94", 202, 230), 1.5) + circ(207, y + 2.5, 0.9, c("#e9ebfa")) + circ(225, y + 2.5, 0.9, c("#3a3d60"));
  s += neon(`M200 ${84}V${g - 8}`, PINK, glow, 1.3);

  // An arm off the pylon carries the specials board.
  const top = 92;
  s += rect(26, top, 180, 5, chrome("#8f93b8", 26, 206), 2.5) + path(`M204 ${top + 5}v22l-26 -22Z`, c("#454a78"));
  s += festiveLine(p, 30, 200, top + 5, 7);
  s += stroke(`M56 ${top + 5}v12M124 ${top + 5}v12`, c("#2a2d50"), 1.2);
  s += `<g${p.move("sway", [90, top + 5], 0, 11)}>${specialsBoard(p, 28, top + 16)}</g>`;

  // RAMEN, in lights, down the pylon.
  const letters = "RAMEN".split("");
  const lettersTop = top + 110;
  const room = g - 250 - lettersTop;
  if (room > 60) {
    const shown = letters.slice(0, Math.min(5, Math.floor(room / 30)));
    const stepY = 30;
    s += rect(168, lettersTop - 8, 34, shown.length * stepY + 10, lin(0, lettersTop, 0, lettersTop + 160, [[0, "#23254a", 0.94], [1, "#0d0e22", 0.96]]), 7);
    s += `<g${p.light}>${halo(185, lettersTop + shown.length * 15, 60, CYAN, glow * 0.35)}</g>`;
    shown.forEach((ch, i) => {
      const flick = i === 2 ? p.move("neon-buzz", undefined, 2, 6) : "";
      s += `<g${flick}>${neonText(185, lettersTop + 15 + i * stepY, ch, 19, i % 2 ? PINK : CYAN, glow)}</g>`;
    });
  }
  // The viewport, when the wall is tall enough to hold one.
  const from = top + 110;
  const to = g - 130;
  if (to - from >= 150) {
    const R = Math.min(52, (to - from - 40) / 2);
    s += viewport(p, 92, from + (to - from) * 0.48, R);
  }

  // The floor of the booth: a strip of light.
  s += rect(0, g, 240, 8, lin(0, g, 0, g + 8, [[0, c("#3a3d60"), 0.9], [1, c("#1d1f3a"), 0.9]])) + neon(`M4 ${g + 1}H236`, CYAN, glow * 0.8, 1);
  s += booth(p, g);
  s += jukebox(p, 186, g);
  // An order ticket rail with slips fluttering.
  if (H >= 420) {
    const ry = g - 128;
    s += rect(52, ry, 86, 3, chrome("#c9cce6", 52, 138), 1.5);
    [60, 82, 106].forEach((x, i) => {
      s += `<g${p.move("sway", [x + 8, ry + 3], i * 1.2, 3.4 + i)}>${rect(x, ry + 2, 16, 20, c("#fffaf0"), 1)}${stroke(`M${x + 3} ${ry + 8}h10M${x + 3} ${ry + 12}h7M${x + 3} ${ry + 16}h9`, c("#8a86ad"), 0.8)}${rect(x, ry + 2, 16, 3, c([PINK, CYAN, GOLD][i]!))}</g>`;
    });
  }
  return s;
}

// ---- floor: tiles along the bottom of the page (any width x 64) ----

export function restaurantFloor(p: Paint, W: number): string {
  const { c, glow, look } = p;
  const g = 50;
  let s = "";
  // Checkerboard, seen from the stools, with the wall light lying on it.
  for (let x = -20, i = 0; x < W; x += 30, i++) {
    s += path(`M${x + 6} ${g}H${x + 36}L${x + 31} ${g + 7}H${x}Z`, c(i % 2 ? "#3a3d60" : "#c9cce6"), op(i % 2 ? 0.75 : 0.55));
    s += path(`M${x} ${g + 7}H${x + 31}L${x + 25} 64H${x - 7}Z`, c(i % 2 ? "#c9cce6" : "#3a3d60"), op(i % 2 ? 0.55 : 0.75));
  }
  s += rect(0, g, W, 14, lin(0, g, 0, 64, [[0, CYAN, glow * 0.35], [1, CYAN, 0]]));
  s += neon(`M0 ${g - 0.5}H${W}`, CYAN, glow * 0.9, 1);

  // Stools at the end of the counter and a plant from somewhere warmer.
  s += stool(p, 34, g + 5) + stool(p, 78, g + 5, CYAN);
  if (W > 420) {
    const x = 128;
    s += p.shadow(x, g + 5.6, 13, 2.2);
    for (const [dx, dy, color] of [[-10, -40, PINK], [0, -50, CYAN], [11, -38, GOLD], [-4, -30, CYAN]] as const) {
      s += `<g${p.move("sway", [x, g - 12], dx * 0.2, 5)}>${stroke(`M${x} ${g - 12}Q${x + dx * 0.4} ${g + dy * 0.6} ${x + dx} ${g + dy}`, c("#3f8a7a"), 1.4)}${halo(x + dx, g + dy, 8, color, glow)}${circ(x + dx, g + dy, 3, radial(x + dx - 1, g + dy - 1, 4, [[0, "#ffffff"], [1, color]]), op(0.7 + glow * 0.3))}</g>`;
    }
    s += path(`M${x - 10} ${g - 13}h20l-3 18h-14Z`, p.chrome("#b9bdd9", x - 10, x + 10)) + rect(x - 11, g - 15, 22, 3.4, p.chrome("#e9ebfa", x - 11, x + 11), 1.6);
  }
  if (look.celebration && W > 560) s += gift(p, 176, g + 5, 1.2, "#5b2f8f", "#5ef2ff") + gift(p, 198, g + 5, 0.8, "#b83d8f", "#ffd166");
  // The floor is wet when it rains: mind the sign.
  if (look.rain && W > 520) {
    const x = W * 0.34;
    s += ell(x + 30, g + 8, 34, 3, CYAN, op(0.14 + glow * 0.16));
    s += p.shadow(x, g + 6, 11, 1.8);
    s += path(`M${n(x - 9)} ${g + 5}l7 -26h4l7 26h-3.500l-2 -8h-7l-2 8Z`, p.h("#ffd23a", "#c99a1a", x - 9, x + 9));
    s += path(`M${n(x - 1.4)} ${g - 15}h2.800l-0.600 8h-1.600ZM${n(x - 1.1)} ${g - 5.6}h2.200v2.200h-2.200Z`, c("#2a2738"));
  }
  // The cleaning robot, forever on its rounds.
  if (W > 460) {
    const span = Math.max(120, W - 560);
    const bot =
      halo(0, g + 4, 12, PINK, glow * 0.7) +
      ell(0, g + 5.4, 15, 2.2, "#05061a", op(0.3)) +
      path(`M-14 ${g + 4}q0 -9 14 -9t14 9Z`, lin(-14, 0, 14, 0, [[0, c("#ffffff")], [0.5, c("#e3e6f5")], [1, c("#9a9ec0")]])) +
      rect(-15, g + 2.6, 30, 3, p.chrome("#8f93b8", -15, 15), 1.5) +
      stroke(`M0 ${g - 5}v-7`, c("#8f93b8"), 1) +
      `<circle${p.move("twinkle", undefined, 0, 1.4)} cx="0" cy="${g - 13}" r="1.700" fill="${PINK}"/>` +
      circ(-5, g - 0.6, 1.5, CYAN) +
      circ(5, g - 0.6, 1.5, CYAN) +
      stroke(`M-3 ${g + 1.2}q3 1.400 6 0`, c("#6b6f94"), 0.8);
    s += `<g transform="translate(240 0)"><g${p.move("patrol", undefined, 0, Math.max(14, span / 14), `--span:${n(span)}px`)}><g${p.poke("bot")}>${bot}</g></g></g>`;
  }
  return s;
}

// ---- perch: who sits on top of a dialog (120 x 44) ----

export function restaurantPerch(p: Paint): string {
  const { c, v, glow } = p;
  const g = 44;
  let s = "";
  // A small robot, sitting with its legs over the edge.
  const x = 74;
  s += stroke(`M${x} ${g - 31}v-7`, c("#8f93b8"), 1.2) + halo(x, g - 39, 6, PINK, 0.5 + glow * 0.5) + circ(x, g - 39, 2, PINK);
  s += rect(x - 11, g - 19, 22, 19, lin(x - 11, 0, x + 11, 0, [[0, c("#ffffff")], [0.45, c("#e3e6f5")], [1, c("#9a9ec0")]]), 7);
  s += rect(x - 13.5, g - 25, 3, 7, c(PINK), 1.5) + rect(x + 10.5, g - 25, 3, 7, c(PINK, -0.25), 1.5);
  s += rect(x - 11.5, g - 32, 23, 17, lin(x - 11, 0, x + 12, 0, [[0, c("#ffffff")], [0.45, c("#e9ebfa")], [1, c("#a4a8c9")]]), 7.5);
  s += rect(x - 8, g - 28, 16, 8, v("#2a2d55", "#0f1028", g - 28, g - 20), 4);
  s += circ(x - 3.4, g - 24, 1.7, CYAN) + circ(x + 3.4, g - 24, 1.7, CYAN) + circ(x - 3.9, g - 24.5, 0.5, "#ffffff") + circ(x + 2.9, g - 24.5, 0.5, "#ffffff");
  s += circ(x, g - 8, 1.6, CYAN, op(0.6 + glow * 0.4));
  s += stroke(`M${x - 6} ${g - 1}h-6M${x + 6} ${g - 1}h6`, c("#8f93b8"), 3);
  s += stroke(`M${x - 11} ${g - 12}q-7 2 -8 9M${x + 11} ${g - 12}q7 2 8 9`, c("#b9bdd9"), 2.4);
  // A soda and a tiny neon star.
  const mx = 104;
  s += stroke(`M${mx + 1} ${g - 14}l4 -12`, c(PINK), 1.3) + path(`M${mx - 5} ${g - 16}h10l-1.500 16h-7Z`, lin(mx - 5, 0, mx + 5, 0, [[0, "#b8fbff", 0.9], [1, "#25b9d6", 0.9]])) + stroke(`M${mx - 3.4} ${g - 13}l1 11`, "#ffffff", 0.8, op(0.6));
  s += neon(`M30 ${g - 22}v14M23 ${g - 15}h14M25.400 ${g - 19.6}l9.200 9.200M34.600 ${g - 19.6}l-9.200 9.200`, GOLD, 0.5 + glow * 0.5, 1.1);
  s += stroke(`M30 ${g - 8}v8`, c("#6b6f94"), 1.2);
  return s;
}
