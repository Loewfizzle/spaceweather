// lib/noaa.ts
// Pure business logic, derived calculations, and data-processing utilities
// for AuroraWatch (Northern US aurora + space weather).
//
// This module owns:
// - Time-series helpers (latest)
// - OVATION data utilities (filtering, max prob, color/radius scales for viz)
// - Solar activity parsing (CMEs, sunspots)
// - Aurora outlook computation (getTonightOutlook + risk/guidance helpers)
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
 * Pure function; lives here alongside getAuroraRiskLevel and getTonightOutlook.
 */
export function getAuroraGuidance(
  kp: number | null,
  maxProb: number | null,
  bz: number | null,
  solarWindSpeed?: number | null,
  forecastPeakKp?: number | null
): string {
  if (kp === null) return "Data loading...";
  const highSpeed = solarWindSpeed != null && solarWindSpeed > 600;
  // Use the higher of current Kp or forecast peak to select the guidance tier
  const effectiveKp = forecastPeakKp != null ? Math.max(kp, forecastPeakKp) : kp;
  let text: string;
  if (effectiveKp >= 7) {
    text = "High probability of aurora visible across the northern United States, including areas well south of the Great Lakes.";
  } else if (effectiveKp >= 5 || (effectiveKp >= 3 && highSpeed)) {
    text = "Good chance across northern-tier states; possible in the Great Lakes region with clear dark skies.";
  } else if (effectiveKp >= 4) {
    text = "Possible across the northern states. Farther south unlikely unless skies are very dark and clear.";
  } else {
    text = "Low probability across the northern US. Best chances remain at the highest latitudes.";
  }
  if (bz !== null && bz <= -5) {
    text += " Strong southward Bz currently boosting chances.";
  } else if (highSpeed) {
    text += " Elevated solar wind speed may enhance activity if Bz turns southward.";
  } else if (maxProb !== null && maxProb >= 20) {
    text += " Elevated probabilities across North America increase the odds.";
  }
  if (forecastPeakKp != null && forecastPeakKp > kp + 0.5) {
    text += ` Kp ${forecastPeakKp.toFixed(1)} forecast as tonight's peak.`;
  }
  return text;
}

