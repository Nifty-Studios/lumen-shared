// Workstation, the rest of the room: a shelf across the top of the sidebar, a reading corner
// with a window up the right side of the page, the floor along the bottom, and the cat that
// sleeps on top of dialogs.

import { hex, mix, toHex } from "../ambient/color";
import { beam, books, circ, clip, ell, halo, label, leaf, lin, n, n3, op, path, radial, rect, rng, steam, stroke, vine, weatherMark, type Paint } from "./kit";
import { festiveLine, festiveProp, gift } from "./props";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** A clock that keeps real time on the desktop (its hands are turned by CSS from now on). */
function clock(p: Paint, x: number, y: number, r: number, body: string) {
  const now = new Date();
  const mins = p.look.animated ? now.getMinutes() * 60 + now.getSeconds() : 10 * 60;
  const hours = p.look.animated ? (now.getHours() % 12) * 3600 + mins : 10 * 3600 + 600;
  let s = circ(x + 0.8, y + 1.2, r, "#05061a", op(0.22)) + circ(x, y, r, p.c(body)) + circ(x, y, r * 0.82, radial(x - r * 0.3, y - r * 0.3, r * 1.4, [[0, p.c("#fffaf0")], [1, p.c("#e0d6c4")]]));
  for (let i = 0; i < 12; i++) s += `<path d="M${n(x)} ${n(y - r * 0.7)}V${n(y - r * (i % 3 ? 0.62 : 0.54))}" stroke="${p.c("#5a4a40")}" stroke-width="${i % 3 ? 0.5 : 0.9}" transform="rotate(${i * 30} ${n(x)} ${n(y)})"/>`;
  s += `<g${p.move("turn", [x, y], hours, 43200)}${p.look.animated ? "" : ` transform="rotate(305 ${n(x)} ${n(y)})"`}><path d="M${n(x)} ${n(y)}V${n(y - r * 0.4)}" stroke="${p.c("#3a2c26")}" stroke-width="${n(Math.max(1, r * 0.11))}" stroke-linecap="round"/></g>`;
  s += `<g${p.move("turn", [x, y], mins, 3600)}${p.look.animated ? "" : ` transform="rotate(60 ${n(x)} ${n(y)})"`}><path d="M${n(x)} ${n(y)}V${n(y - r * 0.62)}" stroke="${p.c("#3a2c26")}" stroke-width="${n(Math.max(0.7, r * 0.07))}" stroke-linecap="round"/></g>`;
  if (p.look.animated) s += `<g${p.move("turn", [x, y], now.getSeconds(), 60)}><path d="M${n(x)} ${n(y + r * 0.14)}V${n(y - r * 0.66)}" stroke="${p.c(p.look.accent)}" stroke-width="0.5" stroke-linecap="round"/></g>`;
  return s + circ(x, y, Math.max(0.8, r * 0.09), p.c("#3a2c26"));
}

function pot(p: Paint, x: number, base: number, w: number, h: number, color = "#e2905f") {
  return (
    path(`M${n(x - w / 2)} ${n(base - h)}H${n(x + w / 2)}L${n(x + w * 0.36)} ${n(base)}H${n(x - w * 0.36)}Z`, p.h(color, color, x - w / 2, x + w / 2)) +
    path(`M${n(x + w * 0.1)} ${n(base - h)}H${n(x + w / 2)}L${n(x + w * 0.36)} ${n(base)}H${n(x + w * 0.1)}Z`, "#05061a", op(0.16)) +
    rect(x - w / 2 - 1, base - h - 2.4, w + 2, 3.4, p.c(color, 0.14), 1.4)
  );
}

// ---- crest: a wall shelf across the top of the sidebar (272 x 60) ----

