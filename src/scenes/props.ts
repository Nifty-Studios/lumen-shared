// Things the special days bring into every theme: a little tree at Christmas, a cake and
// balloons on a birthday, a lit pumpkin at Halloween. Each theme decides where they stand.

import { flower, halo, leaf, lin, n, n3, radial, type Paint } from "./kit";

const FLAGS: Record<string, string[]> = {
  christmas: ["#d9423f", "#3f9a5a", "#ffd166", "#f5f1ea"],
  halloween: ["#f08a2e", "#3a2a4a", "#9b6bd6", "#f08a2e"],
  valentine: ["#ff6f91", "#ffc2d6", "#d9426f", "#fff0f4"],
  easter: ["#ffd98a", "#b9e3a0", "#ffc2d6", "#a8d4ff"],
  birthday: ["#ff6f91", "#ffd166", "#5ec8e8", "#9b8cff"],
  "new-year": ["#ffd166", "#f5f1ea", "#ffb347", "#c9b8ff"],
};

/** The colors of today's celebration, or undefined on an ordinary day. */
export const festiveColors = (p: Paint): string[] | undefined => (p.look.celebration ? FLAGS[p.look.celebration] ?? FLAGS.birthday : undefined);

export const heart = (x: number, y: number, r: number, fill: string) =>
  `<path d="M${n(x)} ${n(y + r * 0.9)}C${n(x - r * 1.5)} ${n(y - r * 0.1)} ${n(x - r * 0.8)} ${n(y - r * 1.1)} ${n(x)} ${n(y - r * 0.35)}C${n(x + r * 0.8)} ${n(y - r * 1.1)} ${n(x + r * 1.5)} ${n(y - r * 0.1)} ${n(x)} ${n(y + r * 0.9)}Z" fill="${fill}"/>`;

export function gift(p: Paint, x: number, y: number, k: number, color: string, ribbon: string) {
  const w = 16 * k;
  const h = 12 * k;
  let s = p.shadow(x, y, w * 0.7, 1.6 * k, 0.8);
  s += `<rect x="${n(x - w / 2)}" y="${n(y - h)}" width="${n(w)}" height="${n(h)}" rx="${n(1.2 * k)}" fill="${p.c(color)}"/>`;
  s += `<rect x="${n(x + w * 0.18)}" y="${n(y - h)}" width="${n(w * 0.32)}" height="${n(h)}" fill="#05061a" opacity="0.14"/>`;
  s += `<rect x="${n(x - w / 2 - k)}" y="${n(y - h - 3 * k)}" width="${n(w + 2 * k)}" height="${n(3.6 * k)}" rx="${n(k)}" fill="${p.c(color, 0.18)}"/>`;
  s += `<rect x="${n(x - 1.6 * k)}" y="${n(y - h - 3 * k)}" width="${n(3.2 * k)}" height="${n(h + 3 * k)}" fill="${p.c(ribbon)}"/>`;
  s += `<path d="M${n(x)} ${n(y - h - 3 * k)}q${n(-6 * k)} ${n(-7 * k)} ${n(-7 * k)} ${n(-1 * k)}ZM${n(x)} ${n(y - h - 3 * k)}q${n(6 * k)} ${n(-7 * k)} ${n(7 * k)} ${n(-1 * k)}Z" fill="${p.c(ribbon, -0.12)}"/>`;
  return s;
}

