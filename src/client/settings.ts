// Device-local preferences (theme, mood, location...) and the last weather reading, kept in
// the `meta` table. They are not records, so they never sync: each device keeps its own.

import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, type LumenSettings } from "../ambient/environment";
import { fetchWeather, type Weather } from "../ambient/weather";
import { meta } from "../schema/client";
import type { LumenDb } from "./driver";

const SETTINGS_KEY = "settings";
const WEATHER_KEY = "weather";
/** Weather is refreshed at most this often. */
export const WEATHER_MAX_AGE = 15 * 60_000;

export function createSettings(db: LumenDb) {
  let current: LumenSettings = DEFAULT_SETTINGS;
  const listeners = new Set<(s: LumenSettings) => void>();

  const readJson = async <T>(key: string): Promise<T | undefined> => {
    const [row] = await db.select().from(meta).where(eq(meta.key, key));
    if (!row) return undefined;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return undefined;
    }
  };
  const writeJson = (key: string, value: unknown) =>
    db
      .insert(meta)
      .values({ key, value: JSON.stringify(value) })
      .onConflictDoUpdate({ target: meta.key, set: { value: JSON.stringify(value) } });

  return {
    /** Loads saved settings (call after migrate). */
    async loadSettings(): Promise<LumenSettings> {
      current = { ...DEFAULT_SETTINGS, ...(await readJson<Partial<LumenSettings>>(SETTINGS_KEY)) };
      for (const l of listeners) l(current);
      return current;
    },
    /** The settings now (a function, so it stays live when this object is spread). */
    getSettings: () => current,
    async updateSettings(patch: Partial<LumenSettings>): Promise<LumenSettings> {
      current = { ...current, ...patch };
      for (const l of listeners) l(current);
      await writeJson(SETTINGS_KEY, current);
      return current;
    },
    onSettings(listener: (s: LumenSettings) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    cachedWeather: () => readJson<Weather>(WEATHER_KEY),
    /**
     * The weather at the saved location: the cached reading while it is fresh, otherwise a
     * new one from Open-Meteo. Returns the cache (possibly stale) when offline, or undefined
     * when live weather is off or there is no location yet.
     */
    async refreshWeather({ force = false, doFetch }: { force?: boolean; doFetch?: typeof fetch } = {}): Promise<Weather | undefined> {
      const loc = current.location;
      if (!current.liveWeather || !loc) return undefined;
      const cached = await readJson<Weather & { lat?: number; lon?: number }>(WEATHER_KEY);
      const sameSpot = cached && Math.abs((cached.lat ?? 999) - loc.lat) < 0.05 && Math.abs((cached.lon ?? 999) - loc.lon) < 0.05;
      if (!force && cached && sameSpot && Date.now() - cached.fetchedAt < WEATHER_MAX_AGE) return cached;
      try {
        const fresh = await fetchWeather(loc.lat, loc.lon, doFetch);
        await writeJson(WEATHER_KEY, { ...fresh, lat: loc.lat, lon: loc.lon });
        return fresh;
      } catch {
        return sameSpot ? cached : undefined;
      }
    },
  };
}

export type SettingsApi = ReturnType<typeof createSettings>;