// Regional risk level for visibility (used by alerts UI + header badge).
// Pure function; derived from Kp + OVATION prob + Bz. Lives here with other
// business logic rather than inside a hook file.
export function getAuroraRiskLevel(
  kp: number | null,
  maxAuroraProbNA: number | null,
  bz: number | null,
  solarWindSpeed?: number | null
): "Quiet" | "Moderate" | "High" {
  if (kp === null) return "Quiet";
  const prob = maxAuroraProbNA ?? 0;
  const b = bz ?? 0;
  const highSpeed = solarWindSpeed != null && solarWindSpeed > 600;
  if (kp >= 5 || prob >= 25 || b <= -8 || (kp >= 4 && highSpeed)) {
    return "High";
  }
  if (kp >= 4 || prob >= 15 || b <= -5 || (kp >= 3 && highSpeed)) {
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

// Compute max aurora probability across a pre-filtered set of OVATION points.
export function maxOvationNorthAmerica(points: OvationPoint[]): number {
  if (points.length === 0) return 0;
  return points.reduce((max, p) => Math.max(max, p.prob), 0);
}

// ── Canonical 4-tier aurora color palette ─────────────────────────────────
// Single source of truth used by the header Kp pill, viewing window, and map.
// Kp activity tiers — used by getKpTier and ViewingWindow.
// Kp cutoffs: quiet <4 · moderate 4–4.9 · active 5–5.9 · storm ≥6
export const AURORA_TIERS = {
  quiet:    { color: '#22c55e', label: 'Quiet'    },
  moderate: { color: '#eab308', label: 'Moderate' },
  active:   { color: '#f97316', label: 'Active'   },
  storm:    { color: '#a78bfa', label: 'Storm'    },
} as const;

export type AuroraTier = keyof typeof AURORA_TIERS;

// Probability display tiers — used by getProbTier, getAuroraColor, and city/location rows.
// Prob cutoffs: quiet <15% · low 15–34% · moderate 35–59% · high ≥60%
export const PROB_TIERS = {
  quiet:    { color: '#64748b', label: 'Quiet'    },
  low:      { color: '#eab308', label: 'Low'      },
  moderate: { color: '#22c55e', label: 'Moderate' },
  high:     { color: '#a78bfa', label: 'High'     },
} as const;

export type ProbTier = keyof typeof PROB_TIERS;

/** Map a Kp index (0–9) to the canonical activity tier. */
export function getKpTier(kp: number): AuroraTier {
  if (kp >= 6) return 'storm';
  if (kp >= 5) return 'active';
  if (kp >= 4) return 'moderate';
  return 'quiet';
}

/** Map an aurora probability (0–100%) to the display tier. */
export function getProbTier(prob: number): ProbTier {
  if (prob >= 60) return 'high';
  if (prob >= 35) return 'moderate';
  if (prob >= 15) return 'low';
  return 'quiet';
}

/** Aurora color for a given probability. */
export function getAuroraColor(prob: number): string {
  return PROB_TIERS[getProbTier(prob)].color;
}

/** Radius for high-prob marker peaks (scaled for visual weight). */
export function getAuroraMarkerRadius(prob: number): number {
  if (prob < 15) return 3;
  if (prob < 35) return 3.5;
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
    const isDirectHit = /Earth-directed|Earth-facing|will reach Earth|geomagnetic storm|full halo|halo CME/i.test(msg);
    const isGlancing = !isDirectHit && /partial halo|glancing/i.test(msg);
    const impactNote = isDirectHit ? "Likely Earth impact" : isGlancing ? "Glancing impact possible" : "Monitor for effects";
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
 * Compute a realistic outlook for tonight based on current conditions.
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
    accentColor = AURORA_TIERS.storm.color;
    if (strongFavorableBz) reasons.push('Strong southward Bz currently boosting chances');
    if (veryHighSpeed && solarWindSpeed) reasons.push(`Very high solar wind speed (${Math.round(solarWindSpeed)} km/s) amplifying activity`);
    if (highProb && !veryHighSpeed) reasons.push('Elevated OVATION probabilities across North America');
  } else if (kp >= 5 || (kp >= 4 && isFavorableBz) || (kp >= 4 && highSpeed) || (kp >= 3 && highSpeed && isFavorableBz) || highProb) {
    status = 'Good';
    message = 'Good chance tonight for northern-tier states and the Great Lakes region.';
    accentColor = AURORA_TIERS.active.color;
    if (isFavorableBz) reasons.push('Southward Bz currently favorable');
    if (highSpeed && solarWindSpeed) reasons.push(`Elevated solar wind speed (${Math.round(solarWindSpeed)} km/s) enhancing coupling`);
    if (highProb && !highSpeed) reasons.push('High aurora probabilities across NA');
  } else if (kp >= 4 || (kp >= 3 && isFavorableBz) || moderateProb || hasEarthCme || highSpeed) {
    status = 'Moderate';
    message = 'Possible across northern states under dark skies.';
    accentColor = AURORA_TIERS.moderate.color;
    if (isFavorableBz) reasons.push('Favorable Bz may enhance activity');
    if (hasEarthCme) reasons.push('Recent Earth-directed CME may increase chances');
    if (highSpeed && !isFavorableBz && solarWindSpeed) reasons.push(`Elevated solar wind speed (${Math.round(solarWindSpeed)} km/s) — watch for Bz to turn south`);
  } else if (kp >= 3 || isFavorableBz || significantFlare) {
    status = 'Low';
    message = 'Low probability across the northern US.';
    accentColor = AURORA_TIERS.quiet.color;
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
  { name: "Fairbanks",    state: "AK", lat: 64.84, lon: -147.72 },
  { name: "Seattle",      state: "WA", lat: 47.61, lon: -122.33 },
  { name: "Duluth",       state: "MN", lat: 46.79, lon: -92.10  },
  { name: "Marquette",    state: "MI", lat: 46.54, lon: -87.40  },
  { name: "Burlington",   state: "VT", lat: 44.48, lon: -73.21  },
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

// Shared nearest-cell lookup + Kp fallback + Bz boost.
// Accepts pre-filtered OvationPoint[]; empty array triggers the Kp fallback.
function resolveProb(
  lat: number,
  lon: number,
  points: OvationPoint[],
  kp: number | null,
  bz: number | null
): number {
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

/**
 * Returns tonight's aurora viewing probability (0–99) for each watch city.
 * Accepts pre-filtered OvationPoint[] (empty = no OVATION data → Kp fallback).
 */
export function getCityAuroraProbabilities(
  points: OvationPoint[],
  kp: number | null,
  bz: number | null
): CityAuroraProb[] {
  return AURORA_WATCH_CITIES.map((city) => ({
    name: city.name,
    state: city.state,
    prob: resolveProb(city.lat, city.lon, points, kp, bz),
  }));
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
 * Accepts pre-filtered OvationPoint[] (empty = no OVATION data → Kp fallback).
 */
export function getLocationAuroraProb(
  lat: number,
  lon: number,
  points: OvationPoint[],
  kp: number | null,
  bz: number | null
): number {
  return resolveProb(lat, lon, points, kp, bz);
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
    if (isNaN(d.getTime())) return dateStr;
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

/**
 * Maps a lat/lon pair to a plain-English location name.
 * Checks enclosed seas first, then land masses, then open-ocean buckets.
 * Returns "" when no region matches — callers should fall back to coordinates.
 */
export function approximateLocation(lat: number, lon: number): string {
  // Evaluation order matters:
  // 1. Enclosed seas — their bounding boxes overlap land-mass boxes (e.g. Gulf of Mexico ⊂ NA box)
  // 2. Greenland + NA — must precede the Arctic catch-all (Greenland reaches 83°N, N. Canada 85°N)
  // 3. Polar catch-alls
  // 4. Remaining land masses + open-ocean catch-alls

  // Enclosed / semi-enclosed seas
  // Black Sea must precede Mediterranean — its bbox (41–47°N, 27–42°E) is entirely
  // inside the Mediterranean bbox (30–47°N, -6–42°E), so it must be checked first.
  if (lat >= 41 && lat <= 47 && lon >= 27   && lon <= 42)  return "Black Sea";
  if (lat >= 30 && lat <= 47 && lon >= -6   && lon <= 42)  return "Mediterranean Sea";
  if (lat >= 22 && lat <= 32 && lon >= 32   && lon <= 45)  return "Red Sea";
  if (lat >= 22 && lat <= 30 && lon >= 47   && lon <= 57)  return "Persian Gulf";
  if (lat >= 50 && lat <= 65 && lon >= 155  && lon <= 192) return "Bering Sea";
  if (lat >= 18 && lat <= 31 && lon >= -98  && lon <= -80) return "Gulf of Mexico";
  if (lat >= 10 && lat <= 24 && lon >= -88  && lon <= -60) return "Caribbean Sea";
  if (lat >= -5 && lat <= 10 && lon >= -5   && lon <= 10)  return "Gulf of Guinea";

  // Greenland (extends to ~83°N; before Arctic catch-all and before NA lon range)
  if (lat >= 60 && lon >= -73 && lon <= -12) return "Greenland";

  // North America — before polar so high-lat Canada isn't swallowed by Arctic Ocean
  // Alaska / NW Canada band (-168→-130) not covered by the main check below
  if (lat >= 54  && lon >= -168 && lon <= -130) return "North America";
  // Contiguous US / Canada / Mexico — lat cap 85 covers northern Canada/Arctic islands
  if (lat >= 15  && lat <= 85  && lon >= -130 && lon <= -52) return "North America";

  // Polar catch-alls
  if (lat > 67)  return "Arctic Ocean";
  if (lat < -60) return "Southern Ocean";

  // Remaining land masses
  if (lat >= 7   && lat <  15  && lon >= -93  && lon <= -77) return "Central America";
  if (lat >= -56 && lat <  13  && lon >= -82  && lon <= -34) return "South America";
  if (lat >= 35  && lat <= 72  && lon >= -12  && lon <= 40)  return "Europe";
  if (lat >= -35 && lat <= 38  && lon >= -18  && lon <= 52)  return "Africa";
  if (lat >= 12  && lat <= 38  && lon >= 34   && lon <= 62)  return "Middle East";
  if (lat >= 5   && lat <= 50  && lon >= 60   && lon <= 92)  return "South Asia";
  if (lat >= 50  && lat <= 78  && lon >= 30   && lon <= 190) return "Russia / N. Asia";
  if (lat >= 18  && lat <  55  && lon >= 100  && lon <= 145) return "East Asia";
  if (lat >= -10 && lat <  25  && lon >= 95   && lon <= 155) return "SE Asia";
  if (lat >= -45 && lat <= -10 && lon >= 112  && lon <= 155) return "Australia";

  // Open oceans (catch-all)
  if (lon >= 120 || lon <= -75) return lat >= 0 ? "North Pacific Ocean" : "South Pacific Ocean";
  if (lon >= -75 && lon <= 25)  return lat >= 0 ? "North Atlantic Ocean" : "South Atlantic Ocean";
  if (lon >   25 && lon <  120) return "Indian Ocean";

  return "";
}
