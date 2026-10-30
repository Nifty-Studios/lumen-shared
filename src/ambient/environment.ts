// Device-local appearance settings and the environment ("mood") presets.

import type { IconName } from "../icons/data";

export type ThemeMode = "system" | "light" | "dark";
/** "live" follows the real sun at the saved location. */
export type EnvTime = "live" | "dawn" | "day" | "golden" | "night";
/** "live" follows real weather (or a gentle time-of-day sky when offline). */
export type EnvWeather = "live" | "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog";
/** full = everything moves; calm = slower, fewer particles; still = a painted, motionless sky. */
export type Motion = "full" | "calm" | "still";
export type ClockFormat = "auto" | "12h" | "24h";

export interface SavedLocation {
  lat: number;
  lon: number;
  label: string;
  source: "device" | "city" | "timezone";
}

export interface LumenSettings {
  theme: ThemeMode;
  envTime: EnvTime;
  envWeather: EnvWeather;
  motion: Motion;
  clock: ClockFormat;
  temperatureUnit: "c" | "f";
  /** Ask Open-Meteo for the weather at `location` (about every 15 minutes). */
  liveWeather: boolean;
  location: SavedLocation | null;
  /** Soft synthesized rain and wind sound, desktop only. */
  sound: boolean;
  /** Mobile: the page is see-through glass over the live sky while writing (desktop always is). */
  skyBehindPage: boolean;
  /** The first-launch welcome animation has played on this device. */
  welcomed: boolean;
  /** Buttons and highlights: a hex color, or null to follow the sky (rose dawn, blue day…). */
  accent: string | null;
  /** Underline misspelled words in the editor. */
  spellcheck: boolean;
  /** Which English: "auto" is American on US devices, British elsewhere. */
  spelling: "auto" | "en-GB" | "en-US";
}

export const DEFAULT_SETTINGS: LumenSettings = {
  theme: "system",
  envTime: "live",
  envWeather: "live",
  motion: "full",
  clock: "auto",
  temperatureUnit: "c",
  liveWeather: true,
  location: null,
  sound: false,
  skyBehindPage: false,
  welcomed: false,
  accent: null,
  spellcheck: true,
  spelling: "auto",
};

export interface Mood {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  time: EnvTime;
  weather: EnvWeather;
}

export const MOODS: Mood[] = [
  { id: "live", name: "Live", description: "Your real sky, right now", icon: "locate-fixed", time: "live", weather: "live" },
  { id: "first-light", name: "First light", description: "Clear dawn, the day still quiet", icon: "sunrise", time: "dawn", weather: "clear" },
  { id: "misty-morning", name: "Misty morning", description: "Soft fog rolling over the dawn", icon: "cloud-fog", time: "dawn", weather: "fog" },
  { id: "bright-day", name: "Bright day", description: "High sun and a few clouds", icon: "sun", time: "day", weather: "clear" },
  { id: "rainy-afternoon", name: "Rainy afternoon", description: "Steady rain against a grey sky", icon: "cloud-rain", time: "day", weather: "rain" },
  { id: "golden-hour", name: "Golden hour", description: "Warm low light and drifting clouds", icon: "sunset", time: "golden", weather: "cloudy" },
  { id: "snow-day", name: "Snow day", description: "Flakes falling past a pale sun", icon: "cloud-snow", time: "day", weather: "snow" },
  { id: "thunderstorm", name: "Thunderstorm", description: "Heavy rain, distant lightning", icon: "cloud-lightning", time: "night", weather: "storm" },
  { id: "midnight-rain", name: "Midnight rain", description: "Rain on a dark, quiet night", icon: "cloud-moon", time: "night", weather: "rain" },
  { id: "starry-night", name: "Starry night", description: "Clear sky, moon and stars", icon: "moon-star", time: "night", weather: "clear" },
];

export const moodOf = (s: Pick<LumenSettings, "envTime" | "envWeather">): Mood | undefined =>
  MOODS.find((m) => m.time === s.envTime && m.weather === s.envWeather);

export const ENV_TIMES: { value: EnvTime; label: string; icon: IconName }[] = [
  { value: "live", label: "Live", icon: "locate-fixed" },
  { value: "dawn", label: "Dawn", icon: "sunrise" },
  { value: "day", label: "Day", icon: "sun" },
  { value: "golden", label: "Golden hour", icon: "sunset" },
  { value: "night", label: "Night", icon: "moon" },
];

export const ENV_WEATHERS: { value: EnvWeather; label: string; icon: IconName }[] = [
  { value: "live", label: "Live", icon: "locate-fixed" },
  { value: "clear", label: "Clear", icon: "sun" },
  { value: "cloudy", label: "Cloudy", icon: "cloudy" },
  { value: "rain", label: "Rain", icon: "cloud-rain" },
  { value: "storm", label: "Storm", icon: "cloud-lightning" },
  { value: "snow", label: "Snow", icon: "cloud-snow" },
  { value: "fog", label: "Fog", icon: "cloud-fog" },
];

/** Fallback when there is no saved location: longitude from the UTC offset, a mid latitude. */
export function approximateLocation(now = new Date()): SavedLocation {
  return { lat: 20, lon: (-now.getTimezoneOffset() / 60) * 15, label: "Your timezone", source: "timezone" };
}
