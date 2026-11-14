// Forest, the rest of the wood: a bough over the sidebar, a great old tree up the right side
// of the page (somebody lives in it), the forest floor along the bottom, and the things that
// grow on top of dialogs. The leaves follow the season where the device is.

import { circ, ell, fern, flower, halo, leaf, lin, n, n3, op, path, radial, rect, rng, stroke, type Paint } from "./kit";
import { balloons, festiveLine, festiveProp } from "./props";

/** Leaf colors for the season: fresh in spring, deep in summer, turning in autumn, few in winter. */
export function seasonLeaves(p: Paint): { leaves: string[]; deep: string[]; rib: string; density: number; blossom?: string } {
  const { c } = p;
  switch (p.look.season) {
    case "spring":
      return { leaves: [c("#5aa868"), c("#7cc07a"), c("#a6d88a"), c("#8fd09a"), c("#c2e59a")], deep: [c("#2f7048"), c("#3f8a58")], rib: c("#2f7048"), density: 0.9, blossom: c("#ffc2d6") };
    case "autumn":
      return { leaves: [c("#c9642a"), c("#e08a2e"), c("#e9b23a"), c("#b8472a"), c("#9aa03a")], deep: [c("#8a3f22"), c("#a8572a")], rib: c("#7a3a1e"), density: 0.85 };
    case "winter":
      return { leaves: [c("#8a7a5a"), c("#6f7f5a"), c("#9a8a62"), c("#5f7a5a"), c("#7a6a4a")], deep: [c("#4f4a3a"), c("#5a5a42")], rib: c("#4a4232"), density: 0.45 };
    default:
      return { leaves: [c("#2f7048"), c("#3f8a58"), c("#5aa868"), c("#7cc07a"), c("#96cc7c")], deep: [c("#1f5638"), c("#2a6644")], rib: c("#1f5638"), density: 1 };
  }
}

function toadstool(p: Paint, x: number, y: number, k: number, cap: string, lit = true) {
  const { c, look } = p;
  let o = (lit ? halo(x, y - 9 * k, 16 * k, "#ffd9c2", p.glow * 0.8) : "") + p.shadow(x, y + 0.5, 7 * k, 1.6 * k, 0.9);
  o += path(`M${n(x - 2.4 * k)} ${n(y)}Q${n(x - 1.3 * k)} ${n(y - 6 * k)} ${n(x - 1.9 * k)} ${n(y - 10 * k)}H${n(x + 1.9 * k)}Q${n(x + 1.3 * k)} ${n(y - 6 * k)} ${n(x + 2.4 * k)} ${n(y)}Z`, p.h("#fbf2e2", "#cdbfa6", x - 2.4 * k, x + 2.4 * k));
  o += ell(x, y - 9 * k, 8.4 * k, 1.9 * k, c("#e9d8bf"));
  o += path(
    `M${n(x - 9 * k)} ${n(y - 9 * k)}Q${n(x - 8.4 * k)} ${n(y - 19 * k)} ${n(x)} ${n(y - 19.5 * k)}Q${n(x + 8.4 * k)} ${n(y - 19 * k)} ${n(x + 9 * k)} ${n(y - 9 * k)}Q${n(x)} ${n(y - 7.4 * k)} ${n(x - 9 * k)} ${n(y - 9 * k)}Z`,
    look.snow ? p.snow : lin(x - 6 * k, y - 20 * k, x + 6 * k, y - 8 * k, [[0, c(cap, 0.25)], [1, c(cap, -0.3)]]),
  );
  if (!look.snow) for (const [dx, dy, r] of [[-3.6, -13, 1.6], [2.4, -15.6, 1.3], [5, -11.6, 1]] as const) o += ell(x + dx * k, y + dy * k, r * k, r * 0.8 * k, "#fff6ea", op(0.92));
  return o;
}

const firefly = (p: Paint, r: () => number, x: number, y: number) =>
  `<g${p.move("firefly", undefined, r() * 9, 7 + r() * 6)}>${halo(x, y, 6, "#f4ff9a", p.night)}${circ(x, y, 1.2, "#fbffc8", op(p.night))}</g>`;