/** Balloons tied at (x, y), floating above it. */
export function balloons(p: Paint, x: number, y: number, k: number, colors: string[], shape: "round" | "heart" = "round") {
  let s = "";
  const spots: [number, number][] = [[-11, -46], [8, -56], [20, -40]];
  spots.slice(0, Math.min(3, colors.length)).forEach(([dx, dy], i) => {
    const bx = x + dx * k;
    const by = y + dy * k;
    const color = colors[i]!;
    let b = `<path d="M${n(x)} ${n(y)}Q${n(x + dx * k * 0.2)} ${n(y + dy * k * 0.5)} ${n(bx)} ${n(by + 10 * k)}" stroke="${p.c("#8a8296")}" stroke-width="0.7"/>`;
    if (shape === "heart") b += heart(bx, by, 8.5 * k, radial(bx - 3 * k, by - 4 * k, 14 * k, [[0, p.c(color, 0.4)], [1, p.c(color, -0.15)]]));
    else {
      b += `<ellipse cx="${n(bx)}" cy="${n(by)}" rx="${n(8 * k)}" ry="${n(10 * k)}" fill="${radial(bx - 3 * k, by - 4 * k, 14 * k, [[0, p.c(color, 0.45)], [0.7, p.c(color)], [1, p.c(color, -0.25)]])}"/>`;
      b += `<path d="M${n(bx - 1.6 * k)} ${n(by + 9.6 * k)}L${n(bx)} ${n(by + 12.4 * k)}L${n(bx + 1.6 * k)} ${n(by + 9.6 * k)}Z" fill="${p.c(color, -0.2)}"/>`;
    }
    b += `<ellipse cx="${n(bx - 3 * k)}" cy="${n(by - 4.4 * k)}" rx="${n(1.7 * k)}" ry="${n(2.8 * k)}" fill="#ffffff" opacity="0.5" transform="rotate(24 ${n(bx - 3 * k)} ${n(by - 4.4 * k)})"/>`;
    s += `<g${p.poke("balloon")}><g${p.move("sway", [x, y], i * 1.7, 5 + i)}>${b}</g></g>`;
  });
  return s;
}

export function cake(p: Paint, x: number, y: number, k: number) {
  let s = p.shadow(x, y, 17 * k, 2 * k, 0.8);
  s += `<ellipse cx="${n(x)}" cy="${n(y - 1 * k)}" rx="${n(17 * k)}" ry="${n(2.6 * k)}" fill="${p.c("#e9ebf5")}"/>`;
  s += `<rect x="${n(x - 13 * k)}" y="${n(y - 13 * k)}" width="${n(26 * k)}" height="${n(12 * k)}" rx="${n(2.5 * k)}" fill="${p.h("#ffd9e4", "#e89ab4", x - 13 * k, x + 13 * k)}"/>`;
  s += `<path d="M${n(x - 13 * k)} ${n(y - 10 * k)}q${n(3.2 * k)} ${n(5 * k)} ${n(6.5 * k)} 0t${n(6.5 * k)} 0t${n(6.5 * k)} 0t${n(6.5 * k)} 0V${n(y - 13 * k)}H${n(x - 13 * k)}Z" fill="${p.c("#fffaf2")}"/>`;
  s += `<rect x="${n(x - 13 * k)}" y="${n(y - 6 * k)}" width="${n(26 * k)}" height="${n(1.4 * k)}" fill="${p.c("#c96a8c")}" opacity="0.7"/>`;
  [-7, 0, 7].forEach((dx, i) => {
    const cx = x + dx * k;
    s += `<rect x="${n(cx - 0.9 * k)}" y="${n(y - 20 * k)}" width="${n(1.8 * k)}" height="${n(7 * k)}" rx="${n(0.6 * k)}" fill="${p.c(["#5ec8e8", "#ffd166", "#9b8cff"][i]!)}"/>`;
    s += halo(cx, y - 23 * k, 6 * k, "#ffd58a", 0.5 + p.glow * 0.5);
    s += `<path${p.move("flicker", [cx, y - 20.5 * k], i * 0.3)} d="M${n(cx)} ${n(y - 25.5 * k)}q${n(2 * k)} ${n(3 * k)} 0 ${n(5 * k)}q${n(-2 * k)} ${n(-2 * k)} 0 ${n(-5 * k)}Z" fill="#ffb347"/>`;
  });
  return `<g${p.poke("cake")}>${s}</g>`;
}

