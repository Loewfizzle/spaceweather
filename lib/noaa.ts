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
  const raw = await fetchJson<any[]>(
    "https://services.swpc.noaa.gov/products/solar-wind/plasma-6-hour.json"
  );
  if (!raw || raw.length < 2) return [];
  const headers = raw[0] as string[];
  return raw.slice(1).map((row: any[]) => {
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = typeof row[i] === "string" ? parseFloat(row[i]) : row[i];
    });
    return obj as PlasmaEntry;
  });
}

// IMF / magnetic field (Bz is key for aurora)
export async function fetchMag(): Promise<MagEntry[]> {
  const raw = await fetchJson<any[]>(
    "https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json"
  );
  if (!raw || raw.length < 2) return [];
  const headers = raw[0] as string[];
  return raw.slice(1).map((row: any[]) => {
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = typeof row[i] === "string" ? parseFloat(row[i]) : row[i];
    });
    return obj as MagEntry;
  });
}

// Helper: get most recent value from time series
export function latest<T extends { time_tag: string }>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[arr.length - 1];
}

// Helper: compute max aurora probability in North America region for metrics
export function maxOvationNorthAmerica(data: OvationResponse | null): number {
  if (!data || !data.coordinates) return 0;
  // Rough NA bounds: lon -170 to -50, lat 20 to 75
  const relevant = data.coordinates.filter(([lon, lat]) => {
    return lon >= -170 && lon <= -50 && lat >= 20 && lat <= 75;
  });
  if (relevant.length === 0) return 0;
  return Math.max(...relevant.map(([, , prob]) => prob));
}
