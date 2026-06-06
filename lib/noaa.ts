// lib/noaa.ts
// Pure business logic, derived calculations, and data-processing utilities
// for AuroraWatch (Northern US aurora + space weather).
//
// This module owns:
// - Time-series helpers (latest)
// - OVATION data utilities (filtering, max prob, color/radius scales for viz)
// - Solar activity parsing (CMEs, sunspots)
// - Michigan outlook computation (getTonightOutlook + risk/guidance helpers)
// - Meteor shower calendar helpers
// - Fireball display formatters
//
// Data fetching + Zod validation lives in lib/api/ (fetchers + schemas).
// React hook composition lives in lib/use-noaa-data.ts.
// UI components and page import business results via the hooks barrel where convenient.

import type {
  Alert,
  Fireball,
  CmeSummary,
  OvationResponse,
  SolarRegion,
  XrayFlare,
} from "./api/schemas";
import type { MeteorShower } from "./api/schemas";
import { MAJOR_METEOR_SHOWERS } from "./constants/meteors";
import { US_CITIES } from "./constants/usCities";

// Helper: get most recent value from time series (tolerant of optional time_tag after defensive schemas)
export function latest<T extends { time_tag?: string | null }>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[arr.length - 1];
}

/**
 * Plain-English aurora guidance for the northern US, incorporating Kp + OVATION prob + Bz.
 * Pure function; lives here alongside getMichiganRiskLevel and getTonightOutlook.
 */
export function getMichiganGuidance(
  kp: number | null,
  maxProb: number | null,
  bz: number | null
): string {
  if (kp === null) return "Data loading...";
  let text: string;
  if (kp >= 7) {
    text = "High probability of aurora visible across the northern United States, including areas well south of the Great Lakes.";
  } else if (kp >= 5) {
    text = "Good chance across northern-tier states; possible in the Great Lakes region with clear dark skies.";
  } else if (kp >= 4) {
    text = "Possible across the northern states. Farther south unlikely unless skies are very dark and clear.";
  } else {
    text = "Low probability across the northern US. Best chances remain at the highest latitudes.";
  }
  if (bz !== null && bz <= -5) {
    text += " Strong southward Bz currently boosting chances.";
  } else if (maxProb !== null && maxProb >= 20) {
    text += " Elevated probabilities across North America increase the odds.";
  }
  return text;
}