export function pumpkin(p: Paint, x: number, y: number, k: number) {
  let s = halo(x, y - 9 * k, 24 * k, "#ffb347", p.glow * 0.9) + p.shadow(x, y, 15 * k, 2 * k);
  s += `<path d="M${n(x)} ${n(y - 17 * k)}q${n(1 * k)} ${n(-5 * k)} ${n(5 * k)} ${n(-6 * k)}" stroke="${p.c("#4f7a3a")}" stroke-width="${n(2.2 * k)}" stroke-linecap="round"/>`;
  for (const [dx, rx, sh] of [[-8, 7, -0.12], [8, 7, -0.22], [-3.5, 7, 0.05], [3.5, 7, -0.06], [0, 6, 0.12]] as const)
    s += `<ellipse cx="${n(x + dx * k)}" cy="${n(y - 9 * k)}" rx="${n(rx * k)}" ry="${n(9 * k)}" fill="${p.c("#f08a2e", sh)}"/>`;
  const lit = `#ffe08a`;
  const a = n3(0.75 + p.glow * 0.25);
  s += `<path d="M${n(x - 7 * k)} ${n(y - 10 * k)}l${n(3 * k)} ${n(-4 * k)}l${n(2.4 * k)} ${n(4 * k)}ZM${n(x + 1.6 * k)} ${n(y - 10 * k)}l${n(2.4 * k)} ${n(-4 * k)}l${n(3 * k)} ${n(4 * k)}Z" fill="${lit}" opacity="${a}"/>`;
  s += `<path d="M${n(x - 8 * k)} ${n(y - 6.5 * k)}l${n(3 * k)} ${n(1.4 * k)}l${n(2.4 * k)} ${n(-1.6 * k)}l${n(2.6 * k)} ${n(1.8 * k)}l${n(2.6 * k)} ${n(-1.8 * k)}l${n(2.4 * k)} ${n(1.6 * k)}l${n(3 * k)} ${n(-1.4 * k)}q${n(-3 * k)} ${n(5.5 * k)} ${n(-8 * k)} ${n(5.5 * k)}t${n(-8 * k)} ${n(-5.5 * k)}Z" fill="${lit}" opacity="${a}"/>`;
  return `<g${p.poke("pumpkin")}>${s}</g>`;
}

export function miniTree(p: Paint, x: number, y: number, k: number) {
  let s = p.shadow(x, y, 16 * k, 2 * k);
  s += `<path d="M${n(x - 6 * k)} ${n(y - 9 * k)}H${n(x + 6 * k)}L${n(x + 4.6 * k)} ${n(y)}H${n(x - 4.6 * k)}Z" fill="${p.h("#c9744a", "#8a4a30", x - 6 * k, x + 6 * k)}"/>`;
  for (let i = 0; i < 3; i++) {
    const top = y - 50 * k + i * 12 * k;
    const half = (8 + i * 4.5) * k;
    const bottom = top + 19 * k;
    s += `<path d="M${n(x)} ${n(top)}L${n(x + half)} ${n(bottom)}Q${n(x)} ${n(bottom - 3 * k)} ${n(x - half)} ${n(bottom)}Z" fill="${p.c("#3f8a58")}"/><path d="M${n(x)} ${n(top)}L${n(x + half)} ${n(bottom)}Q${n(x + half * 0.5)} ${n(bottom - 2 * k)} ${n(x)} ${n(bottom - 1.5 * k)}Z" fill="${p.c("#2a6644")}"/>`;
  }
  const baubles: [number, number, string][] = [[-3, -32, "#ff6f6f"], [4, -27, "#ffd166"], [-6, -19, "#5ec8e8"], [2, -17, "#ff9ad5"], [9, -14, "#ffd166"], [-10, -11, "#ff6f6f"], [3, -40, "#5ec8e8"]];
  baubles.forEach(([dx, dy, color], i) => {
    s += `<g${p.move("twinkle", undefined, i * 0.6, 2.4)}>${halo(x + dx * k, y + dy * k, 5 * k, color, p.glow)}<circle cx="${n(x + dx * k)}" cy="${n(y + dy * k)}" r="${n(1.7 * k)}" fill="${color}"/></g>`;
  });
  s += halo(x, y - 51 * k, 8 * k, "#ffd166", 0.4 + p.glow * 0.6);
  s += `<path d="M${n(x)} ${n(y - 56 * k)}l${n(1.5 * k)} ${n(3.4 * k)}l${n(3.6 * k)} ${n(0.4 * k)}l${n(-2.7 * k)} ${n(2.4 * k)}l${n(0.8 * k)} ${n(3.6 * k)}l${n(-3.2 * k)} ${n(-1.9 * k)}l${n(-3.2 * k)} ${n(1.9 * k)}l${n(0.8 * k)} ${n(-3.6 * k)}l${n(-2.7 * k)} ${n(-2.4 * k)}l${n(3.6 * k)} ${n(-0.4 * k)}Z" fill="#ffd166"/>`;
  return `<g${p.poke("tree")}>${s}</g>`;
}

