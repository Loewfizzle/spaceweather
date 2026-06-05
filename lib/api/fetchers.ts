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
import { logDataError } from '../utils/retry';

// Base fetch helper (shared, server + client safe)
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
    });
    if (!res.ok) {
      const error = new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      logDataError(`HTTP ${res.status}`, error, { url }, false);
      throw error;
    }
    return res.json() as Promise<T>;
  } catch (error) {
    // Network errors, CORS, etc.
    logDataError('Network/Parse', error, { url }, false);
    throw error;
  }
}

/**
 * Centralized, schema-validated fetchers for AuroraWatch.
 * All external data goes through Zod (parse or safeParse+filter for resilience).
 * Row parsing for CSV-style endpoints (plasma, mag) and Fireball transformation
 * happen here before final schema validation.
 * Consumers should import types from './schemas', not rely on re-exports.
 */

// NOAA OVATION
export async function fetchOvation(): Promise<OvationResponse> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'
  );
  const result = OvationResponseSchema.safeParse(raw);
  if (!result.success) {
    logDataError('OVATION parse', result.error, { url: 'ovation_aurora_latest.json' }, true);
    // Return safe fallback so downstream can still attempt processing or show 0 gracefully
    return { coordinates: [] };
  }
  return result.data;
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
    const obj: Record<string, string | number | null> = {};
    headers.forEach((h, i) => {
      const val = row[i];
      if (h === 'time_tag') {
        obj[h] = typeof val === 'string' ? val : null;
      } else {
        const num = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : null);
        obj[h] = isNaN(num as number) ? null : num;
      }
    });
    return obj;
  });

  // Validate with Zod but filter out any rows that still fail (resilient to bad data rows)
  const valid = parsed.filter((obj) => {
    const result = PlasmaEntrySchema.safeParse(obj);
    return result.success;
  });
  return valid;
}

// Magnetic field data
export async function fetchMag(): Promise<MagEntry[]> {
  const raw = await fetchJson<string[][]>(
    'https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json'
  );
  if (!raw || raw.length < 2) return [];

  const headers = raw[0];
  const parsed = raw.slice(1).map((row) => {
    const obj: Record<string, string | number | null> = {};
    headers.forEach((h, i) => {
      const val = row[i];
      if (h === 'time_tag') {
        obj[h] = typeof val === 'string' ? val : null;
      } else {
        const num = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : null);
        obj[h] = isNaN(num as number) ? null : num;
      }
    });
    return obj;
  });

  // Validate with Zod but filter out any rows that still fail (resilient to bad data rows)
  const valid = parsed.filter((obj) => {
    const result = MagEntrySchema.safeParse(obj);
    return result.success;
  });
  return valid;
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

// Types are exported from ./schemas (the single source of truth).
// Do not add re-exports here to avoid confusion about ownership.
