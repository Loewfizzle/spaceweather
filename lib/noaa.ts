// lib/noaa.ts
// Types and fetchers for NOAA SWPC public JSON data
// All endpoints are public and suitable for client-side fetching with caching via TanStack Query

export type OvationResponse = {
  "Observation Time": string;
  "Forecast Time": string;
  "Data Format": string;
  coordinates: [number, number, number][]; // [Longitude, Latitude, Aurora prob]
};

export type KpEntry = {
  time_tag: string;
  Kp: number;
  a_running: number;
  station_count: number;
};

export type PlasmaEntry = {
  time_tag: string;
  density: number;
  speed: number;
  temperature: number;
};

export type MagEntry = {
  time_tag: string;
  bx_gsm: number;
  by_gsm: number;
  bz_gsm: number;
  lon_gsm: number;
  lat_gsm: number;
  bt: number;
};

// Base fetch helper with error handling
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    // NOAA endpoints are public; no credentials needed
    cache: "no-store", // always fresh, Query will control refetch
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// OVATION aurora probability grid (global, updates frequently)
export async function fetchOvation(): Promise<OvationResponse> {
  return fetchJson<OvationResponse>(
    "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"
  );
}

// Planetary K-index (3-hourly, latest entry is most recent)
export async function fetchKpIndex(): Promise<KpEntry[]> {
  return fetchJson<KpEntry[]>(
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
  );
}

// Solar wind plasma (speed, density) - 6-hour window
export async function fetchPlasma(): Promise<PlasmaEntry[]> {
  const raw = await fetchJson<string[][]>(
    "https://services.swpc.noaa.gov/products/solar-wind/plasma-6-hour.json"
  );
  if (!raw || raw.length < 2) return [];
  const headers = raw[0];
  return raw.slice(1).map((row) => {
    const obj: Record<string, number | string> = {};
    headers.forEach((h, i) => {
      const val = row[i];
      obj[h] = typeof val === "string" ? parseFloat(val) : val;
    });
    return obj as PlasmaEntry;
  });
}

// IMF / magnetic field (Bz is key for aurora)
export async function fetchMag(): Promise<MagEntry[]> {
  const raw = await fetchJson<string[][]>(
    "https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json"
  );
  if (!raw || raw.length < 2) return [];
  const headers = raw[0];
  return raw.slice(1).map((row) => {
    const obj: Record<string, number | string> = {};
    headers.forEach((h, i) => {
      const val = row[i];
      obj[h] = typeof val === "string" ? parseFloat(val) : val;
    });
    return obj as MagEntry;
  });
}

// Helper: get most recent value from time series
export function latest<T extends { time_tag: string }>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[arr.length - 1];
}

export interface OvationPoint {
  lat: number;
  lon: number;
  prob: number;
}

export const NORTH_AMERICA_BOUNDS = {
  minLon: -170,
  maxLon: -50,
  minLat: 20,
  maxLat: 75,
} as const;

/**
 * Pure utility: filter raw OVATION coordinates to a region + min probability.
 * Moved here from AuroraMap for separation of concerns, reusability, and DRY (used by max too).
 */
export function filterOvationCoordinates(
  coordinates: [number, number, number][] | undefined,
  minProb: number = 0,
  bounds = NORTH_AMERICA_BOUNDS
): OvationPoint[] {
  if (!coordinates || coordinates.length === 0) return [];
  return coordinates
    .filter(([lon, lat, prob]) => {
      return (
        lon >= bounds.minLon &&
        lon <= bounds.maxLon &&
        lat >= bounds.minLat &&
        lat <= bounds.maxLat &&
        prob >= minProb
      );
    })
    .map(([lon, lat, prob]) => ({
      lat,
      lon,
      prob,
    }));
}

// Helper: compute max aurora probability in North America region for metrics
export function maxOvationNorthAmerica(data: OvationResponse | null): number {
  if (!data || !data.coordinates) return 0;
  const relevant = filterOvationCoordinates(data.coordinates, 0);
  if (relevant.length === 0) return 0;
  return Math.max(...relevant.map((p) => p.prob));
}

/**
 * Premium calm aurora color scale for markers (and reference for heatmap).
 * Subtle for low probs (so heat field provides context), stronger for high.
 */
export function getAuroraColor(prob: number): string {
  if (prob < 5) return "#166534"; // very low / subtle dark green
  if (prob < 15) return "#22c55e"; // low - green
  if (prob < 30) return "#eab308"; // moderate - yellow
  if (prob < 50) return "#f97316"; // elevated - orange
  return "#a78bfa"; // high - violet (stands out on dark)
}

/** Radius for high-prob marker peaks (scaled for visual weight). */
export function getAuroraMarkerRadius(prob: number): number {
  if (prob < 15) return 3;
  if (prob < 40) return 3.5;
  return 4.5; // larger for the strongest areas
}