function owl(p: Paint, x: number, y: number, k: number) {
  const { c, v } = p;
  const awake = p.night > 0.5;
  let s = path(`M${n(x - 9 * k)} ${n(y + 12 * k)}Q${n(x - 12 * k)} ${n(y - 10 * k)} ${n(x)} ${n(y - 12 * k)}Q${n(x + 12 * k)} ${n(y - 10 * k)} ${n(x + 9 * k)} ${n(y + 12 * k)}Z`, v("#a8825a", "#6c4a36", y - 12 * k, y + 12 * k));
  s += path(`M${n(x - 8 * k)} ${n(y - 8 * k)}l${n(1 * k)} ${n(-6 * k)}l${n(4.4 * k)} ${n(3.4 * k)}ZM${n(x + 8 * k)} ${n(y - 8 * k)}l${n(-1 * k)} ${n(-6 * k)}l${n(-4.4 * k)} ${n(3.4 * k)}Z`, c("#8a6444"));
  s += ell(x, y + 5 * k, 5.4 * k, 6.4 * k, c("#e9d2ae"));
  for (const dy of [2, 5, 8]) s += stroke(`M${n(x - 3 * k)} ${n(y + dy * k)}q${n(1.5 * k)} ${n(1.4 * k)} ${n(3 * k)} 0t${n(3 * k)} 0`, c("#b08a5e"), 0.7 * k);
  for (const sx of [-1, 1]) {
    const ex = x + sx * 4.2 * k;
    const ey = y - 4 * k;
    s += circ(ex, ey, 4 * k, c("#f3e2c4"));
    if (awake) s += halo(ex, ey, 6 * k, "#ffe08a", p.glow * 0.8) + `<g${p.move("blink-eye", [ex, ey], sx)}>${circ(ex, ey, 2.7 * k, "#ffd23a")}${circ(ex, ey, 1.4 * k, "#1e1a1e")}${circ(ex - 0.5 * k, ey - 0.6 * k, 0.5 * k, "#ffffff")}</g>`;
    else s += stroke(`M${n(ex - 2.2 * k)} ${n(ey)}q${n(2.2 * k)} ${n(2 * k)} ${n(4.4 * k)} 0`, c("#4f3426"), 0.9 * k);
  }
  s += path(`M${n(x - 1.3 * k)} ${n(y - 1.6 * k)}h${n(2.6 * k)}l${n(-1.3 * k)} ${n(2.8 * k)}Z`, c("#e9a23a"));
  return `<g${p.poke("owl")}>${s}</g>`;
}

function rabbit(p: Paint, x: number, g: number) {
  const { c, v } = p;
  let s = p.shadow(x, g + 0.6, 15, 2.4);
  s += circ(x + 12, g - 6, 4.4, c("#fffaf2"));
  s += path(`M${x - 9} ${g}Q${x - 13} ${g - 20} ${x + 2} ${g - 21}Q${x + 15} ${g - 20} ${x + 13} ${g}Z`, v("#d9b48c", "#a8825e", g - 21, g));
  s += `<g${p.move("bob", [x - 6, g - 26], 1, 6)}>${path(`M${x - 9} ${g - 28}Q${x - 13} ${g - 46} ${x - 8} ${g - 47}Q${x - 4} ${g - 44} ${x - 5} ${g - 28}Z`, c("#c9a47c"))}${path(`M${x - 8} ${g - 30}Q${x - 10.5} ${g - 42} ${x - 8} ${g - 44}Q${x - 6} ${g - 41} ${x - 6.4} ${g - 30}Z`, c("#f0bfc0"))}</g>`;
  s += path(`M${x - 3} ${g - 28}Q${x - 2} ${g - 46} ${x + 3} ${g - 46}Q${x + 6} ${g - 42} ${x + 1} ${g - 27}Z`, c("#d9b48c"));
  s += ell(x - 5, g - 22, 8.6, 7.4, v("#e0bc94", "#b89068", g - 30, g - 14));
  s += circ(x - 8, g - 23.5, 1.2, c("#2a1e1e")) + circ(x - 8.3, g - 23.9, 0.4, "#ffffff") + circ(x - 13, g - 20.5, 1, c("#e9a3b4")) + ell(x - 10, g - 18.5, 2.6, 1.8, c("#fffaf2"));
  s += ell(x - 3, g - 2, 6, 2.4, c("#e0bc94"));
  return `<g${p.poke("rabbit")}>${s}</g>`;
}

function frog(p: Paint, x: number, g: number) {
  const { c, v } = p;
  let s = p.shadow(x, g + 0.6, 12, 2);
  // A leaf for an umbrella.
  s += stroke(`M${x + 8} ${g - 8}Q${x + 13} ${g - 24} ${x + 4} ${g - 34}`, c("#3f8a58"), 1.4);
  s += `<g${p.move("rustle", [x + 4, g - 34], 0, 3)}>${path(`M${x - 16} ${g - 30}Q${x + 2} ${g - 48} ${x + 24} ${g - 30}Q${x + 4} ${g - 37} ${x - 16} ${g - 30}Z`, lin(x - 16, 0, x + 24, 0, [[0, c("#7cc07a")], [1, c("#3f8a58")]]))}${stroke(`M${x + 4} ${g - 40}V${g - 34}`, c("#2f7048"), 0.8)}</g>`;
  s += ell(x, g - 6, 10.5, 6.6, v("#8fd06a", "#4f9a48", g - 13, g));
  s += ell(x - 7, g - 1.6, 5, 2, c("#5aa850")) + ell(x + 7, g - 1.6, 5, 2, c("#4f9a48"));
  for (const sx of [-1, 1]) s += circ(x + sx * 4.6, g - 12.4, 3.2, c("#8fd06a")) + circ(x + sx * 4.6, g - 12.8, 1.9, "#fffaf0") + `<g${p.move("blink-eye", [x + sx * 4.6, g - 12.8], sx * 0.2)}>${circ(x + sx * 4.6, g - 12.8, 1, "#1e1a1e")}</g>`;
  s += stroke(`M${x - 4} ${g - 5.4}q4 2.600 8 0`, c("#2f6a34"), 0.9);
  return `<g${p.poke("frog")}>${s}</g>`;
}

