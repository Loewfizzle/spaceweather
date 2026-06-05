import { z } from 'zod';
import {
  KpResponseSchema,
  OvationResponseSchema,
  PlasmaEntrySchema,
  MagEntrySchema,
  XrayFlareSchema,
  AlertSchema,
  SolarRegionSchema,
  CloudCoverDataSchema,
  FireballApiResponseSchema,
  FireballSchema,
} from './schemas';
import type {
  KpEntry,
  OvationResponse,
  PlasmaEntry,
  MagEntry,
  XrayFlare,
  Alert,
  SolarRegion,
  CloudCoverData,
  Fireball,
} from './schemas';

// Base fetch helper (shared, server + client safe)
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Centralized, schema-validated fetchers for AuroraWatch.
 * All external data now goes through Zod .parse() for runtime safety.
 * This replaces direct usage in old lib/noaa.ts over time.
 */

// NOAA OVATION
export async function fetchOvation(): Promise<OvationResponse> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'
  );
  return OvationResponseSchema.parse(raw);
}

// Planetary K-index
export async function fetchKpIndex(): Promise<KpEntry[]> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'
  );
  return KpResponseSchema.parse(raw);
}

// Solar wind plasma (parsed from string[][])
export async function fetchPlasma(): Promise<PlasmaEntry[]> {
  const raw = await fetchJson<string[][]>(
    'https://services.swpc.noaa.gov/products/solar-wind/plasma-6-hour.json'
  );
  if (!raw || raw.length < 2) return [];

  const headers = raw[0];
  const parsed = raw.slice(1).map((row) => {
    const obj: Record<string, number | string> = {};
    headers.forEach((h, i) => {
      const val = row[i];
      obj[h] = typeof val === 'string' ? parseFloat(val) : val;
    });
    return obj;
  });

  // Validate with Zod (array of objects)
  return z.array(PlasmaEntrySchema).parse(parsed);
}

// Magnetic field data
export async function fetchMag(): Promise<MagEntry[]> {
  const raw = await fetchJson<string[][]>(
    'https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json'
  );
  if (!raw || raw.length < 2) return [];

  const headers = raw[0];
  const parsed = raw.slice(1).map((row) => {
    const obj: Record<string, number | string> = {};
    headers.forEach((h, i) => {
      const val = row[i];
      obj[h] = typeof val === 'string' ? parseFloat(val) : val;
    });
    return obj;
  });

  return z.array(MagEntrySchema).parse(parsed);
}

// X-ray flares
export async function fetchXrayFlaresLatest(): Promise<XrayFlare[]> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json'
  );
  return z.array(XrayFlareSchema).parse(raw);
}

// Alerts
export async function fetchAlerts(): Promise<Alert[]> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/products/alerts.json'
  );
  return z.array(AlertSchema).parse(raw);
}

// Solar regions
export async function fetchSolarRegions(): Promise<SolarRegion[]> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/json/solar_regions.json'
  );
  return z.array(SolarRegionSchema).parse(raw);
}

// Cloud cover (Open-Meteo)
export async function fetchCloudCover(
  lat: number,
  lon: number
): Promise<CloudCoverData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=cloudcover&timezone=America/Detroit&forecast_days=2`;
  const raw = await fetchJson<unknown>(url, { cache: 'no-store' });
  return CloudCoverDataSchema.parse(raw);
}

// Fireballs - now goes through our internal proxy (CORS-safe + cached)
export async function fetchFireballs(limit = 8): Promise<Fireball[]> {
  const url = `/api/fireballs?limit=${limit}`;
  const raw = await fetchJson<unknown>(url);

  // Validate the NASA response shape (proxied)
  const validatedResponse = FireballApiResponseSchema.parse(raw);

  const fields = validatedResponse.fields;
  const rows = validatedResponse.data || [];

  const parsed = rows.map((row: unknown[]) => {
    const get = (name: string) => {
      const i = fields.indexOf(name);
      return i >= 0 ? row[i] : null;
    };
    return {
      date: (get('date') as string) || '',
      energy: parseNum(get('energy')),
      impactE: parseNum(get('impact-e')),
      lat: parseNum(get('lat')),
      latDir: get('lat-dir') as string | null,
      lon: parseNum(get('lon')),
      lonDir: get('lon-dir') as string | null,
      alt: parseNum(get('alt')),
      vel: parseNum(get('vel')),
    };
  });

  return z.array(FireballSchema).parse(parsed);
}

function parseNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

// Re-export types for convenience (centralized)
export type {
  KpEntry,
  OvationResponse,
  PlasmaEntry,
  MagEntry,
  XrayFlare,
  Alert,
  SolarRegion,
  CloudCoverData,
  Fireball,
};