export function eggBasket(p: Paint, x: number, y: number, k: number) {
  let s = p.shadow(x, y, 15 * k, 2 * k);
  s += `<path d="M${n(x - 12 * k)} ${n(y - 9 * k)}Q${n(x)} ${n(y - 30 * k)} ${n(x + 12 * k)} ${n(y - 9 * k)}" stroke="${p.c("#b8875a")}" stroke-width="${n(1.8 * k)}"/>`;
  for (const [dx, color, rot] of [[-6, "#ffc2d6", -12], [0, "#a8d4ff", 4], [6, "#ffe08a", 14]] as const)
    s += `<ellipse cx="${n(x + dx * k)}" cy="${n(y - 11 * k)}" rx="${n(4 * k)}" ry="${n(5.4 * k)}" fill="${p.c(color)}" transform="rotate(${rot} ${n(x + dx * k)} ${n(y - 11 * k)})"/><path d="M${n(x + dx * k - 3 * k)} ${n(y - 12 * k)}q${n(3 * k)} ${n(-2 * k)} ${n(6 * k)} 0" stroke="#ffffff" stroke-width="${n(0.9 * k)}" opacity="0.7"/>`;
  s += `<path d="M${n(x - 13 * k)} ${n(y - 9 * k)}H${n(x + 13 * k)}L${n(x + 9.5 * k)} ${n(y)}H${n(x - 9.5 * k)}Z" fill="${p.h("#d9a676", "#a8744b", x - 13 * k, x + 13 * k)}"/>`;
  s += `<path d="M${n(x - 12 * k)} ${n(y - 6 * k)}H${n(x + 12 * k)}M${n(x - 11 * k)} ${n(y - 3 * k)}H${n(x + 11 * k)}" stroke="${p.c("#8a5f40")}" stroke-width="${n(0.7 * k)}" opacity="0.7"/>`;
  return s;
}

export function roses(p: Paint, x: number, y: number, k: number) {
  let s = p.shadow(x, y, 9 * k, 1.6 * k);
  for (const [dx, dy] of [[-6, -27], [0, -32], [6, -26]] as const) {
    s += `<path d="M${n(x)} ${n(y - 12 * k)}Q${n(x + dx * k * 0.4)} ${n(y - 20 * k)} ${n(x + dx * k)} ${n(y + dy * k)}" stroke="${p.c("#3f8a58")}" stroke-width="${n(1.1 * k)}"/>`;
    s += leaf(x + dx * k * 0.5, y - 20 * k, 5 * k, dx < 0 ? -160 : -20, p.c("#4f9a62"), 0.45);
    s += `<circle cx="${n(x + dx * k)}" cy="${n(y + dy * k)}" r="${n(4 * k)}" fill="${radial(x + dx * k - k, y + dy * k - k, 5 * k, [[0, p.c("#ff8fa8")], [1, p.c("#c9304f")]])}"/><path d="M${n(x + dx * k - 2 * k)} ${n(y + dy * k)}q${n(2 * k)} ${n(-3 * k)} ${n(4 * k)} 0" stroke="${p.c("#8a1f38")}" stroke-width="${n(0.7 * k)}" opacity="0.7"/>`;
  }
  s += `<path d="M${n(x - 5 * k)} ${n(y - 14 * k)}H${n(x + 5 * k)}L${n(x + 6.5 * k)} ${n(y - 4 * k)}Q${n(x + 6.5 * k)} ${n(y)} ${n(x)} ${n(y)}Q${n(x - 6.5 * k)} ${n(y)} ${n(x - 6.5 * k)} ${n(y - 4 * k)}Z" fill="${lin(x - 6 * k, 0, x + 6 * k, 0, [[0, p.c("#e9f4ff"), 0.85], [1, p.c("#9fc3e8"), 0.85]])}"/>`;
  s += `<path d="M${n(x - 3.6 * k)} ${n(y - 12 * k)}V${n(y - 4 * k)}" stroke="#ffffff" stroke-width="${n(0.9 * k)}" stroke-linecap="round" opacity="0.6"/>`;
  return s;
}

