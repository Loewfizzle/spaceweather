// lib/noaa.ts
// Types and fetchers for NOAA SWPC public JSON data
// All endpoints are public and suitable for client-side fetching with caching via TanStack Query

// Types re-exported from the central Zod schemas layer (lib/api/schemas.ts)
// for backward compat during migration. Prefer importing directly from lib/api/schemas in new code.
import type {
  OvationResponse,
  KpEntry,
  PlasmaEntry,
  MagEntry,
  XrayFlare,
  Alert,
  SolarRegion,
  CloudCoverData,
  Fireball,
  CmeSummary,
} from "./api/schemas";

export type {
  OvationResponse,
  KpEntry,
  PlasmaEntry,
  MagEntry,
  XrayFlare,
  Alert,
  SolarRegion,
  CloudCoverData,
  Fireball,
  CmeSummary,
} from "./api/schemas";

// NOTE: All fetchers have been moved to lib/api/fetchers.ts (Step 1)
// This file now focuses on pure utilities, business logic, and re-exports for backward compatibility.
// All new code should import from lib/api/ or lib/hooks/.

export { 
  fetchOvation,
  fetchKpIndex,
  fetchPlasma,
  fetchMag,
  fetchXrayFlaresLatest,
  fetchAlerts,
  fetchSolarRegions,
  fetchCloudCover,
  fetchFireballs,
} from "./api/fetchers";

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

// --- Solar Activity (pure functions only - fetchers moved to lib/api/fetchers.ts) ---

/** Parse recent Earth-directed or relevant CMEs from alerts messages (lightweight extraction). */
export function parseRecentCmes(alerts: import("./api/schemas").Alert[] | undefined): import("./api/schemas").CmeSummary[] {
  // Implementation kept here for now (pure logic)
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

/** Compute total sunspot number from latest reported regions. */
export function currentSunspotNumber(regions: import("./api/schemas").SolarRegion[] | undefined): number | null {
  if (!regions || regions.length === 0) return null;
  const valid = regions.filter((r) => r.Obsdate && typeof r.Numspot === "number");
  if (valid.length === 0) return null;
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

// Sky / Meteor pure logic re-exported from api/fetchers where applicable.
// The hardcoded meteor data and pure functions stay here for now.

// --- Meteor Showers (hardcoded annual major showers) ---

export interface MeteorShower {
  name: string;
  peakMonth: number; // 1-12
  peakDay: number;
  peakEndMonth?: number;
  peakEndDay?: number;
  description: string;
  activityLevel: string;
}

import { MAJOR_METEOR_SHOWERS } from "./constants/meteors";

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

// --- Fireball Tracker types moved to lib/api/schemas.ts ---
// (re-exported below)


// fetchFireballs is now exclusively in lib/api/fetchers.ts (uses the /api/fireballs proxy)

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
