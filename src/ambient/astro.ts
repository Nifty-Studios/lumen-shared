// Sun and moon, computed offline from time and place (low-precision almanac formulas,
// good to about half a degree, which is plenty for drawing a sky).

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J2000 = 2451545.0;

const julianDay = (ms: number) => ms / DAY_MS + 2440587.5;
const mod = (a: number, n: number) => ((a % n) + n) % n;

export interface SunPosition {
  /** Degrees above the horizon (negative below). */
  altitude: number;
  /** Degrees clockwise from north. */
  azimuth: number;
}

export function sunPosition(ms: number, lat: number, lon: number): SunPosition {
  const d = julianDay(ms) - J2000;
  const g = mod(357.529 + 0.98560028 * d, 360) * RAD;
  const q = mod(280.459 + 0.98564736 * d, 360);
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = mod(18.697374558 + 24.06570982441908 * d, 24);
  const H = (gmst * 15 + lon) * RAD - ra;
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { altitude: alt / RAD, azimuth: mod(az / RAD, 360) };
}

export interface SunTimes {
  /** Epoch ms; undefined during polar day or night. */
  sunrise?: number | undefined;
  sunset?: number | undefined;
  /** Highest point of the sun during this solar day. */
  noon: number;
}

const HORIZON = -0.833; // refraction + the sun's radius

/** Sunrise, solar noon and sunset for the solar day containing `ms` at this longitude. */
export function sunTimes(ms: number, lat: number, lon: number): SunTimes {
  // Local solar midnight before `ms`, approximated from longitude.
  const offset = (lon / 360) * DAY_MS;
  const start = Math.floor((ms + offset) / DAY_MS) * DAY_MS - offset;
  const alt = (t: number) => sunPosition(t, lat, lon).altitude - HORIZON;
  const step = 10 * 60_000;
  const refine = (a: number, b: number) => {
    for (let i = 0; i < 20; i++) {
      const m = (a + b) / 2;
      if (Math.sign(alt(m)) === Math.sign(alt(a))) a = m;
      else b = m;
    }
    return Math.round((a + b) / 2);
  };
  let sunrise: number | undefined;
  let sunset: number | undefined;
  let noon = start;
  let best = -Infinity;
  let prev = alt(start);
  for (let t = start + step; t <= start + DAY_MS; t += step) {
    const cur = alt(t);
    if (prev < 0 && cur >= 0 && sunrise === undefined) sunrise = refine(t - step, t);
    if (prev >= 0 && cur < 0 && sunset === undefined) sunset = refine(t - step, t);
    if (cur > best) {
      best = cur;
      noon = t;
    }
    prev = cur;
  }
  return { sunrise, sunset, noon };
}

export interface MoonPhase {
  /** 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
  phase: number;
  /** Lit fraction of the disc, 0..1. */
  illumination: number;
}

const SYNODIC_MONTH = 29.530588853;
const NEW_MOON_JD = 2451550.1; // 2000-01-06 18:14 UTC

export function moonPhase(ms: number): MoonPhase {
  const phase = mod((julianDay(ms) - NEW_MOON_JD) / SYNODIC_MONTH, 1);
  return { phase, illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2 };
}

/**
 * Where to put the shadow when drawing the moon as a disc of radius 1 centered at 0,0:
 * an SVG path for the lit part (northern-hemisphere view: waxing lit on the right).
 */
export function moonLitPath(phase: number, r = 1): string {
  const p = mod(phase, 1);
  const waxing = p < 0.5;
  // Terminator ellipse x-radius: r at new/full, 0 at quarters.
  const k = Math.cos(2 * Math.PI * p) * r;
  const outer = waxing ? 1 : 0; // sweep for the lit limb
  const inner = k > 0 === waxing ? 0 : 1;
  return `M 0 ${-r} A ${r} ${r} 0 0 ${outer} 0 ${r} A ${Math.abs(k)} ${r} 0 0 ${inner} 0 ${-r} Z`;
}
