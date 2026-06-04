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

// --- Solar Activity Types & Fetchers (for new SOLAR ACTIVITY section) ---

export type XrayFlare = {
  time_tag: string;
  satellite: number;
  current_class?: string;
  max_class?: string;
  begin_time?: string;
  max_time?: string;
  end_time?: string;
  region?: number;
};

export async function fetchXrayFlaresLatest(): Promise<XrayFlare[]> {
  return fetchJson<XrayFlare[]>(
    "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json"
  );
}

export type Alert = {
  product_id: string;
  issue_datetime: string;
  message: string;
};

export async function fetchAlerts(): Promise<Alert[]> {
  return fetchJson<Alert[]>(
    "https://services.swpc.noaa.gov/products/alerts.json"
  );
}

export type CmeSummary = {
  time: string;
  speed?: number;
  direction?: string;
  earthImpact?: string;
  note: string;
};

/** Parse recent Earth-directed or relevant CMEs from alerts messages (lightweight extraction). */
export function parseRecentCmes(alerts: Alert[] | undefined): CmeSummary[] {
  if (!alerts || alerts.length === 0) return [];
  const cmeAlerts = alerts.filter((a) =>
    /CME|Coronal Mass Ejection/i.test(a.message)
  );
  return cmeAlerts.slice(0, 2).map((a) => {
    const msg = a.message;
    const speedMatch = msg.match(/(\d{3,4})\s*km\/s/i);
    const dirMatch = msg.match(/Earth-directed|full halo|partial halo|halo CME/i);
    const impactNote = /Earth-directed|will reach Earth|geomagnetic storm/i.test(msg)
      ? "Likely Earth impact"
      : "Monitor for effects";
    // Extract a short summary
    const lines = msg.split("\n").filter(Boolean);
    const shortNote = lines.slice(0, 3).join(" ").replace(/\s+/g, " ").substring(0, 140) + "...";
    return {
      time: a.issue_datetime,
      speed: speedMatch ? parseInt(speedMatch[1], 10) : undefined,
      direction: dirMatch ? dirMatch[0] : undefined,
      earthImpact: impactNote,
      note: shortNote,
    };
  });
}

export type SolarRegion = {
  Obsdate?: string;
  Numspot?: number;
  Region?: string;
  // other fields available but we only need for total
};

export async function fetchSolarRegions(): Promise<SolarRegion[]> {
  return fetchJson<SolarRegion[]>(
    "https://services.swpc.noaa.gov/json/solar_regions.json"
  );
}

/** Compute total sunspot number from latest reported regions. */
export function currentSunspotNumber(regions: SolarRegion[] | undefined): number | null {
  if (!regions || regions.length === 0) return null;
  const valid = regions.filter((r) => r.Obsdate && typeof r.Numspot === "number");
  if (valid.length === 0) return null;
  // find most recent date
  const dates = [...new Set(valid.map((r) => r.Obsdate!))].sort().reverse();
  const latestDate = dates[0];
  const todays = valid.filter((r) => r.Obsdate === latestDate);
  const total = todays.reduce((sum, r) => sum + (r.Numspot || 0), 0);
  return total > 0 ? total : null;
}

export interface TonightOutlook {
  status: 'Excellent' | 'Good' | 'Moderate' | 'Low' | 'Quiet' | 'Loading';
  message: string;
  reasons: string[];
  accentColor: string;
  drivers?: string;
}

/**
 * Compute a realistic, Michigan-focused outlook for tonight based on current conditions.
 * Prioritizes Kp + Bz + OVATION prob, with solar activity as supporting context.
 */
export function getTonightOutlook(
  kp: number | null,
  bz: number | null,
  maxAuroraProbNA: number | null,
  recentCmes: CmeSummary[] = [],
  latestFlare: XrayFlare | null = null
): TonightOutlook {
  if (kp === null) {
    return {
      status: 'Loading',
      message: 'Loading current conditions…',
      reasons: [],
      accentColor: '#64748b',
    };
  }

  const isFavorableBz = bz !== null && bz <= -5;
  const strongFavorableBz = bz !== null && bz <= -10;
  const highProb = maxAuroraProbNA !== null && maxAuroraProbNA >= 20;
  const moderateProb = maxAuroraProbNA !== null && maxAuroraProbNA >= 10;

  const hasEarthCme = recentCmes.length > 0 && recentCmes.some(
    (c) => c.earthImpact?.includes('impact') || /Earth-directed/i.test(c.note || c.direction || '')
  );

  const significantFlare = latestFlare && (
    latestFlare.max_class?.startsWith('M') || latestFlare.max_class?.startsWith('X')
  );

  let status: TonightOutlook['status'];
  let message: string;
  let reasons: string[] = [];
  let accentColor: string;

  if (kp >= 7 || (kp >= 6 && (strongFavorableBz || highProb))) {
    status = 'Excellent';
    message = 'Strong chance across much of the UP + possible in northern Lower Michigan.';
    accentColor = '#22c55e';
    if (strongFavorableBz) reasons.push('Strong southward Bz currently boosting chances');
    if (highProb) reasons.push('Elevated OVATION probabilities across North America');
  } else if (kp >= 5 || (kp >= 4 && isFavorableBz) || highProb) {
    status = 'Good';
    message = 'Good chance in the Upper Peninsula.';
    accentColor = '#22c55e';
    if (isFavorableBz) reasons.push('Southward Bz currently favorable');
    if (highProb) reasons.push('High aurora probabilities across NA');
  } else if (kp >= 4 || (kp >= 3 && isFavorableBz) || moderateProb || hasEarthCme) {
    status = 'Moderate';
    message = 'Possible in the Upper Peninsula under dark skies.';
    accentColor = '#eab308';
    if (isFavorableBz) reasons.push('Favorable Bz may enhance activity');
    if (hasEarthCme) reasons.push('Recent Earth-directed CME may increase chances');
  } else if (kp >= 3 || isFavorableBz || significantFlare) {
    status = 'Low';
    message = 'Low probability across Michigan.';
    accentColor = '#f97316';
    if (isFavorableBz) reasons.push('Southward Bz provides some opportunity');
  } else {
    status = 'Quiet';
    message = 'Very low chance tonight.';
    accentColor = '#64748b';
  }

  // Add a driver reason if we have room
  if (reasons.length < 2 && kp >= 4) {
    reasons.push(`Current Kp ${kp.toFixed(1)} supports activity`);
  }
  if (reasons.length < 2 && significantFlare) {
    reasons.push('Recent significant flare may contribute');
  }

  reasons = reasons.slice(0, 2);

  const drivers = `Kp ${kp.toFixed(1)} • Bz ${bz !== null ? bz.toFixed(1) : '—'} nT`;

  return { status, message, reasons, accentColor, drivers };
}