/** The day's own thing to stand on a surface at (x, y): about 40k wide and up to 60k tall. */
export function festiveProp(p: Paint, x: number, y: number, k: number): string {
  switch (p.look.celebration) {
    case "christmas":
      return miniTree(p, x, y, k) + gift(p, x + 17 * k, y, k * 0.7, "#d9423f", "#ffd166") + gift(p, x - 16 * k, y, k * 0.55, "#3f7fd6", "#f5f1ea");
    case "birthday":
      return balloons(p, x + 12 * k, y - 8 * k, k * 0.8, ["#ff6f91", "#ffd166", "#5ec8e8"]) + cake(p, x, y, k * 0.9);
    case "halloween":
      return pumpkin(p, x, y, k) + pumpkin(p, x + 20 * k, y, k * 0.55);
    case "valentine":
      return balloons(p, x + 10 * k, y - 6 * k, k * 0.8, ["#ff6f91", "#d9426f"], "heart") + roses(p, x, y, k);
    case "easter":
      return eggBasket(p, x, y, k) + flower(x + 18 * k, y - 4 * k, 3 * k, p.c("#fff4f7"), p.c("#ffd166")) + flower(x - 17 * k, y - 3 * k, 2.4 * k, p.c("#ffc2d6"), p.c("#ffd166"));
    case "new-year":
      return balloons(p, x, y - 4 * k, k * 0.85, ["#ffd166", "#f5f1ea", "#c9b8ff"]) + gift(p, x, y, k * 0.8, "#2a2d55", "#ffd166");
    default:
      return "";
  }
}

/** A line of the day's decorations strung from (x0, y) to (x1, y), sagging in the middle. */
export function festiveLine(p: Paint, x0: number, x1: number, y: number, sag = 12): string {
  const colors = festiveColors(p);
  if (!colors) return "";
  const kind = p.look.celebration;
  const mx = (x0 + x1) / 2;
  const at = (t: number): [number, number] => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1, y + 4 * t * (1 - t) * sag];
  let s = `<path d="M${n(x0)} ${n(y)}Q${n(mx)} ${n(y + sag * 2)} ${n(x1)} ${n(y)}" stroke="${p.c(kind === "christmas" ? "#2f7048" : "#8a8296")}" stroke-width="${kind === "christmas" ? 2.4 : 0.9}" stroke-linecap="round"/>`;
  const count = Math.max(3, Math.round((x1 - x0) / 17));
  for (let i = 0; i < count; i++) {
    const [fx, fy] = at((i + 0.5) / count);
    const color = colors[i % colors.length]!;
    if (kind === "christmas") {
      s += leaf(fx - 4, fy, 7, 200, p.c("#3f8a58"), 0.4) + leaf(fx + 4, fy, 7, -20, p.c("#2f7048"), 0.4);
      s += `<g${p.move("twinkle", undefined, i * 0.5, 2.2)}>${halo(fx, fy + 3, 6, color, p.glow)}<circle cx="${n(fx)}" cy="${n(fy + 3)}" r="2" fill="${color}"/></g>`;
    } else if (kind === "valentine") s += `<g${p.move("sway", [fx, fy], i, 4)}>${heart(fx, fy + 5.5, 4.2, p.c(color))}</g>`;
    else if (kind === "halloween" && i % 2 === 1)
      // A bat hanging between the flags.
      s += `<g${p.move("sway", [fx, fy], i, 3.5)}><path d="M${n(fx)} ${n(fy + 2)}q-3 -2 -8 1q2 0 2.500 2.500q1.500 -1.500 3 0q1 -1.500 2.500 -1.500t2.500 1.500q1.500 -1.500 3 0q0.500 -2.500 2.500 -2.500q-5 -3 -8 -1Z" fill="${p.c("#3a2a4a")}"/></g>`;
    else s += `<g${p.move("sway", [fx, fy], i * 0.7, 4 + (i % 3))}><path d="M${n(fx - 5)} ${n(fy)}H${n(fx + 5)}L${n(fx)} ${n(fy + 10)}Z" fill="${p.c(color)}"/><path d="M${n(fx)} ${n(fy)}H${n(fx + 5)}L${n(fx)} ${n(fy + 10)}Z" fill="#05061a" opacity="0.12"/></g>`;
  }
  return s;
}
