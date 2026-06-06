import { z } from 'zod';
import {
  KpResponseSchema,
  KpForecastEntrySchema,
  OvationResponseSchema,
  PlasmaEntrySchema,
  MagEntrySchema,
  XrayFlareSchema,
  AlertSchema,
  SolarRegionSchema,
  NASAFireballRawSchema,
} from './schemas';
import type {
  KpEntry,
  KpForecastEntry,
  OvationResponse,
  PlasmaEntry,
  MagEntry,
  XrayFlare,
  Alert,
  SolarRegion,
  Fireball,
} from './schemas';
import { logDataError } from '../utils/retry';

// Base fetch helper (shared, server + client safe).
// 30-second timeout guards against hung NOAA/NASA endpoints.
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
      ...options,
    });
    if (!res.ok) {
      const error = new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      logDataError(`HTTP ${res.status}`, error, { url }, false);
      throw error;
    }
    return res.json() as Promise<T>;
  } catch (error) {
    // Network errors, timeouts, CORS, etc.
    logDataError('Network/Parse', error, { url }, false);
    throw error;
  }
}

// Centralized, schema-validated fetchers for AuroraWatch.
// All external data goes through Zod (parse or safeParse+filter for resilience).
// Consumers should import types from './schemas', not rely on re-exports.

// Shared helper: convert NOAA's string[][] format (header row + data rows) to typed objects.
export function parseStringArrayRows(raw: string[][]): Record<string, string | number | null>[] {
  if (!raw || raw.length < 2) return [];
  const headers = raw[0];
  return raw.slice(1).map((row) => {
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
}

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
  try {
    return KpResponseSchema.parse(raw);
  } catch (e) {
    logDataError('KpIndex parse', e, { url: 'noaa-planetary-k-index.json' }, true);
    throw e;
  }
}

// 3-day Kp forecast (lowercase `kp` field, unlike historical)
export async function fetchKpForecast(): Promise<KpForecastEntry[]> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'
  );
  const result = z.array(KpForecastEntrySchema).safeParse(raw);
  if (!result.success) {
    logDataError('KpForecast parse', result.error, { url: 'noaa-planetary-k-index-forecast.json' }, false);
    return [];
  }
  return result.data;
}

// Solar wind plasma (parsed from string[][])
export async function fetchPlasma(): Promise<PlasmaEntry[]> {
  const raw = await fetchJson<string[][]>(
    'https://services.swpc.noaa.gov/products/solar-wind/plasma-6-hour.json'
  );
  return parseStringArrayRows(raw).filter((obj) => PlasmaEntrySchema.safeParse(obj).success);
}

// Magnetic field data
export async function fetchMag(): Promise<MagEntry[]> {
  const raw = await fetchJson<string[][]>(
    'https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json'
  );
  return parseStringArrayRows(raw).filter((obj) => MagEntrySchema.safeParse(obj).success);
}

// X-ray flares
export async function fetchXrayFlaresLatest(): Promise<XrayFlare[]> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json'
  );
  const result = z.array(XrayFlareSchema).safeParse(raw);
  if (!result.success) {
    logDataError('XrayFlares parse', result.error, { url: 'xray-flares-latest.json' }, false);
    return [];
  }
  return result.data;
}

// Alerts
export async function fetchAlerts(): Promise<Alert[]> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/products/alerts.json'
  );
  const result = z.array(AlertSchema).safeParse(raw);
  if (!result.success) {
    logDataError('Alerts parse', result.error, { url: 'alerts.json' }, false);
    return [];
  }
  return result.data;
}

// Solar regions
export async function fetchSolarRegions(): Promise<SolarRegion[]> {
  const raw = await fetchJson<unknown>(
    'https://services.swpc.noaa.gov/json/solar_regions.json'
  );
  const result = z.array(SolarRegionSchema).safeParse(raw);
  if (!result.success) {
    logDataError('SolarRegions parse', result.error, { url: 'solar_regions.json' }, false);
    return [];
  }
  return result.data;
}

// Fireballs - proxied via /api/fireballs (CORS-safe + cached), sourced from NASA JPL CNEOS.
// The API returns a tabular format { fields, data }; we normalize it to Fireball objects here.
export async function fetchFireballs(limit = 10): Promise<Fireball[]> {
  const url = `/api/fireballs?limit=${limit}`;
  const raw = await fetchJson<unknown>(url);
  const { fields, data } = NASAFireballRawSchema.parse(raw);

  const col = (row: (string | null)[], name: string): string | null => {
    const i = fields.indexOf(name);
    return i >= 0 ? row[i] : null;
  };

  return data
    .map((row): Fireball => {
      const latStr = col(row, 'lat');
      const lonStr = col(row, 'lon');
      const latDir = col(row, 'lat-dir');
      const lonDir = col(row, 'lon-dir');
      const latNum = latStr != null ? parseFloat(latStr) : null;
      const lonNum = lonStr != null ? parseFloat(lonStr) : null;

      return {
        date:    col(row, 'date') ?? '',
        lat:     latNum != null && isFinite(latNum) ? latNum * (latDir === 'S' ? -1 : 1) : null,
        lon:     lonNum != null && isFinite(lonNum) ? lonNum * (lonDir === 'W' ? -1 : 1) : null,
        energy:  col(row, 'energy'),
        impactE: col(row, 'impact-e'),
        alt:     col(row, 'alt'),
        vel:     col(row, 'vel'),
      };
    })
    .filter((f) => f.date !== '');
}

// Types are exported from ./schemas (the single source of truth).
// Do not add re-exports here to avoid confusion about ownership.