export function workstationCrest(p: Paint): string {
  const { c, v, glow } = p;
  const g1 = c("#4f9a62");
  const g2 = c("#35744b");
  const r = rng(41);
  const base = 46;
  let s = festiveLine(p, 14, 258, 5, 4);
  // Brackets and the board, with the shadow it throws on the wall.
  s += rect(12, base + 5, 248, 5, "#05061a", 2.5, op(0.16));
  for (const x of [34, 238]) s += path(`M${x - 2} ${base + 4}h4v9q0 3 -4 3Z`, c("#8a5f40"));
  s += rect(10, base, 252, 5, v("#d6a273", "#a8744b", base, base + 5), 2) + rect(12, base + 0.5, 248, 1, c("#f0c79c"), 0.5, op(0.8));

  // Books, one leaning.
  s += books(p, 20, base, [[5, 26, "#d9574a"], [4, 22, "#e9c46a"], [6, 28, "#46669c"], [4, 24, "#3f8a6a"], [5, 20, "#b86a8c"], [4, 27, "#e58a6c"]]);
  s += `<g transform="rotate(16 60 ${base})">${books(p, 54, base, [[5, 24, "#6b8fc8"]])}</g>`;

  // A little alarm clock that keeps time.
  s += p.shadow(84, base, 10, 1.4);
  s += stroke(`M78 ${base}l-2 -3M90 ${base}l2 -3`, c("#8a8296"), 1.6);
  s += circ(77.5, base - 20.5, 2.6, c("#c9744a")) + circ(90.5, base - 20.5, 2.6, c("#c9744a"));
  s += `<g${p.poke("clock")}>${clock(p, 84, base - 12, 9.5, "#c9744a")}</g>`;

  // A pothos spilling over the edge.
  s += vine(p, r, 116, base - 6, 15, [g2, g1, c("#78bf7e")]) + vine(p, r, 132, base - 6, 12, [g2, g1, c("#78bf7e")]);
  for (let i = 0; i < 7; i++) s += leaf(124 + (i - 3) * 2.4, base - 12, 9 + r() * 5, -90 + (i - 3) * 24, i % 2 ? g1 : g2, 0.46, c("#2a5f3c"));
  s += pot(p, 124, base, 17, 12, "#f1eef7");

  // A framed photograph, standing.
  s += p.shadow(158, base, 12, 1.4);
  s += rect(147, base - 25, 22, 25, v("#e9dcc6", "#cdbb9f", base - 25, base), 1.6) + rect(149.5, base - 22.5, 17, 20, v("#9fc8f0", "#f7d9b0", base - 22, base - 2));
  s += path(`M149.500 ${base - 2.5}l6 -9l4 5l3 -3l4 7Z`, c("#5c7f6a")) + circ(162, base - 17, 2, c("#fff3d6"));

  // Headphones resting on a stack.
  s += books(p, 180, base, [[26, 5, "#46669c"]]);
  s += rect(182, base - 9.6, 22, 4.6, c("#e58a6c"), 1) + rect(183, base - 8.6, 3, 2.6, c("#f6ead2"));
  s += stroke(`M186 ${base - 12}q7 -14 14 0`, c("#3a3d50"), 2.2) + rect(183.5, base - 15.5, 5, 7, c(p.look.accent), 2.2) + rect(197.500, base - 15.5, 5, 7, c(p.look.accent, -0.25), 2.2);

  // A cactus in a striped pot, and a candle that is lit after dark.
  s += path(`M229 ${base - 11}V${base - 24}q0 -4 4 -4t4 4V${base - 11}Z`, lin(229, 0, 237, 0, [[0, c("#6aa870")], [1, c("#3f7a52")]]));
  s += stroke(`M229 ${base - 16}h-3q-2.500 0 -2.500 -3v-2M237 ${base - 18}h3q2.500 0 2.500 -3v-1`, c("#4f9a62"), 3);
  s += stroke(`M233 ${base - 26}v14`, c("#8fcf94"), 0.6, op(0.7)) + circ(233, base - 28.5, 1.7, c("#ff9ab8"));
  s += pot(p, 233, base, 15, 10, "#e2905f");
  s += `<g${p.light}>${halo(252, base - 15, 13, "#ffd58a", glow)}</g>`;
  s += rect(249, base - 10, 6, 10, v("#fffaf0", "#e0d6c4", base - 10, base), 1.2);
  s += `<g${p.light}><path${p.move("flicker", [252, base - 10.5])} d="M252 ${base - 17}q2.400 3.400 0 6.500q-2.400 -3 0 -6.500Z" fill="#ffb347" opacity="${n3(0.25 + glow * 0.75)}"/></g>`;
  return s;
}

// ---- rail: the reading corner up the right side of the page (240 wide, any height) ----