function snowman(p: Paint, x: number, g: number) {
  const { c } = p;
  const ball = (cy: number, r: number) => circ(x, cy, r, radial(x - r * 0.35, cy - r * 0.4, r * 1.5, [[0, "#ffffff"], [0.7, p.snow], [1, c("#b9c4e0")]]));
  let s = p.shadow(x, g + 0.6, 18, 3);
  s += stroke(`M${x - 9} ${g - 24}l-13 -8M${x - 18} ${g - 29.5}l-2 -5M${x + 9} ${g - 24}l13 -9M${x + 18} ${g - 30}l5 -1`, c("#6c4a36"), 1.4);
  s += ball(g - 12, 13) + ball(g - 30, 9.5) + ball(g - 44, 7);
  s += rect(x - 9.5, g - 39, 19, 4, c(p.look.accent), 2) + path(`M${x + 4} ${g - 37}h5l1 11h-5Z`, c(p.look.accent, -0.2));
  s += rect(x - 5.5, g - 59, 11, 9, c("#2a2738"), 1.2) + rect(x - 8.5, g - 51.5, 17, 2.6, c("#2a2738"), 1.3) + rect(x - 5.5, g - 54, 11, 2, c("#d9423f"));
  s += circ(x - 2.6, g - 46, 0.9, c("#1e1a1e")) + circ(x + 2.6, g - 46, 0.9, c("#1e1a1e")) + path(`M${x} ${g - 44.5}l8 1.600l-8 1.200Z`, c("#f08a2e"));
  for (const dy of [-30, -25, -14]) s += circ(x, g + dy, 1, c("#3a3650"));
  return `<g${p.poke("snowman")}>${s}</g>`;
}

function hedgehog(p: Paint, x: number, g: number) {
  const { c, v } = p;
  let s = p.shadow(x, g + 0.6, 14, 2);
  s += path(`M${x - 12} ${g}Q${x - 14} ${g - 15} ${x} ${g - 16}Q${x + 11} ${g - 15} ${x + 12} ${g - 4}L${x + 12} ${g}Z`, v("#8a6444", "#4f3426", g - 16, g));
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (1.02 + i * 0.075);
    s += stroke(`M${n(x + Math.cos(a) * 10)} ${n(g - 4 + Math.sin(a) * 9)}L${n(x + Math.cos(a) * 15.5)} ${n(g - 4 + Math.sin(a) * 14.5)}`, c(i % 2 ? "#6c4a36" : "#b08a5e"), 1.3);
  }
  s += path(`M${x + 6} ${g}Q${x + 5} ${g - 10} ${x + 13} ${g - 9}Q${x + 19} ${g - 6} ${x + 22} ${g - 2.5}Q${x + 19} ${g} ${x + 6} ${g}Z`, c("#e0bc94"));
  s += circ(x + 22, g - 2.6, 1.3, c("#2a1e1e")) + circ(x + 15, g - 6, 1, c("#2a1e1e")) + circ(x + 9.5, g - 8.5, 2, c("#c9a07a"));
  return `<g${p.poke("hedgehog")}>${s}</g>`;
}

// ---- crest: a bough over the top of the sidebar (272 x 60) ----

