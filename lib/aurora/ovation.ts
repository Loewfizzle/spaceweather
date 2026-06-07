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

// Probability display tiers — used by getProbTier, getAuroraColor, and city/location rows.
// Prob cutoffs: quiet <15% · low 15–34% · moderate 35–59% · high ≥60%
export const PROB_TIERS = {
  quiet:    { color: '#64748b', label: 'Quiet'    },  // <15%  — gray
  low:      { color: '#22c55e', label: 'Low'      },  // 15–34% — green
  moderate: { color: '#eab308', label: 'Moderate' },  // 35–59% — yellow
  high:     { color: '#a78bfa', label: 'High'     },  // ≥60%  — violet
} as const;

export type ProbTier = keyof typeof PROB_TIERS;

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
    const lat    = row[1];
    const prob   = row[2];

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
  return 4.5;
}