/** A window onto the weather as it is now. */
function windowPane(p: Paint, x: number, y: number, w: number, h: number) {
  const { c, v, look, glow } = p;
  const r = rng(77);
  const night = p.night;
  let s = "";
  // Curtain rod.
  s += rect(x - 16, y - 13, w + 32, 2.6, p.chrome("#b8875a", x - 16, x + w + 16), 1.3) + circ(x - 17, y - 11.7, 3, c("#c99a66")) + circ(x + w + 17, y - 11.7, 3, c("#a8744b"));
  // Frame and the wall's shadow around it.
  s += rect(x - 5, y - 4, w + 12, h + 12, "#05061a", 4, op(0.16));
  s += rect(x - 6, y - 6, w + 12, h + 12, v("#f4e9d8", "#cdbb9f", y - 6, y + h + 6), 4);
  // The glass: today's sky.
  const glass = clip(rect(x, y, w, h, "#000", 2));
  let inside = rect(x, y, w, h, lin(0, y, 0, y + h, [[0, look.sky[0]], [0.55, look.sky[1]], [1, look.sky[2]]]));
  if (night > 0.5 && !look.rain && !look.snow) {
    for (let i = 0; i < 16; i++) inside += `<circle${p.move("twinkle", undefined, r() * 4, 2 + r() * 3)} cx="${n(x + r() * w)}" cy="${n(y + r() * h * 0.6)}" r="${n(0.5 + r() * 0.7)}" fill="#ffffff" opacity="${n3(night * 0.9)}"/>`;
    inside += halo(x + w * 0.72, y + h * 0.24, 22, "#fff3c4", 0.7) + circ(x + w * 0.72, y + h * 0.24, 9, "#fff6d8") + circ(x + w * 0.72 + 4, y + h * 0.24 - 2, 8, look.sky[0]);
  } else if (!look.rain && !look.snow) {
    inside += halo(x + w * 0.7, y + h * 0.26, 34, "#fff3c4", 0.9) + circ(x + w * 0.7, y + h * 0.26, 10, "#fff1c0");
  }
  // Clouds drifting past (heavier in bad weather).
  const cloudy = look.rain || look.snow ? 0.75 : 0.5;
  for (const [cx, cy, k] of [[0.22, 0.2, 1], [0.62, 0.36, 0.8], [0.9, 0.14, 0.7]] as const)
    inside += `<g${p.move("drift", undefined, cx * 9, 16)}><path d="M${n(x + w * cx - 16 * k)} ${n(y + h * cy + 6 * k)}a${n(7 * k)} ${n(7 * k)} 0 0 1 ${n(2 * k)} ${n(-13 * k)}a${n(10 * k)} ${n(10 * k)} 0 0 1 ${n(18 * k)} ${n(-2 * k)}a${n(8 * k)} ${n(8 * k)} 0 0 1 ${n(6 * k)} ${n(15 * k)}Z" fill="${toHex(mix(hex(look.sky[1]), [255, 255, 255], look.rain ? 0.25 : 0.6))}" opacity="${cloudy}"/></g>`;
  // The street outside: roofs, a chimney, lit windows.
  const far = toHex(mix(hex(look.sky[2]), hex(look.dark ? "#05060f" : "#262a4a"), 0.5));
  const near = toHex(mix(hex(look.sky[2]), hex(look.dark ? "#05060f" : "#262a4a"), 0.72));
  let bx = x - 4;
  while (bx < x + w) {
    const bw = 16 + r() * 18;
    const bh = h * (0.16 + r() * 0.22);
    inside += rect(bx, y + h - bh, bw, bh, r() > 0.5 ? far : near);
    if (r() > 0.5) inside += path(`M${n(bx - 1)} ${n(y + h - bh)}l${n(bw / 2 + 1)} ${n(-8)}l${n(bw / 2 + 1)} 8Z`, near);
    for (let wy = y + h - bh + 5; wy < y + h - 4; wy += 8)
      for (let wx = bx + 3; wx < bx + bw - 4; wx += 6) if (r() < 0.45) inside += rect(wx, wy, 2.6, 3.6, "#ffdf9c", 0.4, op(glow * (0.4 + r() * 0.6)));
    if (look.snow) inside += rect(bx - 1, y + h - bh - 1.5, bw + 2, 3, p.snow, 1.5);
    bx += bw + 1;
  }
  if (look.rain) {
    for (let i = 0; i < 26; i++) {
      const rx = x + r() * (w + 20) - 4;
      const ry = y - 30 + r() * (h + 10);
      inside += `<path${p.move("fall", undefined, r() * 1.2, 0.7 + r() * 0.5)} d="M${n(rx)} ${n(ry)}l-3 13" stroke="#cfe6ff" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`;
    }
    // Drops that have gathered on the glass and run down it.
    for (let i = 0; i < 7; i++) {
      const dx = x + 8 + r() * (w - 16);
      const dy = y + 10 + r() * h * 0.5;
      inside += `<g${p.move("trickle", undefined, r() * 6, 5 + r() * 4)}><path d="M${n(dx)} ${n(dy - 12)}V${n(dy)}" stroke="#ffffff" stroke-width="0.800" opacity="0.25"/><ellipse cx="${n(dx)}" cy="${n(dy)}" rx="1.400" ry="2" fill="#e6f2ff" opacity="0.8"/></g>`;
    }
  }
  if (look.snow) {
    for (let i = 0; i < 26; i++) inside += `<circle${p.move("snowfall", undefined, r() * 7, 5 + r() * 4)} cx="${n(x + r() * w)}" cy="${n(y - 20 + r() * h)}" r="${n(0.9 + r() * 1.2)}" fill="#ffffff" opacity="0.9"/>`;
    // Frost creeping in from the corners.
    for (const [fx, fy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as const) inside += circ(fx, fy, 30, radial(fx, fy, 30, [[0, "#ffffff", 0.75], [1, "#ffffff", 0]]));
  }
  if (look.storm) inside += `<rect${p.move("flash", undefined, 0, 7)} x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#ffffff" opacity="0"/>`;
  // Lamp-light on the glass at night, and a glare by day.
  inside += path(`M${n(x)} ${n(y)}H${n(x + w * 0.42)}L${n(x + w * 0.12)} ${n(y + h)}H${n(x)}Z`, "#ffffff", op(0.06 + look.daylight * 0.05));
  s += `<g${glass}>${inside}</g>`;
  // Glazing bars.
  s += rect(x + w / 2 - 1.8, y, 3.6, h, c("#e3d5bf")) + rect(x, y + h * 0.42 - 1.6, w, 3.2, c("#e3d5bf")) + rect(x + w / 2 + 0.6, y, 1.2, h, "#05061a", 0, op(0.12));
  // Sill.
  s += rect(x - 12, y + h + 5, w + 24, 6, v("#f4e9d8", "#bfa98a", y + h + 5, y + h + 11), 2) + rect(x - 9, y + h + 11, w + 18, 4, "#05061a", 2, op(0.14));
  if (look.snow) s += path(`M${n(x - 10)} ${n(y + h + 5.5)}q${n(w * 0.3)} -5 ${n(w * 0.55)} -1.500t${n(w * 0.45 + 20)} 0.500v2H${n(x - 10)}Z`, p.snow);
  const sill = y + h + 5;
  if (look.rain || look.storm) {
    // The cat is up on the sill, watching the rain.
    const cx = x + w * 0.3;
    const fur = "#3f3850";
    s += `<g${p.poke("cat")}>`;
    s += `<path${p.move("sway", [cx + 9, sill], 0, 2.6)} d="M${n(cx + 9)} ${n(sill - 2)}q13 1 12 -9" stroke="${c(fur)}" stroke-width="3" stroke-linecap="round"/>`;
    s += path(`M${n(cx - 9)} ${n(sill)}Q${n(cx - 11)} ${n(sill - 20)} ${n(cx)} ${n(sill - 22)}Q${n(cx + 11)} ${n(sill - 20)} ${n(cx + 10)} ${n(sill)}Z`, v("#564c6e", "#322b42", sill - 22, sill));
    s += path(`M${n(cx - 7)} ${n(sill - 20)}Q${n(cx - 8)} ${n(sill - 31)} ${n(cx)} ${n(sill - 31)}Q${n(cx + 8)} ${n(sill - 31)} ${n(cx + 7)} ${n(sill - 20)}Q${n(cx)} ${n(sill - 16)} ${n(cx - 7)} ${n(sill - 20)}Z`, c("#4a4160"));
    s += path(`M${n(cx - 7)} ${n(sill - 27)}l-0.500 -7l5 3.500ZM${n(cx + 7)} ${n(sill - 27)}l0.500 -7l-5 3.500Z`, c("#4a4160"));
    s += `</g>`;
  } else {
    // A succulent and a watering can.
    const sx = x + w * 0.24;
    for (let i = 0; i < 7; i++) s += leaf(sx, sill - 8, 8 + (i % 2) * 2, -90 + (i - 3) * 26, c(i % 2 ? "#78bf7e" : "#4f9a62"), 0.5);
    s += pot(p, sx, sill, 14, 8, "#f1eef7");
    const wx = x + w * 0.74;
    s += stroke(`M${n(wx + 7)} ${n(sill - 9)}l9 -5`, c("#7fb0c8"), 2.4) + stroke(`M${n(wx - 7)} ${n(sill - 11)}q-7 3 0 8`, c("#7fb0c8"), 1.8);
    s += rect(wx - 7, sill - 13, 14, 13, p.h("#a8d0e0", "#6a9ab4", wx - 7, wx + 7), 2);
  }
  // Curtains, tied back, breathing with the room.
  const drape = (side: 1 | -1, delay: number) => {
    const ex = side === 1 ? x - 14 : x + w + 14;
    const inX = ex + side * 30;
    const fabric = lin(ex, 0, inX, 0, [[0, c(look.accent, side === 1 ? 0.45 : 0.1)], [0.5, c(look.accent, 0.3)], [1, c(look.accent, side === 1 ? 0.05 : 0.4)]]);
    let d = path(`M${n(ex)} ${n(y - 11)}H${n(inX)}Q${n(inX + side * 2)} ${n(y + h * 0.4)} ${n(ex + side * 9)} ${n(y + h * 0.62)}Q${n(ex + side * 20)} ${n(y + h * 0.8)} ${n(ex + side * 17)} ${n(y + h + 18)}H${n(ex)}Z`, fabric, op(0.94));
    for (const t of [0.3, 0.6]) d += stroke(`M${n(ex + side * 30 * t)} ${n(y - 10)}Q${n(ex + side * 24 * t)} ${n(y + h * 0.4)} ${n(ex + side * 6)} ${n(y + h * 0.6)}`, c(look.accent, -0.2), 0.8, op(0.5));
    d += rect(Math.min(ex + side * 2, ex + side * 13), y + h * 0.6, 11, 3.4, c("#f6ead2"), 1.7);
    return `<g${p.move("rustle", [ex, y - 11], delay, 9)}>${d}</g>`;
  };
  return s + drape(1, 0) + drape(-1, 3);
}

/** A cork board: today's date, the weather, a photograph and a few notes. */
function pinboard(p: Paint, x: number, y: number) {
  const { c, v, look } = p;
  const w = 152;
  const h = 108;
  let s = rect(x + 2, y + 3, w, h, "#05061a", 5, op(0.18)) + rect(x, y, w, h, v("#c99a66", "#a8744b", y, y + h), 5) + rect(x + 5, y + 5, w - 10, h - 10, v("#e3c08f", "#d0a878", y, y + h), 2.5);
  const r = rng(53);
  for (let i = 0; i < 40; i++) s += circ(x + 8 + r() * (w - 16), y + 8 + r() * (h - 16), 0.7, c("#b8875a"), op(0.5));
  s += festiveLine(p, x + 8, x + w - 8, y + 7, 5);
  const pin = (px: number, py: number, color: string) => circ(px + 0.5, py + 1, 2.2, "#05061a", op(0.25)) + circ(px, py, 2.2, c(color)) + circ(px - 0.6, py - 0.6, 0.7, "#ffffff", op(0.7));
  // The calendar page.
  const cx = x + 14;
  const cy = y + 20;
  s += rect(cx + 1.4, cy + 2, 40, 48, "#05061a", 2, op(0.2)) + rect(cx, cy, 40, 48, c("#fffaf0"), 2) + rect(cx, cy, 40, 12, c(look.accent), 2) + rect(cx, cy + 8, 40, 4, c(look.accent));
  s += label(cx + 20, cy + 9, MONTHS[look.month] ?? "", 7.5, c("#ffffff"), { spacing: 1 });
  s += label(cx + 20, cy + 34, String(look.day), 21, c("#3a2c26"), { weight: 800 });
  s += label(cx + 20, cy + 43.5, DAYS[look.weekday] ?? "", 6, c("#8a7a6a"), { spacing: 1.2 });
  s += pin(cx + 20, cy + 1, "#d9423f");
  // The weather, on a card.
  const wx = x + 66;
  const wy = y + 16;
  s += `<g transform="rotate(-4 ${n(wx + 17)} ${n(wy + 17)})">${rect(wx + 1, wy + 1.6, 34, 34, "#05061a", 2, op(0.2))}${rect(wx, wy, 34, 34, c("#eaf3ff"), 2)}${weatherMark(p, wx + 17, wy + 18, 11, c("#8fa3c0"))}</g>`;
  s += pin(wx + 17, wy + 2, "#3f7fd6");
  // A photograph of somewhere far away.
  const px = x + 104;
  const py = y + 22;
  s += `<g transform="rotate(5 ${n(px + 18)} ${n(py + 22)})">${rect(px + 1, py + 2, 36, 44, "#05061a", 1.5, op(0.2))}${rect(px, py, 36, 44, c("#fffdf8"), 1.5)}${rect(px + 3, py + 3, 30, 29, v("#8fc4f0", "#fbd9a8", py + 3, py + 32))}${path(`M${n(px + 3)} ${n(py + 32)}l9 -14l6 8l5 -5l10 11Z`, c("#5c7f8a"))}${circ(px + 26, py + 10, 3, c("#fff3d6"))}${stroke(`M${n(px + 8)} ${n(py + 38)}h18`, c("#b8a898"), 0.9)}</g>`;
  s += pin(px + 18, py + 2, "#3f9a5a");
  // Sticky notes.
  const note = (nx: number, ny: number, color: string, rot: number, lines: number) => {
    let o = rect(nx + 1, ny + 1.6, 26, 24, "#05061a", 1, op(0.18)) + path(`M${n(nx)} ${n(ny)}h26v19l-5 5h-21Z`, c(color)) + path(`M${n(nx + 26)} ${n(ny + 19)}l-5 5v-5Z`, c(color, -0.2));
    for (let i = 0; i < lines; i++) o += stroke(`M${n(nx + 4)} ${n(ny + 6 + i * 4.6)}h${n(i === lines - 1 ? 10 : 17)}`, c("#8a7a4a"), 0.9, op(0.75));
    return `<g transform="rotate(${rot} ${n(nx + 13)} ${n(ny + 12)})">${o}</g>`;
  };
  s += note(x + 62, y + 62, "#ffe07a", 3, 3) + note(x + 96, y + 72, "#ffc2d6", -6, 2) + note(x + 22, y + 76, "#b9e3c0", -3, 2);
  return s;
}

function armchair(p: Paint, g: number) {
  const { c, v, look } = p;
  const body = "#5a8f96";
  let s = p.shadow(118, g + 1, 66, 5);
  // Feet.
  for (const x of [76, 156]) s += path(`M${x} ${g - 10}h7l-1.400 10h-4.200Z`, p.h("#9a6a45", "#6e4a31", x, x + 7));
  // Back, with buttons.
  s += rect(72, g - 120, 94, 90, lin(72, g - 120, 166, g - 30, [[0, c(body, 0.22)], [0.6, c(body)], [1, c(body, -0.25)]]), 24);
  s += rect(80, g - 113, 78, 62, v(toHex(mix(hex(body), [255, 255, 255], 0.16)), body, g - 113, g - 51), 18, op(0.6));
  for (const [bx, by] of [[98, g - 94], [119, g - 98], [140, g - 94], [108, g - 76], [130, g - 76]] as const) s += circ(bx, by, 1.6, c(body, -0.35)) + circ(bx - 0.5, by - 0.5, 0.6, c(body, 0.5));
  // Seat and skirt.
  s += rect(70, g - 44, 98, 36, v(toHex(mix(hex(body), [255, 255, 255], 0.05)), toHex(mix(hex(body), [12, 10, 24], 0.3)), g - 44, g - 8), 8);
  s += rect(80, g - 64, 78, 24, v(toHex(mix(hex(body), [255, 255, 255], 0.3)), body, g - 64, g - 40), 10);
  s += stroke(`M84 ${g - 44}h70`, c(body, -0.35), 1, op(0.6));
  // A cushion in the room's accent.
  s += `<g transform="rotate(-12 104 ${g - 76})">${rect(90, g - 90, 30, 28, lin(90, g - 90, 120, g - 62, [[0, c(look.accent, 0.3)], [1, c(look.accent, -0.2)]]), 7)}${stroke(`M96 ${g - 84}l18 16M114 ${g - 84}l-18 16`, c(look.accent, 0.5), 0.8, op(0.6))}</g>`;
  // Arms, rounded and lit on top.
  for (const x of [58, 152]) {
    s += rect(x, g - 78, 26, 70, lin(x, 0, x + 26, 0, [[0, c(body, 0.2)], [0.5, c(body)], [1, c(body, -0.3)]]), 12);
    s += rect(x + 4, g - 76, 18, 5, c(body, 0.4), 2.5, op(0.5));
  }
  // A blanket over the far arm.
  s += path(`M150 ${g - 80}q14 -5 29 0l1.500 40q-8 3 -16 0t-15 1Z`, v("#f6ead2", "#d9c8a8", g - 82, g - 38));
  for (const dy of [10, 20, 30]) s += stroke(`M150.500 ${g - 80 + dy}q14 -4 29 0`, c("#d9574a"), 1.6, op(0.75));
  for (let i = 0; i < 7; i++) s += stroke(`M${152 + i * 4.2} ${g - 40}v4`, c("#d9c8a8"), 1);
  // An open book, face down, keeping someone's place.
  s += path(`M108 ${g - 64}l14 -6l14 6l-14 2.500Z`, c("#46669c")) + stroke(`M108 ${g - 64}l14 2.500l14 -2.500`, c("#f6ead2"), 1.2);
  return s;
}

function floorLamp(p: Paint, g: number) {
  const { c, glow } = p;
  const x = 194;
  let s = p.shadow(x, g + 1, 16, 2.4);
  s += `<g${p.light}>${beam(160, g - 196, 14, 62, g - 40, "#ffd58a", glow * 0.36)}${halo(160, g - 190, 60, "#ffd58a", glow)}</g>`;
  s += path(`M${x - 13} ${g}q0 -5 13 -5t13 5Z`, p.chrome("#8a8296", x - 13, x + 13));
  s += stroke(`M${x} ${g - 4}V${g - 196}Q${x} ${g - 226} ${x - 26} ${g - 224}`, c("#4a4658"), 3) + stroke(`M${x - 0.8} ${g - 6}V${g - 196}`, c("#b0acc4"), 0.8, op(0.7));
  s += `<g${p.poke("light")}>`;
  s += path(`M${x - 38} ${g - 226}h14l12 30h-38Z`, lin(x - 50, 0, x - 12, 0, [[0, c("#f6ead2", 0.2)], [0.5, c("#f0dcb8")], [1, c("#c9a878")]]));
  s += `<g${p.light}>${path(`M${x - 38} ${g - 226}h14l12 30h-38Z`, "#ffe9b0", op(glow * 0.7))}${ell(x - 31, g - 196, 17, 3, "#fff6d8", op(0.3 + glow * 0.7))}</g>`;
  s += stroke(`M${x - 24} ${g - 194}v10`, c("#c9b79a"), 0.8) + circ(x - 24, g - 183, 1.5, c("#c9744a"));
  return s + `</g>`;
}

function monstera(p: Paint, x: number, g: number) {
  const { c } = p;
  const dark = c("#2f6a48");
  const mid = c("#3f8a58");
  const lite = c("#5aa868");
  let s = p.shadow(x, g + 1, 20, 3);
  const big = (lx: number, ly: number, len: number, angle: number, fill: string, delay: number) => {
    let o = stroke(`M${n(x)} ${n(g - 28)}Q${n((x + lx) / 2)} ${n(ly + 10)} ${n(lx)} ${n(ly)}`, dark, 1.6);
    let l = `<path d="M0 0Q${n(len * 0.3)} ${n(-len * 0.52)} ${n(len * 0.78)} ${n(-len * 0.4)}Q${n(len * 1.02)} ${n(-len * 0.2)} ${n(len)} 0Q${n(len * 1.02)} ${n(len * 0.2)} ${n(len * 0.78)} ${n(len * 0.4)}Q${n(len * 0.3)} ${n(len * 0.52)} 0 0Z" fill="${fill}"/>`;
    l += stroke(`M${n(len * 0.06)} 0H${n(len * 0.9)}`, dark, 0.9, op(0.7));
    // The splits that make it a monstera.
    for (const t of [0.34, 0.54, 0.72]) for (const sgn of [-1, 1]) l += path(`M${n(len * t)} ${n(sgn * len * 0.1)}l${n(len * 0.14)} ${n(sgn * len * 0.34)}l${n(-len * 0.07)} ${n(-sgn * len * 0.3)}Z`, "#0a1410", op(0.3));
    o += `<g transform="translate(${n(lx)} ${n(ly)}) rotate(${angle})">${l}</g>`;
    return `<g${p.move("sway", [x, g - 28], delay, 8 + delay)}>${o}</g>`;
  };
  s += big(x - 20, g - 70, 30, -150, mid, 0) + big(x + 14, g - 82, 28, -50, dark, 1.5) + big(x - 4, g - 100, 34, -100, lite, 3) + big(x + 20, g - 56, 22, -18, mid, 2);
  s += pot(p, x, g, 32, 28, "#f1eef7");
  s += stroke(`M${x - 12} ${g - 18}q12 4 24 0`, c("#c9c4d6"), 0.8, op(0.7));
  return s;
}

export function workstationRail(p: Paint, H: number): string {
  const { c, v, look } = p;
  const g = H - 8;
  let s = "";
  const top = 92;
  const win = H >= 560;
  if (win) s += windowPane(p, 44, top, 164, 150);
  // What hangs on the wall between the window and the lamp depends on the room there is.
  const from = win ? top + 190 : 80;
  const to = g - 250;
  if (to - from >= 124) s += pinboard(p, 52, from + (to - from - 108) * 0.45);
  if (to - from >= 300) {
    const y = from + (to - from - 108) * 0.45 + 150;
    s += `<g${p.poke("clock")}>${clock(p, 126, y, 22, "#3a3d50")}</g>`;
  }

  // The floor of the corner: a round rug.
  s += ell(118, g + 1, 114, 7, v("#c98a6a", "#a86a4e", g - 6, g + 8)) + ell(118, g + 1, 96, 5.4, c("#f0d9b8"), op(0.5)) + ell(118, g + 1, 76, 4, c("#c98a6a"), op(0.8));
  s += floorLamp(p, g);
  s += armchair(p, g);
  s += monstera(p, 222, g);

  // A side table: a mug, books, and whatever the day brings.
  const tx = 34;
  const ty = g - 58;
  s += p.shadow(tx, g + 1, 18, 2.4);
  s += stroke(`M${tx} ${ty}V${g - 3}`, c("#6e4a31"), 3) + path(`M${tx - 13} ${g}q0 -4 13 -4t13 4Z`, p.h("#9a6a45", "#6e4a31", tx - 13, tx + 13));
  s += ell(tx, ty + 1.6, 25, 3.4, "#05061a", op(0.2)) + ell(tx, ty, 25, 3.6, v("#d6a273", "#a8744b", ty - 4, ty + 4)) + ell(tx, ty - 0.8, 23, 2.4, c("#e8bc8c"), op(0.6));
  const special = festiveProp(p, tx - 2, ty - 1, 0.62);
  if (special) s += special;
  else {
    s += books(p, tx - 20, ty - 1, [[24, 4.6, "#46669c"]]) + rect(tx - 18, ty - 10, 20, 4.4, c("#e58a6c"), 1);
    s += steam(p, tx + 8, ty - 15, c("#ffffff"));
    s += stroke(`M${tx + 15} ${ty - 9}q5 0 5 3.500t-5 3`, c("#e4dfd3"), 1.8) + path(`M${tx + 4} ${ty - 12}h12v8q0 3 -3.500 3h-5q-3.500 0 -3.500 -3Z`, p.h("#fbf8f1", "#cfc8b8", tx + 4, tx + 16));
    if (look.snow) for (const dx of [7, 10.5, 13]) s += circ(tx + dx, ty - 12.4, 1.5, c("#ffffff"));
  }
  // Slippers kicked off by the chair.
  s += ell(92, g + 2, 8, 3, c("#e58a6c")) + ell(89.5, g + 1.6, 4.6, 2.2, c("#f6c4a8")) + `<g transform="rotate(-18 112 ${g + 3})">${ell(112, g + 3, 8, 3, c("#e58a6c"))}${ell(109.5, g + 2.6, 4.6, 2.2, c("#f6c4a8"))}</g>`;
  return s;
}

// ---- floor: boards along the bottom of the page (any width x 64) ----

export function workstationFloor(p: Paint, W: number): string {
  const { c, v, look } = p;
  const r = rng(61);
  const g = 54;
  let s = "";
  // Skirting board fading away to the right, then the boards.
  s += rect(0, g, W, 10, lin(0, 0, W, 0, [[0, c("#b4835a"), 0.95], [0.5, c("#a8744b"), 0.7], [1, c("#a8744b"), 0.5]]));
  s += rect(0, g, W, 1.2, c("#e8bc8c"), 0, op(0.7));
  for (let x = 40 + r() * 40; x < W; x += 70 + r() * 60) s += stroke(`M${n(x)} ${g + 1.5}V64`, c("#6e4a31"), 0.8, op(0.5));

  // A wire waste-basket that has seen a few drafts.
  const bx = 44;
  s += p.shadow(bx, g + 1, 20, 2.6);
  s += circ(bx - 4, g - 30, 5, c("#fbf8f1")) + circ(bx + 5, g - 32, 4.4, c("#e9e4d8")) + stroke(`M${bx - 6} ${g - 31}l3 2l2 -3M${bx + 3} ${g - 33}l3 1.500`, c("#b8b0a0"), 0.6);
  s += path(`M${bx - 15} ${g - 30}h30l-4 30h-22Z`, c("#5a5f7c"), op(0.28));
  for (let i = 0; i <= 6; i++) s += stroke(`M${n(bx - 15 + i * 5)} ${g - 30}L${n(bx - 11 + i * 3.67)} ${g}`, c("#5a5f7c"), 0.9);
  s += stroke(`M${bx - 13.6} ${g - 20}h27.200M${bx - 12.2} ${g - 10}h24.400`, c("#5a5f7c"), 0.9) + rect(bx - 16.5, g - 32, 33, 3, p.chrome("#8a8fa8", bx - 16, bx + 17), 1.5);
  for (const [px, pr] of [[74, 4.6], [86, 3.4], [16, 3.8]] as const) s += p.shadow(px, g + 0.6, pr * 1.3, 1.2, 0.8) + circ(px, g - pr + 0.6, pr, c("#fbf8f1")) + stroke(`M${n(px - pr * 0.6)} ${n(g - pr)}l${n(pr * 0.5)} ${n(pr * 0.4)}l${n(pr * 0.4)} ${n(-pr * 0.7)}`, c("#b8b0a0"), 0.6);

  // Moving boxes that never got unpacked (or today's presents).
  if (W > 420) {
    const x0 = 118;
    if (look.celebration) s += gift(p, x0 + 16, g, 1.6, "#d9423f", "#ffd166") + gift(p, x0 + 44, g, 1.1, "#3f7fd6", "#f5f1ea") + gift(p, x0 + 22, g - 22, 0.9, "#3f9a5a", "#f5f1ea");
    else {
      s += p.shadow(x0 + 26, g + 1, 34, 3);
      s += rect(x0, g - 26, 44, 26, p.h("#d9b07c", "#b08a58", x0, x0 + 44), 1.5) + rect(x0, g - 26, 44, 5, c("#c99a66")) + rect(x0 + 18, g - 26, 8, 12, c("#f0dcb8"), 0, op(0.8));
      s += rect(x0 + 8, g - 44, 30, 18, p.h("#e3bc8a", "#b89464", x0 + 8, x0 + 38), 1.5) + rect(x0 + 8, g - 44, 30, 4, c("#c99a66")) + stroke(`M${x0 + 14} ${g - 34}h12M${x0 + 14} ${g - 31}h8`, c("#8a6a44"), 0.9);
      // A vinyl record leaning against them.
      s += circ(x0 + 58, g - 14, 14, c("#2a2738")) + circ(x0 + 58, g - 14, 10, c("#3a3650"), op(0.8)) + circ(x0 + 58, g - 14, 4.4, c(look.accent)) + circ(x0 + 58, g - 14, 1, c("#fbf8f1"));
    }
  }
  // A power strip and a cable wandering off toward the lamp.
  if (W > 620) {
    const x0 = 230;
    s += rect(x0, g - 5, 34, 5.4, v("#fbf8f1", "#cfc8b8", g - 5, g), 2) + circ(x0 + 29, g - 2.4, 1.2, "#ff6f6f", op(0.5 + p.glow * 0.5));
    for (const dx of [5, 12, 19]) s += rect(x0 + dx, g - 3.6, 3.6, 2.4, c("#8a8296"), 0.6);
    let d = `M${x0 + 34} ${g - 2}`;
    for (let x = x0 + 34; x < W - 300; x += 90) d += `q22 -7 45 0t45 0`;
    s += stroke(d, c("#3a3650"), 1.3, op(0.8));
  }
  // A paper plane that did not make it to the basket.
  if (W > 760) {
    const x0 = W * 0.52;
    s += p.shadow(x0 + 12, g + 1, 13, 1.4, 0.7);
    s += `<g${p.poke("plane")}><g${p.move("float", undefined, 1)}>${path(`M${n(x0)} ${g - 6}l26 -10l-9 14l-5 -3Z`, c("#fbf8f1"))}${path(`M${n(x0 + 26)} ${g - 16}l-14 11l5 3Z`, c("#d9d2c2"))}</g></g>`;
  }
  // Rain finds the one leak in the ceiling.
  if (look.rain && W > 560) {
    const x0 = W * 0.4;
    s += p.shadow(x0, g + 1, 14, 2);
    s += `<circle${p.move("drip", undefined, 0, 1.6)} cx="${n(x0)}" cy="6" r="1.500" fill="#9fd0ff"/>`;
    s += path(`M${n(x0 - 11)} ${g - 17}h22l-2.500 17h-17Z`, p.h("#8fb8e0", "#5a86b4", x0 - 11, x0 + 11)) + ell(x0, g - 17, 11, 2.2, c("#cfe6ff")) + ell(x0, g - 16.6, 9, 1.4, c("#6a9fd0"));
    s += stroke(`M${n(x0 - 11)} ${g - 16}q11 -17 22 0`, c("#8a8fa8"), 1.1);
  }
  return s;
}

// ---- perch: what sits on top of a dialog (120 x 44, standing on the bottom edge) ----

export function workstationPerch(p: Paint): string {
  const { c, v } = p;
  const g = 44;
  let s = "";
  // The cat, loafing.
  s += stroke(`M48 ${g - 3}q-16 1 -17 -9`, c("#3f3850"), 3.4);
  s += path(`M44 ${g}Q41 ${g - 20} 62 ${g - 21}Q84 ${g - 22} 86 ${g}Z`, v("#564c6e", "#322b42", g - 21, g));
  s += path(`M68 ${g}Q66 ${g - 12} 72 ${g - 15}L72.500 ${g - 21}L77 ${g - 16.5}Q80 ${g - 17} 82 ${g - 16}L86 ${g - 20}L86.500 ${g - 14}Q89.500 ${g - 9} 87 ${g}Z`, v("#5e5478", "#3a3250", g - 21, g));
  s += path(`M73.300 ${g - 18.5}l0.300 2.400l1.900 -0.900ZM85.200 ${g - 17.5}l-1.500 1.400l1.700 0.900Z`, c("#e9a3b4"));
  s += stroke(`M73.500 ${g - 9}q1.500 1.400 3 0M80 ${g - 9}q1.500 1.400 3 0`, c("#d6cfe8"), 0.9) + path(`M77.600 ${g - 6.6}l0.800 0.900l0.800 -0.900Z`, c("#e9a3b4"));
  s += stroke(`M74 ${g - 5.4}l-5 -0.600M74 ${g - 4.4}l-4.600 1M83 ${g - 5.4}l5 -0.600M83 ${g - 4.4}l4.600 1`, c("#d6cfe8"), 0.4, op(0.7));
  // A mug beside it.
  s += stroke(`M107 ${g - 9}q5 0 5 3.500t-5 3`, c("#e4dfd3"), 1.8) + path(`M96 ${g - 12}h12v9q0 3 -3.500 3h-5q-3.500 0 -3.500 -3Z`, p.h("#fbf8f1", "#cfc8b8", 96, 108)) + rect(96, g - 8.5, 12, 2.6, c(p.look.accent));
  // A pencil.
  s += `<g transform="rotate(-3 14 ${g - 2})">${rect(4, g - 3.6, 20, 3, c("#f0b83a"), 0.6)}${path(`M24 ${g - 3.6}l5 1.500l-5 1.500Z`, c("#f0d9b8"))}${rect(2, g - 3.6, 3, 3, c("#e9a3b4"), 1)}</g>`;
  return s;
}
