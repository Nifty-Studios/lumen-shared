// The sky at a moment: time of day from the real sun (or a chosen mood), weather from
// Open-Meteo (or the mood), turned into numbers and colors that a renderer can draw.

import { moonPhase, sunPosition, sunTimes } from "./astro";
import { clamp, hex, luminance, mix, ramp, smoothstep, toHex, type Rgb } from "./color";
import { approximateLocation, type EnvTime, type EnvWeather, type SavedLocation } from "./environment";
import { describeWeather, type Precipitation, type Weather } from "./weather";

export type SkyPhase = "night" | "dawn" | "morning" | "day" | "golden" | "dusk";

export interface SkyState {
  now: number;
  /** Sun altitude in degrees (negative = below the horizon). */
  altitude: number;
  /** Before solar noon. */
  rising: boolean;
  /** 0 = deep night, 1 = full day. */
  daylight: number;
  /** 0..1, strongest with the sun near the horizon. */
  warmth: number;
  phase: SkyPhase;
  sun: { x: number; y: number; visible: number; size: number; color: string; dim: number };
  moon: { x: number; y: number; visible: number; phase: number; illumination: number };
  stars: number;
  /** Cloud coverage, 0..1. */
  clouds: number;
  cloudLight: string;
  cloudShade: string;
  precip: Precipitation;
  intensity: number;
  storm: boolean;
  fog: number;
  /** Wind strength 0..1 (rain slant, cloud speed). */
  wind: number;
  /** Untoned sky gradient, top to bottom. */
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  /** Short description: "Light rain", "Clear night". */
  label: string;
  temperature?: number | undefined;
  sunrise?: number | undefined;
  sunset?: number | undefined;
  /** True when time and weather both follow reality. */
  live: boolean;
}

export interface SkyInput {
  now?: number;
  location?: SavedLocation | null;
  weather?: Weather | null;
  envTime?: EnvTime;
  envWeather?: EnvWeather;
}

const FIXED_ALTITUDE: Record<Exclude<EnvTime, "live">, { altitude: number; rising: boolean }> = {
  dawn: { altitude: 1.5, rising: true },
  day: { altitude: 52, rising: false },
  golden: { altitude: 5, rising: false },
  night: { altitude: -30, rising: false },
};

const FIXED_WEATHER: Record<Exclude<EnvWeather, "live">, { code: number; clouds: number; wind: number }> = {
  clear: { code: 1, clouds: 0.12, wind: 0.08 },
  cloudy: { code: 2, clouds: 0.62, wind: 0.18 },
  rain: { code: 63, clouds: 0.86, wind: 0.3 },
  storm: { code: 95, clouds: 0.96, wind: 0.75 },
  snow: { code: 73, clouds: 0.82, wind: 0.15 },
  fog: { code: 45, clouds: 0.5, wind: 0.05 },
};

// Sky colors by sun altitude: [altitude, [top, bottom]]. Evening runs warmer, mornings pinker.
const SETTING: [number, [string, string]][] = [
  [-18, ["#03050d", "#0a0f22"]],
  [-10, ["#090f2c", "#262250"]],
  [-4, ["#1b2453", "#9c566c"]],
  [0, ["#344d7c", "#e98a58"]],
  [5, ["#4c74b0", "#f3b473"]],
  [12, ["#4d86cc", "#d6dfdc"]],
  [30, ["#3e84d7", "#a9d3f3"]],
  [60, ["#2d78d6", "#a0d0f9"]],
];
const RISING: [number, [string, string]][] = SETTING.map(([alt, [top, bottom]]) => {
  const pink: Record<number, string> = { [-4]: "#8f6290", 0: "#ee9f9a", 5: "#f4c4a4" };
  return [alt, [top, pink[alt] ?? bottom]];
});

const rampOf = (stops: [number, [string, string]][], i: 0 | 1) => stops.map(([a, c]) => [a, hex(c[i])] as [number, Rgb]);

function phaseOf(altitude: number, rising: boolean): SkyPhase {
  if (altitude < -7) return "night";
  if (altitude < 7) return rising ? "dawn" : altitude < 1 ? "dusk" : "golden";
  if (altitude < 16) return rising ? "morning" : "golden";
  return "day";
}

const PHASE_WORDS: Record<SkyPhase, string> = {
  night: "night",
  dawn: "dawn",
  morning: "morning",
  day: "day",
  golden: "golden hour",
  dusk: "dusk",
};