// Regional risk level for visibility (used by alerts UI + header badge).
// Pure function; derived from Kp + OVATION prob + Bz. Lives here with other
// business logic rather than inside a hook file.
export function getMichiganRiskLevel(
  kp: number | null,
  maxAuroraProbNA: number | null,
  bz: number | null
): "Quiet" | "Moderate" | "High" {
  if (kp === null) return "Quiet";
  const prob = maxAuroraProbNA ?? 0;
  const b = bz ?? 0;
  if (kp >= 5 || prob >= 25 || b <= -8) {
    return "High";
  }
  if (kp >= 4 || prob >= 15 || b <= -5) {
    return "Moderate";
  }
  return "Quiet";
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

// Filter raw OVATION coordinates to a region + min probability.
// NOAA sends longitude as 0–360; convert to -180..180 with a single subtraction.
export function filterOvationCoordinates(
  coordinates: Array<unknown[]> | undefined,
  minProb: number = 0,
  bounds = NORTH_AMERICA_BOUNDS
): OvationPoint[] {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return [];

  const results: OvationPoint[] = [];

  for (const row of coordinates) {
    if (!Array.isArray(row) || row.length < 3) continue;

    const rawLon = row[0];
    const lat = row[1];
    const prob = row[2];

    if (typeof rawLon !== 'number' || typeof lat !== 'number' || typeof prob !== 'number') continue;
    if (!isFinite(rawLon) || !isFinite(lat) || !isFinite(prob)) continue;
    if (lat < -90 || lat > 90) continue;
    if (prob < minProb) continue;

    // NOAA uses 0–360 longitude — convert to -180..180
    const lon = rawLon > 180 ? rawLon - 360 : rawLon;

    if (lon < bounds.minLon || lon > bounds.maxLon) continue;
    if (lat < bounds.minLat || lat > bounds.maxLat) continue;

    results.push({ lat, lon, prob });
  }

  return results;
}

// Compute max aurora probability in the North America region.
// Uses reduce (not spread) — real OVATION grids yield thousands of points in NA bounds.
export function maxOvationNorthAmerica(data: OvationResponse | null): number {
  if (!data || !Array.isArray(data.coordinates) || data.coordinates.length === 0) return 0;
  const relevant = filterOvationCoordinates(data.coordinates, 0);
  if (relevant.length === 0) return 0;
  return relevant.reduce((max, p) => Math.max(max, p.prob), 0);
}

// ── Canonical 4-tier aurora color palette ─────────────────────────────────
// Single source of truth used by the header Kp pill, viewing window, and map.
// Tier names mirror geomagnetic storm scale language so they're self-documenting.
//
// Kp  cutoffs: quiet <4 · moderate 4–4.9 · active 5–5.9 · storm ≥6
// Prob cutoffs: quiet <10% · moderate 10–29% · active 30–59% · storm ≥60%
export const AURORA_TIERS = {
  quiet:    { color: '#22c55e', label: 'Quiet'    },
  moderate: { color: '#eab308', label: 'Moderate' },
  active:   { color: '#f97316', label: 'Active'   },
  storm:    { color: '#a78bfa', label: 'Storm'    },
} as const;

export type AuroraTier = keyof typeof AURORA_TIERS;

/** Map a Kp index (0–9) to the canonical activity tier. */
export function getKpTier(kp: number): AuroraTier {
  if (kp >= 6) return 'storm';
  if (kp >= 5) return 'active';
  if (kp >= 4) return 'moderate';
  return 'quiet';
}

/** Map an aurora probability (0–100%) to the canonical activity tier. */
export function getProbTier(prob: number): AuroraTier {
  if (prob >= 60) return 'storm';
  if (prob >= 30) return 'active';
  if (prob >= 10) return 'moderate';
  return 'quiet';
}

/** Aurora color for a given probability. Internals use the unified tier system. */
export function getAuroraColor(prob: number): string {
  return AURORA_TIERS[getProbTier(prob)].color;
}

/** Radius for high-prob marker peaks (scaled for visual weight). */
export function getAuroraMarkerRadius(prob: number): number {
  if (prob < 15) return 3;
  if (prob < 40) return 3.5;
  return 4.5; // larger for the strongest areas
}

/** Cloud cover color for display: green < 30%, amber < 60%, slate otherwise. */
export function cloudCoverColor(pct: number): string {
  if (pct < 30) return "#22c55e";
  if (pct < 60) return "#eab308";
  return "#94a3b8";
}

// --- Solar Activity (pure functions only - fetchers moved to lib/api/fetchers.ts) ---

// NOAA geomagnetic storm watch product IDs — issued specifically when Earth-directed CMEs
// are detected and projected to impact Earth. More reliable as a primary signal than
// body-text regex alone, which can break if NOAA changes alert wording.
// G1=WATA07, G2=WATA20, G3=WATA30, G4=WATA40, G5=WATA50
const STORM_WATCH_IDS = new Set(['WATA07', 'WATA20', 'WATA30', 'WATA40', 'WATA50']);

/** Parse recent Earth-directed or relevant CMEs from NOAA alerts. */
export function parseRecentCmes(alerts: Alert[] | undefined): CmeSummary[] {
  if (!alerts || alerts.length === 0) return [];

  // Primary: storm watches are structurally tied to Earth-directed CME detection
  const stormWatches = alerts.filter((a) => STORM_WATCH_IDS.has(a.product_id));
  // Secondary: body-text CME mentions not already captured above
  const cmeBodyAlerts = alerts.filter(
    (a) => !STORM_WATCH_IDS.has(a.product_id) && /CME|Coronal Mass Ejection/i.test(a.message)
  );

  const candidates = [...stormWatches, ...cmeBodyAlerts].slice(0, 2);

  return candidates.map((a) => {
    const msg = a.message;
    // Word-boundary prefix avoids matching partial numbers; range covers realistic CME speeds
    const speedMatch = msg.match(/\b(\d{3,4})\s*km\/s/i);
    const dirMatch = msg.match(/Earth-directed|Earth-facing|full halo|partial halo|halo CME/i);
    const impactNote = /Earth-directed|Earth-facing|will reach Earth|geomagnetic storm/i.test(msg)
      ? "Likely Earth impact"
      : "Monitor for effects";
    const lines = msg.split("\n").filter(Boolean);
    const joined = lines.slice(0, 3).join(" ").replace(/\s+/g, " ");
    const shortNote = joined.length > 140 ? joined.substring(0, 140) + "…" : joined;
    return {
      time: a.issue_datetime,
      speed: speedMatch ? parseInt(speedMatch[1], 10) : undefined,
      direction: dirMatch ? dirMatch[0] : undefined,
      earthImpact: impactNote,
      note: shortNote,
    };
  });
}

export type CmeImpactLevel = "likely" | "possible" | "none";

export interface EarthImpactAssessment {
  level: CmeImpactLevel;
  headline: string;
  detail: string;
  cme: CmeSummary | null;
}

/**
 * Derive a plain-English Earth-impact assessment from recent CME data.
 * Ignores CMEs older than 5 days — by then they've already arrived or missed.
 */
export function assessEarthImpact(recentCmes: CmeSummary[]): EarthImpactAssessment {
  const fresh = recentCmes.filter(
    (c) => Date.now() - new Date(c.time).getTime() < 1000 * 60 * 60 * 24 * 5
  );

  const likely = fresh.find((c) => c.earthImpact === "Likely Earth impact");
  if (likely) {
    const speedStr = likely.speed ? ` traveling at ${likely.speed.toLocaleString()} km/s` : "";
    return {
      level: "likely",
      headline: "Likely Earth-directed CME detected",
      detail: `A potentially Earth-directed CME${speedStr} was detected. If confirmed, aurora enhancement is possible in 1–3 days.`,
      cme: likely,
    };
  }

  if (fresh.length > 0) {
    const cme = fresh[0];
    const speedStr = cme.speed ? ` (${cme.speed.toLocaleString()} km/s)` : "";
    return {
      level: "possible",
      headline: "Possible Earth-directed CME",
      detail: `CME activity${speedStr} has been detected. An Earth-directed impact is uncertain — monitor for updated NOAA alerts.`,
      cme,
    };
  }

  return {
    level: "none",
    headline: "No Earth-directed CME detected recently",
    detail: "No Earth-directed CME alerts appear in recent NOAA data. Aurora activity depends primarily on current solar wind and Bz.",
    cme: null,
  };
}

/** Compute total sunspot number from latest reported regions. */
export function currentSunspotNumber(regions: SolarRegion[] | undefined): number | null {
  if (!regions || regions.length === 0) return null;
  const valid = regions.filter((r) => r.observed_date && typeof r.number_spots === "number");
  if (valid.length === 0) return null;
  const dates = [...new Set(valid.map((r) => r.observed_date!))].sort().reverse();
  const latestDate = dates[0];
  const todays = valid.filter((r) => r.observed_date === latestDate);
  const total = todays.reduce((sum, r) => sum + (r.number_spots || 0), 0);
  return total > 0 ? total : null;
}

export interface CityAuroraProb {
  name: string;
  state: string;
  prob: number;
}

export interface TonightOutlook {
  status: 'Excellent' | 'Good' | 'Moderate' | 'Low' | 'Quiet' | 'Loading';
  message: string;
  reasons: string[];
  accentColor: string;
  drivers?: string;
  cityProbs?: CityAuroraProb[];
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
  latestFlare: XrayFlare | null = null,
  solarWindSpeed: number | null = null
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
  // High-speed solar wind (CIR events) enhances geomagnetic coupling independently of Kp
  const highSpeed = solarWindSpeed !== null && solarWindSpeed > 600;
  const veryHighSpeed = solarWindSpeed !== null && solarWindSpeed > 700;

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

  if (kp >= 7 || (kp >= 6 && (strongFavorableBz || highProb)) || (kp >= 5 && veryHighSpeed && isFavorableBz)) {
    status = 'Excellent';
    message = 'Strong chance across the northern tier, reaching well into the Great Lakes region.';
    accentColor = '#22c55e';
    if (strongFavorableBz) reasons.push('Strong southward Bz currently boosting chances');
    if (veryHighSpeed && solarWindSpeed) reasons.push(`Very high solar wind speed (${Math.round(solarWindSpeed)} km/s) amplifying activity`);
    if (highProb && !veryHighSpeed) reasons.push('Elevated OVATION probabilities across North America');
  } else if (kp >= 5 || (kp >= 4 && isFavorableBz) || (kp >= 4 && highSpeed) || (kp >= 3 && highSpeed && isFavorableBz) || highProb) {
    status = 'Good';
    message = 'Good chance tonight for northern-tier states and the Great Lakes region.';
    accentColor = '#22c55e';
    if (isFavorableBz) reasons.push('Southward Bz currently favorable');
    if (highSpeed && solarWindSpeed) reasons.push(`Elevated solar wind speed (${Math.round(solarWindSpeed)} km/s) enhancing coupling`);
    if (highProb && !highSpeed) reasons.push('High aurora probabilities across NA');
  } else if (kp >= 4 || (kp >= 3 && isFavorableBz) || moderateProb || hasEarthCme || highSpeed) {
    status = 'Moderate';
    message = 'Possible across northern states under dark skies.';
    accentColor = '#eab308';
    if (isFavorableBz) reasons.push('Favorable Bz may enhance activity');
    if (hasEarthCme) reasons.push('Recent Earth-directed CME may increase chances');
    if (highSpeed && !isFavorableBz && solarWindSpeed) reasons.push(`Elevated solar wind speed (${Math.round(solarWindSpeed)} km/s) — watch for Bz to turn south`);
  } else if (kp >= 3 || isFavorableBz || significantFlare) {
    status = 'Low';
    message = 'Low probability across the northern US.';
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

  const speedStr = solarWindSpeed !== null ? ` • ${Math.round(solarWindSpeed)} km/s` : '';
  const drivers = `Kp ${kp.toFixed(1)} • Bz ${bz !== null ? bz.toFixed(1) : '—'} nT${speedStr}`;

  return { status, message, reasons, accentColor, drivers };
}

// ── City-level aurora probability ──────────────────────────────────────────

const AURORA_WATCH_CITIES = [
  { name: "Duluth",       state: "MN", lat: 46.79, lon: -92.10  },
  { name: "Fargo",        state: "ND", lat: 46.88, lon: -96.79  },
  { name: "Marquette",    state: "MI", lat: 46.54, lon: -87.40  },
  { name: "Billings",     state: "MT", lat: 45.78, lon: -108.50 },
  { name: "Presque Isle", state: "ME", lat: 46.68, lon: -68.02  },
] as const;

// Rough equatorward aurora oval boundary by Kp (Holzworth & Meng 1975, simplified).
function estimateProbFromKp(kp: number, lat: number): number {
  const boundary = 72 - kp * 4;
  const margin = lat - boundary;
  if (margin <= -15) return 0;
  const peak = Math.min(90, 30 + kp * 8);
  if (margin >= 0) return peak;
  return Math.max(0, Math.round(((margin + 15) / 15) * peak));
}

/**
 * Returns tonight's aurora viewing probability (0–99) for each watch city.
 * Primary: nearest OVATION grid point. Fallback: Kp + latitude formula.
 * Strong southward Bz (≤ −5 nT) adds a small boost not yet reflected in OVATION.
 */
export function getCityAuroraProbabilities(
  ovationData: OvationResponse | null,
  kp: number | null,
  bz: number | null
): CityAuroraProb[] {
  const points = ovationData
    ? filterOvationCoordinates(ovationData.coordinates, 0)
    : [];

  return AURORA_WATCH_CITIES.map((city) => {
    let prob = 0;

    if (points.length > 0) {
      let nearestDist = Infinity;
      for (const p of points) {
        const d = (p.lat - city.lat) ** 2 + (p.lon - city.lon) ** 2;
        if (d < nearestDist) { nearestDist = d; prob = p.prob; }
      }
    } else if (kp !== null) {
      prob = estimateProbFromKp(kp, city.lat);
    }

    if (bz !== null && bz <= -5) {
      prob = Math.min(99, prob + Math.round(Math.min(8, Math.abs(bz + 5) * 1.5)));
    }

    return { name: city.name, state: city.state, prob: Math.round(Math.max(0, Math.min(99, prob))) };
  });
}

/**
 * Returns the name of the nearest US city to a given lat/lon.
 * Used to label the geolocation result in HeroOutlook instead of showing raw coordinates.
 */
export function getNearestCityName(lat: number, lon: number): string {
  let best: (typeof US_CITIES)[number] = US_CITIES[0];
  let bestDist = Infinity;
  for (const city of US_CITIES) {
    const d = (city.lat - lat) ** 2 + (city.lon - lon) ** 2;
    if (d < bestDist) { bestDist = d; best = city; }
  }
  return `${best.name}, ${best.state}`;
}

/**
 * Compute aurora probability for an arbitrary user-provided lat/lon.
 * Used for the geolocation "My location" feature in HeroOutlook.
 * Same nearest-OVATION-cell logic as getCityAuroraProbabilities.
 */
export function getLocationAuroraProb(
  lat: number,
  lon: number,
  ovationData: OvationResponse | null,
  kp: number | null,
  bz: number | null
): number {
  const points = ovationData ? filterOvationCoordinates(ovationData.coordinates, 0) : [];
  let prob = 0;

  if (points.length > 0) {
    let nearestDist = Infinity;
    for (const p of points) {
      const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
      if (d < nearestDist) { nearestDist = d; prob = p.prob; }
    }
  } else if (kp !== null) {
    prob = estimateProbFromKp(kp, lat);
  }

  if (bz !== null && bz <= -5) {
    prob = Math.min(99, prob + Math.round(Math.min(8, Math.abs(bz + 5) * 1.5)));
  }

  return Math.round(Math.max(0, Math.min(99, prob)));
}

// Meteor shower calendar helpers

export type { MeteorShower };
export { MAJOR_METEOR_SHOWERS } from "./constants/meteors";

export function getNextMeteorShower(now: Date = new Date()): { shower: MeteorShower; peakDate: Date } | null {
  const thisYear = now.getFullYear();
  const candidates: Array<{ shower: MeteorShower; date: Date }> = [];

  for (let offset = 0; offset <= 1; offset++) {
    const y = thisYear + offset;
    for (const shower of MAJOR_METEOR_SHOWERS) {
      const candidate = new Date(y, shower.peakMonth - 1, shower.peakDay);
      if (offset === 0 && candidate.getTime() < now.getTime()) {
        continue;
      }
      candidates.push({ shower, date: candidate });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = candidates[0];
  return { shower: next.shower, peakDate: next.date };
}
export function formatMeteorPeak(peakDate: Date, shower: MeteorShower): string {
  const month = peakDate.toLocaleString("en-US", { month: "long" });
  let str = `${month} ${peakDate.getDate()}`;
  if (shower.peakEndDay) {
    const endMonth = shower.peakEndMonth || shower.peakMonth;
    const end = new Date(peakDate.getFullYear(), endMonth - 1, shower.peakEndDay);
    if (end.getMonth() === peakDate.getMonth()) {
      str += `–${end.getDate()}`;
    } else {
      str += ` – ${end.toLocaleString("en-US", { month: "long", day: "numeric" })}`;
    }
  }
  return `${str}, ${peakDate.getFullYear()}`;
}
export function createGoogleCalendarLink(shower: MeteorShower, peakDate: Date): string {
  const y = peakDate.getFullYear();
  const m = String(peakDate.getMonth() + 1).padStart(2, "0");
  const d = String(peakDate.getDate()).padStart(2, "0");
  const start = `${y}${m}${d}`;

  // Span the peak night(s): for range use +2 days for end, else +1
  const span = shower.peakEndDay ? 2 : 1;
  const endDate = new Date(peakDate);
  endDate.setDate(endDate.getDate() + span);
  const ey = endDate.getFullYear();
  const em = String(endDate.getMonth() + 1).padStart(2, "0");
  const ed = String(endDate.getDate()).padStart(2, "0");
  const end = `${ey}${em}${ed}`;

  const text = encodeURIComponent(`Meteor Shower Peak: ${shower.name}`);
  const details = encodeURIComponent(
    `Peak night(s): ${formatMeteorPeak(peakDate, shower)}\n\n${shower.description}\n\nExpected activity: ${shower.activityLevel}\n\nBest viewed after midnight from dark skies (northern latitudes ideal).`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&sf=true&output=xml`;
}

// Fireball display formatters (pure; types come from schemas).

export function formatFireballDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.replace(" ", "T") + "Z");
    return (
      d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }) + " UTC"
    );
  } catch {
    return dateStr;
  }
}

export function formatFireballLocation(fireball: Pick<Fireball, "lat" | "lon">): string {
  if (fireball.lat != null && fireball.lon != null) {
    const latStr = `${Math.abs(fireball.lat).toFixed(1)}°${fireball.lat >= 0 ? "N" : "S"}`;
    const lonStr = `${Math.abs(fireball.lon).toFixed(1)}°${fireball.lon >= 0 ? "E" : "W"}`;
    return `${latStr}, ${lonStr}`;
  }
  return "Location unavailable";
}

export function formatFireballEnergy(impactE: string | null | undefined): string {
  if (!impactE) return "—";
  const val = parseFloat(impactE);
  if (isNaN(val)) return "—";
  if (val >= 1) return `${val.toFixed(1)} kt TNT`;
  if (val >= 0.001) return `${val.toFixed(3)} kt TNT`;
  return "< 0.001 kt TNT";
}
