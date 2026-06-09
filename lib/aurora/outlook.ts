import type { CmeSummary, XrayFlare } from "../api/schemas";
import type { OvationPoint } from "./ovation";
import { AURORA_TIERS } from "./kp";

export interface CityAuroraProb {
  name: string;
  state: string;
  prob: number;
}

export interface TonightOutlook {
  status: 'Excellent' | 'Good' | 'Moderate' | 'Low' | 'Very low' | 'Loading';
  message: string;
  reasons: string[];
  accentColor: string;
  drivers?: string;
  cityProbs?: CityAuroraProb[];
}

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
      const dLat = p.lat - lat;
      const dLonRaw = p.lon - lon;
      const dLon = Math.abs(dLonRaw) > 180 ? 360 - Math.abs(dLonRaw) : dLonRaw;
      const d = dLat ** 2 + dLon ** 2;
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
 * Compute aurora probability for an arbitrary user-provided lat/lon.
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

/**
 * Compute a realistic outlook for tonight based on current conditions.
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

  const isFavorableBz   = bz !== null && bz <= -5;
  const strongFavorableBz = bz !== null && bz <= -10;
  const highProb        = maxAuroraProbNA !== null && maxAuroraProbNA >= 20;
  const moderateProb    = maxAuroraProbNA !== null && maxAuroraProbNA >= 10;
  const highSpeed       = solarWindSpeed !== null && solarWindSpeed > 600;
  const veryHighSpeed   = solarWindSpeed !== null && solarWindSpeed > 700;

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
    message = 'Strong aurora activity expected across the northern US, with a good chance extending well south of typical viewing areas.';
    accentColor = AURORA_TIERS.storm.color;
    if (strongFavorableBz) reasons.push('Strong southward Bz currently boosting chances');
    if (veryHighSpeed && solarWindSpeed) reasons.push(`Very high solar wind speed (${Math.round(solarWindSpeed)} km/s) amplifying activity`);
    if (highProb && !veryHighSpeed) reasons.push('Elevated OVATION probabilities across North America');
  } else if (kp >= 5 || (kp >= 4 && isFavorableBz) || (kp >= 4 && highSpeed) || (kp >= 3 && highSpeed && isFavorableBz) || highProb) {
    status = 'Good';
    message = 'Good chance tonight for northern-tier states — best visibility under dark skies away from city lights.';
    accentColor = AURORA_TIERS.strong.color;
    if (isFavorableBz) reasons.push('Southward Bz currently favorable');
    if (highSpeed && solarWindSpeed) reasons.push(`Elevated solar wind speed (${Math.round(solarWindSpeed)} km/s) enhancing coupling`);
    if (highProb && !highSpeed) reasons.push('High aurora probabilities across NA');
  } else if (kp >= 4 || (kp >= 3 && isFavorableBz) || moderateProb || hasEarthCme || highSpeed) {
    status = 'Moderate';
    message = 'Possible across northern states under dark skies.';
    accentColor = AURORA_TIERS.active.color;
    if (isFavorableBz) reasons.push('Favorable Bz may enhance activity');
    if (hasEarthCme) reasons.push('Recent Earth-directed CME may increase chances');
    if (highSpeed && !isFavorableBz && solarWindSpeed) reasons.push(`Elevated solar wind speed (${Math.round(solarWindSpeed)} km/s) — watch for Bz to turn south`);
  } else if (kp >= 3 || isFavorableBz || significantFlare) {
    status = 'Low';
    message = 'Low probability across the northern US.';
    accentColor = AURORA_TIERS.moderate.color;
    if (isFavorableBz) reasons.push('Southward Bz provides some opportunity');
  } else {
    status = 'Very low';
    message = 'Very low chance tonight.';
    accentColor = '#64748b';
  }

  if (reasons.length < 2 && kp >= 4) reasons.push(`Current Kp ${kp.toFixed(1)} supports activity`);
  if (reasons.length < 2 && significantFlare) reasons.push('Recent significant flare may contribute');

  reasons = reasons.slice(0, 2);

  const speedStr = solarWindSpeed !== null ? ` • ${Math.round(solarWindSpeed)} km/s` : '';
  const drivers = `Kp ${kp.toFixed(1)} • Bz ${bz !== null ? bz.toFixed(1) : '—'} nT${speedStr}`;

  return { status, message, reasons, accentColor, drivers };
}

/**
 * Personalise the HeroOutlook result for a user who has set their location.
 * Primary signal is userLocationProb (OVATION probability at their lat/lon).
 * peakKp + userLat drive messaging when probability is low.
 * cloudCoverPct adds a note when significant cover is forecast.
 */
export function getPersonalizedOutlook(
  base: TonightOutlook,
  userLocationProb: number,
  userLat: number,
  locationLabel: string | null,
  peakKp: number | null,
  cloudCoverPct: number | null,
): TonightOutlook {
  const name = locationLabel ?? 'your location';

  // Boundary latitude for forecast Kp — aurora oval equatorward edge.
  const tooFarSouth = peakKp !== null && userLat < (72 - peakKp * 4);

  const cloudNote =
    cloudCoverPct !== null && cloudCoverPct >= 70
      ? ' Thick cloud cover will likely prevent any visual sighting tonight.'
      : cloudCoverPct !== null && cloudCoverPct >= 40
      ? ' Partial clouds may interfere with viewing tonight.'
      : '';

  let status: TonightOutlook['status'];
  let message: string;
  let accentColor: string;

  if (userLocationProb >= 35) {
    status = 'Excellent';
    accentColor = AURORA_TIERS.storm.color;
    message = `Strong aurora signal directly overhead in ${name} — conditions at your latitude are as good as it gets tonight.${cloudNote}`;
  } else if (userLocationProb >= 15) {
    status = 'Good';
    accentColor = AURORA_TIERS.strong.color;
    message = `Good chance overhead in ${name} tonight — real activity is reaching your latitude.${cloudNote}`;
  } else if (userLocationProb >= 6) {
    status = 'Moderate';
    accentColor = AURORA_TIERS.active.color;
    message = `Some aurora activity reaching ${name} tonight — dark skies will make a real difference.${cloudNote}`;
  } else if (userLocationProb >= 2) {
    status = 'Low';
    accentColor = AURORA_TIERS.moderate.color;
    message = tooFarSouth && peakKp !== null
      ? `Aurora unlikely to reach ${name} tonight — forecast Kp ${peakKp.toFixed(1)} keeps the oval to your north.${cloudNote}`
      : `Faint aurora possible at ${name} tonight, though conditions are marginal for your latitude.${cloudNote}`;
  } else {
    status = 'Very low';
    accentColor = '#64748b';
    message = tooFarSouth && peakKp !== null
      ? `Aurora unlikely to reach ${name} tonight — forecast Kp ${peakKp.toFixed(1)} keeps the oval well to your north.${cloudNote}`
      : `No meaningful aurora expected at ${name} under current conditions.${cloudNote}`;
  }

  return { ...base, status, message, accentColor, reasons: [] };
}
