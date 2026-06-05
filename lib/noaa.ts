// lib/noaa.ts
// Pure business logic, derived calculations, and data-processing utilities
// for AuroraWatch (Michigan-focused aurora + space weather).
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
  CmeSummary,
  Fireball,
  OvationResponse,
  SolarRegion,
  XrayFlare,
} from "./api/schemas";
import type { MeteorShower } from "./api/schemas";
import { MAJOR_METEOR_SHOWERS } from "./constants/meteors";

// Helper: get most recent value from time series (tolerant of optional time_tag after defensive schemas)
export function latest<T extends { time_tag?: string | null }>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[arr.length - 1];
}

/**
 * Plain-English aurora guidance for Michigan, incorporating Kp + OVATION prob + Bz.
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
    text = "High probability of aurora visible across much of Michigan, including Lower Peninsula under dark skies.";
  } else if (kp >= 5) {
    text = "Good chance in the Upper Peninsula; possible in northern Lower Peninsula with clear dark skies.";
  } else if (kp >= 4) {
    text = "Possible in the Upper Peninsula. Lower Peninsula unlikely unless skies are very dark and clear.";
  } else {
    text = "Low probability across Michigan. Best chances remain in the far northern Upper Peninsula.";
  }
  if (bz !== null && bz <= -5) {
    text += " Strong southward Bz currently boosting chances.";
  } else if (maxProb !== null && maxProb >= 20) {
    text += " Elevated probabilities across North America increase the odds.";
  }
  return text;
}

// Michigan-specific risk level for visibility (used by alerts UI + header badge).
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

// --- Solar Activity (pure functions only - fetchers moved to lib/api/fetchers.ts) ---

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
    message = 'Strong chance across much of the UP + possible in northern Lower Michigan.';
    accentColor = '#22c55e';
    if (strongFavorableBz) reasons.push('Strong southward Bz currently boosting chances');
    if (veryHighSpeed && solarWindSpeed) reasons.push(`Very high solar wind speed (${Math.round(solarWindSpeed)} km/s) amplifying activity`);
    if (highProb && !veryHighSpeed) reasons.push('Elevated OVATION probabilities across North America');
  } else if (kp >= 5 || (kp >= 4 && isFavorableBz) || (kp >= 4 && highSpeed) || (kp >= 3 && highSpeed && isFavorableBz) || highProb) {
    status = 'Good';
    message = 'Good chance in the Upper Peninsula.';
    accentColor = '#22c55e';
    if (isFavorableBz) reasons.push('Southward Bz currently favorable');
    if (highSpeed && solarWindSpeed) reasons.push(`Elevated solar wind speed (${Math.round(solarWindSpeed)} km/s) enhancing coupling`);
    if (highProb && !highSpeed) reasons.push('High aurora probabilities across NA');
  } else if (kp >= 4 || (kp >= 3 && isFavorableBz) || moderateProb || hasEarthCme || highSpeed) {
    status = 'Moderate';
    message = 'Possible in the Upper Peninsula under dark skies.';
    accentColor = '#eab308';
    if (isFavorableBz) reasons.push('Favorable Bz may enhance activity');
    if (hasEarthCme) reasons.push('Recent Earth-directed CME may increase chances');
    if (highSpeed && !isFavorableBz && solarWindSpeed) reasons.push(`Elevated solar wind speed (${Math.round(solarWindSpeed)} km/s) — watch for Bz to turn south`);
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

  const speedStr = solarWindSpeed !== null ? ` • ${Math.round(solarWindSpeed)} km/s` : '';
  const drivers = `Kp ${kp.toFixed(1)} • Bz ${bz !== null ? bz.toFixed(1) : '—'} nT${speedStr}`;

  return { status, message, reasons, accentColor, drivers };
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
    `Peak night(s): ${formatMeteorPeak(peakDate, shower)}\n\n${shower.description}\n\nExpected activity: ${shower.activityLevel}\n\nBest viewed after midnight from dark skies (Michigan UP ideal).`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&sf=true&output=xml`;
}

// Fireball display formatters (pure; types come from schemas).

export function formatFireballDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    // API dates are UTC; append Z for correct parsing
    const iso = dateStr.replace(" ", "T") + "Z";
    const d = new Date(iso);
    return (
      d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + " UTC"
    );
  } catch {
    return dateStr;
  }
}
export function formatFireballLocation(fb: Fireball): string {
  if (fb.lat == null || fb.lon == null) return "Location unavailable";
  return `${fb.lat}°${fb.latDir || ""} ${fb.lon}°${fb.lonDir || ""}`;
}
