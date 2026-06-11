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
import { logDataError, recordDataSuccess } from '../utils/retry';

// Base fetch helper (shared, server + client safe).
// Pure HTTP utility — intentionally has no logDataError calls so that each
// fetcher can attribute errors to the correct source in the health store.
// 30-second timeout guards against hung NOAA/NASA endpoints.
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
    ...options,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Centralized, schema-validated fetchers for SkyGlow.
// All external data goes through Zod (parse or safeParse+filter for resilience).
// Consumers should import types from './schemas', not rely on re-exports.

// Shared helper: convert NOAA's string[][] format (header row + data rows) to typed objects.
export function parseStringArrayRows(raw: string[][]): Record<string, string | number | null>[] {
  if (!raw || raw.length < 2) return [];
  const headers = raw[0];
  return raw.slice(1).filter((row) => row.length >= headers.length).map((row) => {
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
  const url = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
  try {
    const raw = await fetchJson<unknown>(url);
    const result = OvationResponseSchema.safeParse(raw);
    if (!result.success) {
      // Parse failure: log the error but return a safe fallback so the map stays functional
      logDataError('OVATION parse', result.error, { url }, true, 'ovation');
      return { coordinates: [] };
    }
    recordDataSuccess('ovation');
    return result.data;
  } catch (e) {
    logDataError('OVATION fetch', e, { url }, true, 'ovation');
    throw e;
  }
}

// Planetary K-index
export async function fetchKpIndex(): Promise<KpEntry[]> {
  const url = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
  try {
    const raw = await fetchJson<unknown>(url);
    const result = KpResponseSchema.parse(raw);
    recordDataSuccess('kp');
    return result;
  } catch (e) {
    logDataError('KpIndex', e, { url }, true, 'kp');
    throw e;
  }
}

// 3-day Kp forecast (lowercase `kp` field, unlike historical)
export async function fetchKpForecast(): Promise<KpForecastEntry[]> {
  const url = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
  try {
    const raw = await fetchJson<unknown>(url);
    const result = z.array(KpForecastEntrySchema).safeParse(raw);
    if (!result.success) {
      if (process.env.NODE_ENV === 'development') console.warn('[SkyGlow] KpForecast schema mismatch:', result.error.format?.());
      logDataError('KpForecast parse', result.error, { url }, false, 'kp-forecast');
      return [];
    }
    recordDataSuccess('kp-forecast');
    return result.data;
  } catch (e) {
    logDataError('KpForecast fetch', e, { url }, false, 'kp-forecast');
    throw e;
  }
}

// Solar wind plasma (parsed from string[][])
export async function fetchPlasma(): Promise<PlasmaEntry[]> {
  const url = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-6-hour.json';
  try {
    const raw = await fetchJson<string[][]>(url);
    const result = parseStringArrayRows(raw).filter((obj) => PlasmaEntrySchema.safeParse(obj).success);
    recordDataSuccess('plasma');
    return result;
  } catch (e) {
    logDataError('Plasma fetch', e, { url }, false, 'plasma');
    throw e;
  }
}

// Magnetic field data
export async function fetchMag(): Promise<MagEntry[]> {
  const url = 'https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json';
  try {
    const raw = await fetchJson<string[][]>(url);
    const result = parseStringArrayRows(raw).filter((obj) => MagEntrySchema.safeParse(obj).success);
    recordDataSuccess('mag');
    return result;
  } catch (e) {
    logDataError('Mag fetch', e, { url }, false, 'mag');
    throw e;
  }
}

// X-ray flares
export async function fetchXrayFlaresLatest(): Promise<XrayFlare[]> {
  const url = 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json';
  try {
    const raw = await fetchJson<unknown>(url);
    const result = z.array(XrayFlareSchema).safeParse(raw);
    if (!result.success) {
      logDataError('XrayFlares parse', result.error, { url }, false, 'xray-flares');
      return [];
    }
    recordDataSuccess('xray-flares');
    return result.data;
  } catch (e) {
    logDataError('XrayFlares fetch', e, { url }, false, 'xray-flares');
    throw e;
  }
}

export async function fetchXrayFlares7Day(): Promise<XrayFlare[]> {
  const url = 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json';
  try {
    const raw = await fetchJson<unknown>(url);
    const result = z.array(XrayFlareSchema).safeParse(raw);
    if (!result.success) {
      logDataError('XrayFlares7Day parse', result.error, { url }, false, 'xray-flares');
      return [];
    }
    return result.data;
  } catch (e) {
    logDataError('XrayFlares7Day fetch', e, { url }, false, 'xray-flares');
    return [];
  }
}

// Alerts
export async function fetchAlerts(): Promise<Alert[]> {
  const url = 'https://services.swpc.noaa.gov/products/alerts.json';
  try {
    const raw = await fetchJson<unknown>(url);
    const result = z.array(AlertSchema).safeParse(raw);
    if (!result.success) {
      logDataError('Alerts parse', result.error, { url }, false, 'alerts');
      return [];
    }
    recordDataSuccess('alerts');
    return result.data;
  } catch (e) {
    logDataError('Alerts fetch', e, { url }, false, 'alerts');
    throw e;
  }
}

// Solar regions
export async function fetchSolarRegions(): Promise<SolarRegion[]> {
  const url = 'https://services.swpc.noaa.gov/json/solar_regions.json';
  try {
    const raw = await fetchJson<unknown>(url);
    const result = z.array(SolarRegionSchema).safeParse(raw);
    if (!result.success) {
      logDataError('SolarRegions parse', result.error, { url }, false, 'solar-regions');
      return [];
    }
    recordDataSuccess('solar-regions');
    return result.data;
  } catch (e) {
    logDataError('SolarRegions fetch', e, { url }, false, 'solar-regions');
    throw e;
  }
}

// Fireballs - proxied via /api/fireballs (CORS-safe + cached), sourced from NASA JPL CNEOS.
// The API returns a tabular format { fields, data }; we normalize it to Fireball objects here.
export async function fetchFireballs(limit = 10): Promise<Fireball[]> {
  const url = `/api/fireballs?limit=${limit}`;
  let fields: string[];
  let data: (string | null)[][];
  try {
    const raw = await fetchJson<unknown>(url);
    ({ fields, data } = NASAFireballRawSchema.parse(raw));
  } catch (e) {
    logDataError('Fireballs fetch', e, { url }, false, 'fireballs');
    throw e;
  }

  const col = (row: (string | null)[], name: string): string | null => {
    const i = fields.indexOf(name);
    return i >= 0 ? row[i] : null;
  };

  const fireballs = data
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
  recordDataSuccess('fireballs');
  return fireballs;
}

// Types are exported from ./schemas (the single source of truth).
// Do not add re-exports here to avoid confusion about ownership.