export function forestCrest(p: Paint): string {
  const { c, glow, look } = p;
  const r = rng(47);
  const pal = seasonLeaves(p);
  const bark = c("#6c4a36");
  let s = "";
  // The bough comes in from the left and thins out.
  s += path(`M-4 2Q70 22 150 15T272 8V12Q210 16 150 20T-4 14Z`, lin(0, 4, 0, 22, [[0, c("#9a7050")], [1, c("#4f3426")]]));
  s += stroke(`M20 9q40 8 90 8M150 16.500q50 -3 100 -7`, c("#c9a07a"), 0.8, op(0.5));
  s += stroke(`M96 17Q104 30 116 33M190 15Q196 26 206 27`, bark, 2.2);
  s += festiveLine(p, 8, 264, 20, 9);
  // Leaves in clusters along it.
  let leaves = "";
  for (let x = -4; x < 276; x += 13 + r() * 12) {
    if (r() > pal.density) continue;
    const y = 2 + (x < 150 ? x * 0.09 : 15 - (x - 150) * 0.05);
    let cluster = "";
    const count = 4 + Math.floor(r() * 3);
    for (let i = 0; i < count; i++) {
      const len = 9 + r() * 9;
      cluster += leaf(x, y - 3 + r() * 4, len, 15 + (i / (count - 1)) * 150 + (r() - 0.5) * 20, pal.leaves[Math.floor(r() * pal.leaves.length)]!, 0.42, len > 13 ? pal.rib : undefined);
    }
    if (look.snow && r() > 0.4) cluster += ell(x, y, 8, 2.4, p.snow, op(0.9));
    if (pal.blossom && r() > 0.55) cluster += flower(x + 3, y + 6 + r() * 5, 2.6, pal.blossom, c("#ffd166"));
    leaves += `<g${p.move("rustle", [x, y], r() * 6, 5 + r() * 4)}>${cluster}</g>`;
  }
  s += leaves;
  // A lantern hung from a twig: poke it to put it out.
  const lx = 116;
  s += `<g${p.move("sway", [lx, 33], 0, 7)}><g${p.poke("light")}>`;
  s += `<g${p.light}>${halo(lx, 47, 22, "#ffcf7a", glow)}</g>`;
  s += stroke(`M${lx} 33v5`, c("#55506a"), 1) + path(`M${lx - 6} 41l2 -3.500h8l2 3.500Z`, c("#55506a"));
  s += rect(lx - 5, 41, 10, 13, lin(lx - 5, 0, lx + 5, 0, [[0, "#fff2c4", 0.5 + glow * 0.5], [1, "#f0a850", 0.45 + glow * 0.45]]), 1.6);
  s += `<g${p.light}><path${p.move("flicker", [lx, 52])} d="M${lx} 44q3 4 0 8q-3 -3.500 0 -8Z" fill="#ff9d4a" opacity="${n3(0.6 + glow * 0.4)}"/></g>`;
  s += stroke(`M${lx - 5} 41v13M${lx + 5} 41v13`, c("#3b374c"), 1) + rect(lx - 6, 54, 12, 2.6, c("#55506a"), 1);
  s += `</g></g>`;
  // The owl dozes on the bough by day and watches by night.
  s += owl(p, 206, 16, 0.9);
  // Acorns, or a web hung with rain.
  if (look.rain) {
    s += stroke(`M236 12l16 26M252 10l-4 30M264 9l-22 26M240 22q9 3 18 -2M238 30q10 4 22 -6`, c("#ffffff"), 0.5, op(0.6));
    for (const [dx, dy] of [[244, 24], [252, 22], [249, 32], [258, 18]] as const) s += circ(dx, dy, 1, "#cfe6ff", op(0.9));
  } else
    for (const [ax, len] of [[240, 12], [250, 17]] as const) {
      s += `<g${p.move("sway", [ax, 11], ax * 0.1, 5)}>${stroke(`M${ax} 11v${len}`, bark, 0.8)}${ell(ax, 11 + len + 3.4, 2.8, 3.6, c("#c99a52"))}${path(`M${ax - 3.2} ${11 + len + 1.4}q3.200 -3.600 6.400 0Z`, c("#7a5236"))}</g>`;
    }
  if (p.night > 0.5) for (let i = 0; i < 4; i++) s += firefly(p, r, 20 + r() * 230, 30 + r() * 24);
  return s;
}

// ---- rail: the great tree up the right side of the page (240 wide, any height) ----

