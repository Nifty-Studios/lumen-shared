// Live weather from Open-Meteo (free, no account). Only the location's coordinates are sent.

export type Precipitation = "none" | "drizzle" | "rain" | "snow";

export interface Weather {
  fetchedAt: number;
  /** WMO weather interpretation code. */
  code: number;
  temperature: number;
  /** 0..1 */
  cloudCover: number;
  /** mm in the last hour */
  precipitation: number;
  windSpeed: number;
  isDay: boolean;
}

export interface WeatherLook {
  label: string;
  precip: Precipitation;
  /** 0..1 */
  intensity: number;
  storm: boolean;
  fog: boolean;
  /** Minimum cloud cover implied by the code, 0..1. */
  clouds: number;
}

/** What a WMO code looks like on screen. */
export function describeWeather(code: number): WeatherLook {
  const look = (label: string, precip: Precipitation, intensity: number, clouds: number, extra: Partial<WeatherLook> = {}): WeatherLook => ({
    label,
    precip,
    intensity,
    clouds,
    storm: false,
    fog: false,
    ...extra,
  });
  switch (code) {
    case 0: return look("Clear", "none", 0, 0);
    case 1: return look("Mostly clear", "none", 0, 0.2);
    case 2: return look("Partly cloudy", "none", 0, 0.45);
    case 3: return look("Overcast", "none", 0, 0.9);
    case 45: case 48: return look("Fog", "none", 0, 0.6, { fog: true });
    case 51: return look("Light drizzle", "drizzle", 0.3, 0.75);
    case 53: return look("Drizzle", "drizzle", 0.5, 0.8);
    case 55: return look("Heavy drizzle", "drizzle", 0.7, 0.85);
    case 56: case 57: return look("Freezing drizzle", "drizzle", 0.5, 0.85);
    case 61: return look("Light rain", "rain", 0.35, 0.8);
    case 63: return look("Rain", "rain", 0.6, 0.85);
    case 65: return look("Heavy rain", "rain", 0.95, 0.95);
    case 66: case 67: return look("Freezing rain", "rain", 0.6, 0.9);
    case 71: return look("Light snow", "snow", 0.35, 0.8);
    case 73: return look("Snow", "snow", 0.6, 0.85);
    case 75: return look("Heavy snow", "snow", 0.9, 0.95);
    case 77: return look("Snow grains", "snow", 0.3, 0.8);
    case 80: return look("Light showers", "rain", 0.4, 0.65);
    case 81: return look("Showers", "rain", 0.65, 0.75);
    case 82: return look("Violent showers", "rain", 1, 0.9);
    case 85: return look("Snow showers", "snow", 0.45, 0.75);
    case 86: return look("Heavy snow showers", "snow", 0.85, 0.9);
    case 95: return look("Thunderstorm", "rain", 0.85, 0.95, { storm: true });
    case 96: case 99: return look("Thunderstorm with hail", "rain", 1, 1, { storm: true });
    default: return look("Cloudy", "none", 0, 0.6);
  }
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export async function fetchWeather(lat: number, lon: number, doFetch: typeof fetch = fetch): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    "&current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,is_day&timezone=auto";
  const res = await doFetch(url);
  if (!res.ok) throw new Error(`Weather service answered ${res.status}`);
  const current = ((await res.json()) as { current?: Record<string, unknown> }).current ?? {};
  return {
    fetchedAt: Date.now(),
    code: num(current.weather_code),
    temperature: num(current.temperature_2m),
    cloudCover: Math.min(1, Math.max(0, num(current.cloud_cover) / 100)),
    precipitation: num(current.precipitation),
    windSpeed: num(current.wind_speed_10m),
    isDay: current.is_day !== 0,
  };
}

export interface Place {
  name: string;
  /** Region and country, for disambiguation. */
  detail: string;
  lat: number;
  lon: number;
}

/** City search for the location picker (Open-Meteo geocoding). */
export async function searchPlaces(query: string, doFetch: typeof fetch = fetch): Promise<Place[]> {
  if (query.trim().length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=8&format=json`;
  const res = await doFetch(url);
  if (!res.ok) throw new Error(`Place search answered ${res.status}`);
  const body = (await res.json()) as { results?: Record<string, unknown>[] };
  return (body.results ?? []).map((r) => ({
    name: String(r.name ?? ""),
    detail: [r.admin1, r.country].filter(Boolean).join(", "),
    lat: num(r.latitude),
    lon: num(r.longitude),
  }));
}

/** The city part of the system timezone ("Africa/Lagos" -> "Lagos"), for a first guess. */
export function timezoneCity(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string | undefined {
  const city = timeZone?.split("/").pop()?.replace(/_/g, " ");
  return city && city !== "UTC" ? city : undefined;
}