export function computeSky(input: SkyInput = {}): SkyState {
  const now = input.now ?? Date.now();
  const envTime = input.envTime ?? "live";
  const envWeather = input.envWeather ?? "live";
  const loc = input.location ?? approximateLocation(new Date(now));

  // --- sun & moon ---
  const times = sunTimes(now, loc.lat, loc.lon);
  let altitude: number;
  let rising: boolean;
  if (envTime === "live") {
    altitude = sunPosition(now, loc.lat, loc.lon).altitude;
    rising = now < times.noon;
  } else {
    ({ altitude, rising } = FIXED_ALTITUDE[envTime]);
  }
  const daylight = smoothstep(-12, 10, altitude);
  const warmth = altitude > -10 && altitude < 18 ? 1 - Math.min(1, Math.abs(altitude - 2) / 14) : 0;
  const phase = phaseOf(altitude, rising);

  // --- weather ---
  const liveWeather = envWeather === "live" ? input.weather : undefined;
  const fresh = liveWeather && now - liveWeather.fetchedAt < 3 * 3_600_000 ? liveWeather : undefined;
  let code: number;
  let clouds: number;
  let wind: number;
  if (envWeather !== "live") {
    ({ code, clouds, wind } = FIXED_WEATHER[envWeather]);
  } else if (fresh) {
    code = fresh.code;
    clouds = Math.max(fresh.cloudCover, describeWeather(code).clouds * 0.9);
    wind = clamp(fresh.windSpeed / 40, 0, 1);
  } else {
    // No weather data: a gentle day where a few clouds gather through the afternoon.
    const afternoon = times.sunset && now > times.noon ? smoothstep(times.noon, times.sunset, now) : 0;
    code = 2;
    clouds = 0.14 + 0.32 * afternoon;
    wind = 0.12;
  }
  const look = describeWeather(code);
  const precip = look.precip;
  const intensity = look.intensity;
  const storm = look.storm;
  const fog = look.fog ? 0.85 : 0;

  // --- colors ---
  const stops = rising ? RISING : SETTING;
  let top = ramp(rampOf(stops, 0), altitude);
  let bottom = ramp(rampOf(stops, 1), altitude);
  // Overcast skies lose their color; storms darken; fog washes everything out.
  const overcast = smoothstep(0.35, 1, clouds) * 0.62 + (storm ? 0.2 : 0);
  const grayDay = hex("#8b95a3");
  const grayNight = hex("#171b26");
  const gray = mix(grayNight, grayDay, daylight);
  top = mix(top, mix(gray, [0, 0, 0], storm ? 0.35 : 0), overcast);
  bottom = mix(bottom, gray, overcast * 0.9);
  if (fog) {
    const haze = mix(hex("#2c313d"), hex("#c8ced6"), daylight);
    top = mix(top, haze, fog * 0.45);
    bottom = mix(bottom, haze, fog * 0.7);
  }
  const mid = mix(top, bottom, 0.55);

  const cloudDay = mix(hex("#ffffff"), hex("#ffd6ad"), warmth * 0.85);
  const cloudNight = hex("#2b3046");
  let cloudLight = mix(cloudNight, cloudDay, daylight);
  cloudLight = mix(cloudLight, mix(hex("#3a404d"), hex("#b9c0ca"), daylight), overcast * 0.8);
  const cloudShade = mix(cloudLight, mix(hex("#0d0f17"), hex("#7d8796"), daylight), 0.45 + (storm ? 0.25 : 0));

  // --- sun & moon placement: always in the top-right corner, lower and larger near the horizon ---
  const high = clamp(altitude / 60, 0, 1);
  const sunColor = mix(hex("#ff9f5a"), hex("#fff4d6"), smoothstep(0, 25, altitude));
  const dim = clamp(clouds * 0.72 + (storm ? 0.2 : 0) + fog * 0.3, 0, 0.95);
  const moon = moonPhase(now);
  const night = 1 - smoothstep(-8, 3, altitude);

  // Without a weather reading the sky is a guess, so the label only names the time of day.
  const weatherWord = precip !== "none" || storm || fog ? look.label : clouds > 0.75 ? "Overcast" : clouds > 0.4 ? "Cloudy" : "Clear";
  const label =
    envWeather === "live" && !fresh ? PHASE_WORDS[phase] : precip !== "none" || storm || fog ? weatherWord : `${weatherWord} ${PHASE_WORDS[phase]}`;

  return {
    now,
    altitude,
    rising,
    daylight,
    warmth,
    phase,
    sun: {
      x: 0.9 - high * 0.06,
      y: 0.2 - high * 0.13,
      visible: smoothstep(-5, 1.5, altitude),
      size: 120 - high * 24,
      color: toHex(sunColor),
      dim,
    },
    moon: { x: 0.87, y: 0.1, visible: night, phase: moon.phase, illumination: moon.illumination },
    stars: (1 - smoothstep(-15, -5, altitude)) * (1 - smoothstep(0.3, 0.9, clouds)) * (fog ? 0.3 : 1),
    clouds,
    cloudLight: toHex(cloudLight),
    cloudShade: toHex(cloudShade),
    precip,
    intensity,
    storm,
    fog,
    wind,
    skyTop: toHex(top),
    skyMid: toHex(mid),
    skyBottom: toHex(bottom),
    label: label.charAt(0).toUpperCase() + label.slice(1),
    temperature: fresh?.temperature,
    sunrise: times.sunrise,
    sunset: times.sunset,
    live: envTime === "live" && envWeather === "live",
  };
}

/** True when white text reads better than dark text on this color. */
export const isDarkColor = (c: string) => luminance(hex(c)) < 0.22;