export function forestRail(p: Paint, H: number): string {
  const { c, v, glow, look } = p;
  const r = rng(59);
  const g = H - 8;
  const pal = seasonLeaves(p);
  const bark = c("#6c4a36");
  const snow = look.snow;
  let s = "";

  // Ground under the tree.
  s += path(`M0 ${g + 8}V${g - 2}Q40 ${g - 12} 96 ${g - 6}T240 ${g - 10}V${g + 8}Z`, snow ? v("#ffffff", "#c9d4ea", g - 12, g + 8) : v(pal.leaves[2]!, pal.deep[0]!, g - 12, g + 8));

  // A branch reaching out over the page, with a swing.
  const by = Math.max(150, g - 250);
  s += path(`M176 ${by + 6}Q110 ${by - 12} 36 ${by - 2}L36 ${by + 1}Q110 ${by - 2} 176 ${by + 22}Z`, lin(0, by - 8, 0, by + 20, [[0, c("#9a7050")], [1, c("#4f3426")]]));
  s += stroke(`M96 ${by - 6}Q84 ${by - 20} 70 ${by - 22}`, bark, 2.4);
  let twigs = "";
  for (const [tx, ty] of [[36, by - 1], [58, by - 6], [70, by - 22], [92, by - 8], [124, by - 6]] as const) {
    if (r() > pal.density + 0.2) continue;
    let cl = "";
    for (let i = 0; i < 6; i++) cl += leaf(tx, ty, 10 + r() * 9, -170 + i * 34 + (r() - 0.5) * 20, pal.leaves[Math.floor(r() * pal.leaves.length)]!, 0.44, i % 2 ? pal.rib : undefined);
    if (snow) cl += ell(tx, ty - 3, 10, 2.6, p.snow);
    if (pal.blossom) cl += flower(tx + 5, ty + 5, 2.8, pal.blossom, c("#ffd166"));
    twigs += `<g${p.move("rustle", [tx, ty], r() * 5, 5 + r() * 3)}>${cl}</g>`;
  }
  s += twigs + festiveLine(p, 44, 168, by + 4, 10);
  const sx = 84;
  const seat = g - 84;
  if (seat - by > 60) {
    let sw = stroke(`M${sx - 14} ${by}V${seat}M${sx + 14} ${by + 2}V${seat}`, c("#c9b79a"), 1.2);
    sw += rect(sx - 19, seat, 38, 4.6, v("#d6a273", "#a8744b", seat, seat + 5), 1.6) + rect(sx - 19, seat + 4, 38, 1.6, "#05061a", 0.8, op(0.2));
    if (look.celebration === "birthday" || look.celebration === "new-year") sw += balloons(p, sx + 15, seat, 0.7, ["#ff6f91", "#ffd166", "#5ec8e8"]);
    s += `<g${p.poke("swing")}><g${p.move("sway", [sx, by], 0, 5)}>${sw}</g></g>`;
  }

  // A leafy bough high up, so the trunk does not climb out of sight bare.
  if (H >= 520) {
    const ty = 138;
    s += path(`M178 ${ty + 10}Q130 ${ty - 14} 70 ${ty - 4}L70 ${ty - 1.5}Q130 ${ty - 4} 178 ${ty + 24}Z`, lin(0, ty - 10, 0, ty + 22, [[0, c("#9a7050")], [1, c("#4f3426")]]));
    let top = "";
    for (const [tx, tyy] of [[70, ty - 3], [92, ty - 8], [116, ty - 6], [142, ty], [160, ty + 6], [104, ty - 22], [136, ty - 20]] as const) {
      if (r() > pal.density + 0.25) continue;
      let cl = "";
      for (let i = 0; i < 7; i++) cl += leaf(tx, tyy, 11 + r() * 10, -175 + i * 30 + (r() - 0.5) * 20, pal.leaves[Math.floor(r() * pal.leaves.length)]!, 0.44, i % 2 ? pal.rib : undefined);
      if (snow) cl += ell(tx, tyy - 4, 11, 2.8, p.snow);
      if (pal.blossom && r() > 0.4) cl += flower(tx + 6, tyy + 4, 2.8, pal.blossom, c("#ffd166"));
      top += `<g${p.move("rustle", [tx, tyy], r() * 5, 5 + r() * 3)}>${cl}</g>`;
    }
    s += top;
  }

  // The trunk: wide and rooted at the foot, lit from the left, rough with bark.
  const trunk = `M112 ${g + 4}Q146 ${g - 4} 156 ${g - 60}Q166 ${g - 170} 172 ${Math.min(g - 240, 200)}L176 -6H222L226 ${g - 200}Q229 ${g - 50} 240 ${g + 4}Z`;
  s += p.shadow(178, g + 3, 76, 6);
  s += path(trunk, lin(150, 0, 236, 0, [[0, c("#b08a64")], [0.3, c("#8a6444")], [0.7, c("#6c4a36")], [1, c("#4a3024")]]));
  let barkLines = "";
  for (let y = 10; y < g - 30; y += 30 + r() * 16) {
    for (const bx of [182, 196, 210, 220]) {
      const len = 14 + r() * 26;
      const x = bx + (r() - 0.5) * 8;
      barkLines += stroke(`M${n(x)} ${n(y + r() * 20)}q${n((r() - 0.5) * 5)} ${n(len / 2)} 0 ${n(len)}`, c("#4f3426"), 1.3, op(0.6));
    }
    barkLines += stroke(`M${n(179 + r() * 3)} ${n(y + 6)}q2 10 0 ${n(16 + r() * 12)}`, c("#d3a57c"), 0.9, op(0.45));
  }
  s += barkLines;
  // Roots gripping the ground.
  s += stroke(`M132 ${g + 2}Q150 ${g - 8} 160 ${g - 30}M216 ${g - 28}Q224 ${g - 6} 236 ${g + 2}M176 ${g + 2}Q184 ${g - 8} 186 ${g - 20}`, c("#4f3426"), 1.6, op(0.6));
  // Moss or snow on the weather side.
  if (snow) s += path(`M112 ${g + 4}Q140 ${g - 2} 152 ${g - 34}Q146 ${g - 14} 128 ${g - 2}Z`, p.snow);
  else for (const [mx, my, mr] of [[150, g - 16, 6], [158, g - 34, 4.4], [144, g - 6, 5], [166, g - 70, 3.6], [170, g - 130, 3]] as const) s += circ(mx, my, mr, c("#5d9a58")) + circ(mx - mr * 0.3, my - mr * 0.35, mr * 0.5, c("#8cc272"));

  // Shelf fungus climbing the trunk like steps.
  for (let y = g - 120, i = 0; y > 120; y -= 150, i++) {
    const fx = 170 + i * 0.5;
    s += path(`M${fx} ${y}q-13 -3 -16 4q8 3 16 2Z`, v("#f3e2c4", "#c9a06c", y - 3, y + 5)) + path(`M${fx + 1} ${y + 12}q-9 -2 -11 3q6 2 11 1.500Z`, v("#f3e2c4", "#c9a06c", y + 9, y + 16));
  }

  // The hollow where the owl lives.
  if (H >= 520) {
    const oy = g - 180;
    s += ell(199, oy, 15, 20, c("#2a1c18")) + ell(199, oy + 1, 13, 18, radial(199, oy, 22, [[0, c("#1a100e")], [1, c("#3a2820")]]));
    s += owl(p, 199, oy + 5, 0.92);
    s += stroke(`M184 ${oy - 6}q-3 8 1 18M214 ${oy - 6}q3 8 -1 18`, c("#b08a64"), 1.2, op(0.6));
  }
  // A bird-house higher up, when the window is tall.
  if (H >= 760) {
    const hy = Math.min(by - 70, 260);
    if (hy > 220) {
      s += stroke(`M172 ${hy - 24}Q150 ${hy - 28} 138 ${hy - 20}`, bark, 2.6);
      s += `<g${p.move("sway", [140, hy - 20], 2, 6)}>${stroke(`M140 ${hy - 20}v8`, c("#c9b79a"), 0.9)}${rect(128, hy - 2, 24, 24, p.h("#f0d9b8", "#c9a47c", 128, 152), 1.5)}${path(`M124 ${hy}l16 -13l16 13Z`, c(look.accent))}${path(`M140 ${hy - 13}l16 13h-5l-11 -9Z`, "#05061a", op(0.18))}${circ(140, hy + 8, 4.4, c("#3a2820"))}${rect(138.6, hy + 14, 2.8, 5, c("#8a6444"))}${snow ? path(`M124 ${hy}l16 -13l16 13l-3 -0.500l-13 -9l-13 9Z`, p.snow) : ""}</g>`;
    }
  }

  // The door at the foot of the tree: someone is home after dark. Poke it to see.
  const dx = 196;
  const dy = g - 22;
  s += `<g${p.light}>${halo(dx, dy - 4, 44, "#ffcf7a", glow * 0.8)}</g>`;
  s += path(`M${dx - 15} ${g - 2}V${dy - 6}a15 15 0 0 1 30 0V${g - 2}Z`, c("#3a2820"));
  s += `<g${p.poke("light")}>`;
  s += path(`M${dx - 12.5} ${g - 2}V${dy - 6}a12.500 12.500 0 0 1 25 0V${g - 2}Z`, lin(dx - 12, 0, dx + 12, 0, [[0, c(look.accent, 0.1)], [1, c(look.accent, -0.3)]]));
  s += stroke(`M${dx - 4.2} ${g - 2}V${dy - 17.5}M${dx + 4.2} ${g - 2}V${dy - 17.5}`, "#05061a", 0.7, op(0.25));
  s += circ(dx, dy - 7, 4.6, c("#3a2820")) + circ(dx, dy - 7, 3.6, "#2a2430");
  s += `<g${p.light}>${circ(dx, dy - 7, 3.6, radial(dx, dy - 7, 4, [[0, "#fff2c4"], [1, "#ffb347"]]), op(0.25 + glow * 0.75))}</g>`;
  s += stroke(`M${dx - 3.6} ${dy - 7}h7.200M${dx} ${dy - 10.6}v7.200`, c("#3a2820"), 0.8) + circ(dx + 8, dy + 6, 1.4, c("#ffd166"));
  s += `</g>`;
  s += rect(dx - 17, g - 3, 34, 4, v("#b7b9c4", "#7c7f8e", g - 3, g + 1), 2) + rect(dx - 22, g + 1, 44, 4, v("#a8aab8", "#6c6f7e", g + 1, g + 5), 2);
  // A wreath on the door at Christmas.
  if (look.celebration === "christmas") {
    for (let i = 0; i < 10; i++) s += leaf(dx + Math.cos(i * 0.63) * 6.5, dy - 7 + Math.sin(i * 0.63) * 6.5, 6, i * 36 + 90, c(i % 2 ? "#3f8a58" : "#2f7048"), 0.45);
    s += circ(dx, dy - 0.5, 1.6, c("#d9423f"));
  }

  // Around the foot of the tree.
  s += toadstool(p, 136, g - 2, 0.9, "#d9574a") + toadstool(p, 122, g, 0.6, "#e2764a") + toadstool(p, 150, g + 1, 0.5, "#d9574a");
  const fernGreen = snow ? c("#8fa894") : c("#5d9a58");
  s += fern(p, r, 12, g, 40, -64, fernGreen, 0) + fern(p, r, 14, g + 1, 34, -30, c("#3d7a4c"), 2) + fern(p, r, 10, g, 30, -104, fernGreen, 4) + fern(p, r, 16, g + 2, 26, -8, c("#8cc272"), 1);
  for (let i = 0; i < 10; i++) {
    const gx = 30 + r() * 80;
    const gy = g - 2 + r() * 6;
    const tall = 6 + r() * 6;
    s += leaf(gx, gy, tall, -112 + r() * 10, pal.leaves[1]!, 0.16) + leaf(gx, gy, tall * 1.2, -92 + r() * 8, pal.deep[1]!, 0.16) + leaf(gx, gy, tall * 0.9, -70 + r() * 10, pal.leaves[3]!, 0.16);
  }
  const special = festiveProp(p, 62, g, 0.8);
  if (special) s += special;
  else if (snow) s += snowman(p, 62, g);
  else if (look.rain) s += frog(p, 64, g);
  else if (p.night < 0.6) s += rabbit(p, 62, g);
  if (!snow && look.season !== "winter") s += flower(100, g - 3, 2.8, c("#fff4f7"), c("#ffd166")) + flower(26, g - 1, 2.4, c("#ffc2d6"), c("#ffd166")) + flower(112, g + 2, 2, c("#c9b8ff"), c("#ffd166"));
  if (look.season === "autumn" && !snow) for (let i = 0; i < 9; i++) s += leaf(20 + r() * 130, g + r() * 5, 7 + r() * 4, r() * 360, pal.leaves[i % 4]!, 0.44);

  // Leaves (or petals) letting go, one at a time.
  if (look.animated && (look.season === "autumn" || look.season === "spring") && !snow) {
    for (let i = 0; i < 7; i++) {
      const fx = 20 + r() * 150;
      const color = look.season === "autumn" ? pal.leaves[i % 4]! : pal.blossom!;
      s += `<g class="lm-leaf-fall" style="--fall:${n(H - 40)}px;animation-delay:${n(-r() * 16)}s;animation-duration:${n(13 + r() * 9)}s">${look.season === "autumn" ? leaf(fx, 20, 9, 30, color, 0.44) : ell(fx, 20, 2.6, 1.8, color)}</g>`;
    }
  }
  if (look.rain && look.animated) for (let i = 0; i < 5; i++) s += `<circle${p.move("drip", undefined, r() * 2, 1.6 + r())} cx="${n(40 + r() * 100)}" cy="${n(by + 14)}" r="1.400" fill="#9fd0ff"/>`;
  if (p.night > 0.35) for (let i = 0; i < Math.max(5, Math.round(H / 90)); i++) s += firefly(p, r, 12 + r() * 150, 90 + r() * (H - 130));
  return s;
}

