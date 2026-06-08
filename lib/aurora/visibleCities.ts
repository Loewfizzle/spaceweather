import { US_CITIES } from "../constants/usCities";

// Prefer well-known city names when building the aurora reference list.
const PREFERRED = new Set([
  "Fairbanks", "Anchorage", "Juneau", "Seattle", "Spokane", "Portland",
  "Billings", "Great Falls", "Missoula", "Duluth", "Fargo", "Minneapolis",
  "Bismarck", "Milwaukee", "Chicago", "Detroit", "Cleveland", "Buffalo",
  "Burlington", "Boston", "Denver", "Salt Lake City", "Boise",
]);

export interface VisibleCity {
  name: string;
  state: string;
  lat: number;
}

/**
 * Returns the top 5 US cities within the aurora viewing zone for a given Kp,
 * sorted by preferred-city status first, then descending latitude.
 * Also returns `minLat` — the equatorward boundary for that Kp level.
 */
export function getVisibleCities(kp: number): { cities: VisibleCity[]; minLat: number } {
  const minLat = Math.max(30, 67 - kp * 3);
  const qualifying = [...US_CITIES].filter((c) => c.lat >= minLat);
  qualifying.sort((a, b) => {
    const ap = PREFERRED.has(a.name) ? 0 : 1;
    const bp = PREFERRED.has(b.name) ? 0 : 1;
    return ap !== bp ? ap - bp : b.lat - a.lat;
  });
  return { cities: qualifying.slice(0, 5), minLat };
}