// ---- floor: the forest floor along the bottom of the page (any width x 64) ----

export function forestFloor(p: Paint, W: number): string {
  const { c, v, look } = p;
  const r = rng(67);
  const g = 52;
  const pal = seasonLeaves(p);
  const snow = look.snow;
  let s = "";
  // Rolling ground.
  let d = `M0 64V${g}`;
  for (let x = 0; x < W; x += 120) d += `q30 ${n(-5 - r() * 5)} 60 -1t60 1`;
  s += path(`${d}V64Z`, snow ? v("#ffffff", "#c9d4ea", g - 8, 64) : v(pal.leaves[2]!, pal.deep[0]!, g - 8, 64), op(0.96));

  // A stump with a sprout, and the hedgehog who lives behind it.
  s += p.shadow(54, g + 1, 30, 3);
  s += path(`M30 ${g}Q32 ${g - 14} 34 ${g - 26}H74Q76 ${g - 14} 80 ${g}Q66 ${g + 4} 54 ${g + 2}T30 ${g}Z`, p.h("#a07a58", "#5a3c2c", 30, 80));
  s += stroke(`M40 ${g - 22}q1 12 -2 20M52 ${g - 22}v22M64 ${g - 22}q0 12 4 20`, c("#4f3426"), 1.1, op(0.6));
  s += ell(54, g - 26, 20, 5.4, c("#6c4a36")) + ell(54, g - 26.4, 18.4, 4.6, radial(52, g - 27, 20, [[0, c("#f0d2a6")], [1, c("#b48a5e")]]));
  s += ell(54, g - 26.4, 12, 3, "none", ` stroke="${c("#b0845c")}" stroke-width="0.7"`) + ell(54, g - 26.4, 6, 1.5, "none", ` stroke="${c("#b0845c")}" stroke-width="0.7"`);
  if (snow) s += ell(54, g - 28, 19, 4.6, p.snow);
  else s += stroke(`M60 ${g - 27}q1 -8 -1 -13`, c("#4f9a62"), 1.2) + leaf(59, g - 40, 8, -150, c("#78bf7e"), 0.5) + leaf(59, g - 40, 8, -30, c("#5aa868"), 0.5);
  s += toadstool(p, 24, g + 2, 0.62, "#d9574a", false);
  if (!snow && W > 380) s += hedgehog(p, 108, g + 2);

  // What grows across the rest of it.
  for (let x = 150; x < W - 20; x += 16 + r() * 34) {
    const y = g - 1 + r() * 5;
    const pick = r();
    if (snow) {
      if (pick < 0.3) s += stroke(`M${n(x)} ${n(y)}q-2 -7 -5 -11M${n(x)} ${n(y)}q1 -8 3 -12`, c("#b89a6a"), 0.9);
      continue;
    }
    const tall = 5 + r() * 7;
    s += leaf(x, y, tall, -112 + r() * 10, pal.leaves[1]!, 0.16) + leaf(x, y, tall * 1.25, -92 + r() * 8, pal.deep[1]!, 0.16) + leaf(x, y, tall * 0.9, -70 + r() * 10, pal.leaves[3]!, 0.16);
    if (look.season === "autumn") {
      if (pick < 0.5) s += leaf(x + 8, y + 3, 7 + r() * 4, r() * 360, pal.leaves[Math.floor(r() * 4)]!, 0.44);
    } else if (look.season !== "winter" && pick < 0.34) {
      const fy = y - 9 - r() * 8;
      s += `<g${p.move("sway", [x + 6, y], r() * 5, 4 + r() * 3)}>${stroke(`M${n(x + 6)} ${n(y)}Q${n(x + 7)} ${n((y + fy) / 2)} ${n(x + 6)} ${n(fy)}`, pal.deep[1]!, 0.9)}${flower(x + 6, fy, 2.4 + r(), [c("#fff4f7"), c("#ffc2d6"), c("#c9b8ff"), c("#ffe08a")][Math.floor(r() * 4)]!, c("#ffd166"))}</g>`;
    }
    if (pick > 0.9) s += toadstool(p, x + 14, y + 2, 0.4 + r() * 0.3, r() > 0.5 ? "#d9574a" : "#e2764a", p.night > 0.5);
    else if (pick > 0.8) s += p.shadow(x + 12, y + 2.4, 5, 1.2, 0.8) + ell(x + 12, y + 0.6, 4, 2.8, v("#b7b9c4", "#7c7f8e", y - 2, y + 3));
  }
  // A snail out in the rain, taking its time.
  if (look.rain && W > 500) {
    const x0 = W * 0.36;
    s += `<g${p.poke("snail")}><g${p.move("crawl", undefined, 0, 60)}>${path(`M${n(x0 - 10)} ${g + 2}q10 -4 22 -1q4 -6 2 -9l2 -0.500q3 5 -1 10.500q-12 3 -25 0Z`, c("#d9b48c"))}${circ(x0 - 1, g - 5, 7, radial(x0 - 3, g - 7, 9, [[0, c("#e9a86a")], [1, c("#a8623a")]]))}${stroke(`M${n(x0 - 1)} ${g - 5}a3.500 3.500 0 1 0 3.500 -3.500`, c("#7a4226"), 0.9)}</g></g>`;
    for (const px of [W * 0.2, W * 0.58]) s += ell(px, g + 6, 18, 2.6, c("#9fc3e8"), op(0.5)) + `<ellipse${p.move("ripple", [px, g + 6], px * 0.01, 2.4)} cx="${n(px)}" cy="${g + 6}" rx="9" ry="1.400" stroke="#ffffff" stroke-width="0.700" opacity="0.6"/>`;
  }
  const special = W > 520 ? festiveProp(p, 176, g + 2, 0.7) : "";
  s += special;
  if (p.night > 0.4) for (let i = 0; i < Math.round(W / 130); i++) s += firefly(p, r, 30 + r() * (W - 60), 8 + r() * 34);
  return s;
}

// ---- perch: what grows on top of a dialog (120 x 44) ----

export function forestPerch(p: Paint): string {
  const { c } = p;
  const g = 44;
  const pal = seasonLeaves(p);
  let s = "";
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 6.5;
    s += leaf(x, g, 8 + (i % 3) * 3, -112 + (i % 4) * 14, pal.leaves[i % 4]!, 0.18);
  }
  s += toadstool(p, 28, g, 0.95, "#d9574a", false) + toadstool(p, 42, g, 0.6, "#e2764a", false);
  // The robin.
  const bx = 86;
  const y = g - 12;
  s += stroke(`M${bx - 1} ${g - 3}v3M${bx + 1.6} ${g - 3}v3`, c("#3a2e2a"), 0.7);
  s += path(`M${bx - 5} ${y + 6}L${bx - 16} ${y + 9.5}L${bx - 4} ${y + 8.5}Z`, c("#5a4638"));
  s += path(`M${bx - 7} ${y + 4.5}Q${bx - 7} ${y - 3.5} ${bx} ${y - 3.5}Q${bx + 6.4} ${y - 3.5} ${bx + 6.4} ${y + 2.5}Q${bx + 5} ${y + 9} ${bx - 1} ${y + 9}Q${bx - 6} ${y + 9} ${bx - 7} ${y + 4.5}Z`, c("#7a5e4a"));
  s += path(`M${bx - 3} ${y + 1}Q${bx - 1} ${y - 2.4} ${bx + 4.6} ${y - 0.5}Q${bx + 6.6} ${y + 3} ${bx + 4} ${y + 7}Q${bx} ${y + 9.4} ${bx - 3} ${y + 6.5}Q${bx - 4.4} ${y + 3.5} ${bx - 3} ${y + 1}Z`, lin(0, y - 2, 0, y + 9, [[0, c("#f08a52")], [1, c("#f4c9a4")]]));
  s += path(`M${bx + 5.8} ${y - 0.2}L${bx + 10} ${y + 1.2}L${bx + 5.8} ${y + 2.4}Z`, c("#3a2e2a")) + circ(bx + 2.8, y - 0.6, 1, c("#1e1a1e")) + circ(bx + 3.1, y - 0.9, 0.3, "#ffffff");
  s += fern(p, rng(3), 104, g, 22, -70, pal.leaves[2]!, 0) + fern(p, rng(4), 106, g, 18, -30, pal.leaves[1]!, 1);
  s += flower(64, g - 6, 2.6, c("#fff4f7"), c("#ffd166")) + stroke(`M64 ${g - 4}v4`, pal.deep[1]!, 0.9);
  return s;
}
