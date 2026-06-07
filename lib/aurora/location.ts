import { US_CITIES } from "../constants/usCities";

/**
 * Returns the name of the nearest US city to a given lat/lon.
 */
export function getNearestCityName(lat: number, lon: number): string {
  let best: (typeof US_CITIES)[number] = US_CITIES[0];
  let bestDist = Infinity;
  for (const city of US_CITIES) {
    const dLat = city.lat - lat;
    const dLonRaw = city.lon - lon;
    const dLon = Math.abs(dLonRaw) > 180 ? 360 - Math.abs(dLonRaw) : dLonRaw;
    const d = dLat ** 2 + dLon ** 2;
    if (d < bestDist) { bestDist = d; best = city; }
  }
  return `${best.name}, ${best.state}`;
}

interface RegionRule {
  name: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  /**
   * 1 = enclosed seas
   * 2 = Greenland + North America (must beat Arctic Ocean imperative)
   * 3 = other land masses (checked after Arctic/Southern Ocean imperatives)
   * 4 = open-ocean catch-alls
   */
  priority: number;
}

const REGION_RULES: RegionRule[] = [
  // ── Priority 1: Enclosed seas ──────────────────────────────────────────────
  // Black Sea must precede Mediterranean — its bbox is entirely inside Mediterranean's
  { name: "Black Sea",          minLat:  41, maxLat:  47, minLon:  27, maxLon:  42, priority: 1 },
  { name: "Mediterranean Sea",  minLat:  30, maxLat:  47, minLon:  -6, maxLon:  42, priority: 1 },
  { name: "Red Sea",            minLat:  22, maxLat:  32, minLon:  32, maxLon:  45, priority: 1 },
  { name: "Persian Gulf",       minLat:  22, maxLat:  30, minLon:  47, maxLon:  57, priority: 1 },
  { name: "Gulf of Mexico",     minLat:  18, maxLat:  31, minLon: -98, maxLon: -80, priority: 1 },
  { name: "Caribbean Sea",      minLat:  10, maxLat:  24, minLon: -88, maxLon: -60, priority: 1 },
  { name: "Gulf of Guinea",     minLat:  -5, maxLat:  10, minLon:  -5, maxLon:  10, priority: 1 },

  // ── Priority 2: Greenland + North America ──────────────────────────────────
  // Priority 2 rules are returned before the Arctic Ocean imperative (lat > 67),
  // so high-latitude NA and Greenland points resolve to land rather than ocean.
  { name: "Greenland",          minLat:  60, maxLat:  90, minLon: -73, maxLon: -12, priority: 2 },
  { name: "North America",      minLat:  54, maxLat:  90, minLon: -168, maxLon: -130, priority: 2 },
  { name: "North America",      minLat:  15, maxLat:  85, minLon: -130, maxLon:  -52, priority: 2 },

  // ── Priority 3: Other land masses ─────────────────────────────────────────
  // Checked after Arctic/Southern Ocean imperative guards so that, e.g.,
  // lat=70 lon=0 returns "Arctic Ocean" rather than "Europe",
  // and lat=68 lon=90 returns "Arctic Ocean" rather than "Russia / N. Asia".
  { name: "Central America",    minLat:   7, maxLat:  15, minLon:  -93, maxLon:  -77, priority: 3 },
  { name: "South America",      minLat: -56, maxLat:  13, minLon:  -82, maxLon:  -34, priority: 3 },
  { name: "Europe",             minLat:  35, maxLat:  72, minLon:  -12, maxLon:   40, priority: 3 },
  { name: "Africa",             minLat: -35, maxLat:  38, minLon:  -18, maxLon:   52, priority: 3 },
  { name: "Middle East",        minLat:  12, maxLat:  38, minLon:   34, maxLon:   62, priority: 3 },
  { name: "South Asia",         minLat:   5, maxLat:  50, minLon:   60, maxLon:   92, priority: 3 },
  { name: "Russia / N. Asia",   minLat:  50, maxLat:  78, minLon:   30, maxLon:  190, priority: 3 },
  { name: "East Asia",          minLat:  18, maxLat:  55, minLon:  100, maxLon:  145, priority: 3 },
  { name: "SE Asia",            minLat: -10, maxLat:  25, minLon:   95, maxLon:  155, priority: 3 },
  { name: "Australia",          minLat: -45, maxLat: -10, minLon:  112, maxLon:  155, priority: 3 },

  // ── Priority 4: Open-ocean catch-alls ─────────────────────────────────────
  // Pacific rules precede Atlantic/Indian so that shared lon boundaries
  // (lon=-75 and lon=120) resolve to Pacific — matching the original order.
  { name: "North Pacific Ocean", minLat:   0, maxLat:  90, minLon: 120, maxLon:  180, priority: 4 },
  { name: "North Pacific Ocean", minLat:   0, maxLat:  90, minLon: -180, maxLon:  -75, priority: 4 },
  { name: "South Pacific Ocean", minLat: -90, maxLat:   0, minLon: 120, maxLon:  180, priority: 4 },
  { name: "South Pacific Ocean", minLat: -90, maxLat:   0, minLon: -180, maxLon:  -75, priority: 4 },
  { name: "North Atlantic Ocean", minLat:   0, maxLat:  90, minLon:  -75, maxLon:   25, priority: 4 },
  { name: "South Atlantic Ocean", minLat: -90, maxLat:   0, minLon:  -75, maxLon:   25, priority: 4 },
  { name: "Indian Ocean",         minLat: -90, maxLat:  90, minLon:   25, maxLon:  120, priority: 4 },
];

/**
 * Maps a lat/lon pair to a plain-English location name.
 *
 * Evaluation order:
 *   1. Bering Sea (imperative — straddles the antimeridian, no single bbox)
 *   2. REGION_RULES priority 1–2 (enclosed seas · Greenland · North America)
 *   3. Arctic Ocean / Southern Ocean (imperative — after priority-2 land rules
 *      so high-latitude NA and Greenland are caught first, but before priority-3
 *      land rules so Arctic beats Europe/Russia at lat > 67)
 *   4. REGION_RULES priority 3–4 (other land masses · open ocean)
 *
 * Returns "" when no region matches — callers should fall back to coordinates.
 */
export function approximateLocation(lat: number, lon: number): string {
  // Bering Sea straddles the antimeridian — must be checked before REGION_RULES
  // because Russia / N. Asia (lon 30–190) would otherwise capture the Russia side
  if (lat >= 50 && lat <= 65 && (lon >= 155 || lon <= -168)) return "Bering Sea";

  // Scan all rules; track the one with the lowest priority number.
  // Ties at equal priority resolve by array order (first match wins — stable).
  let best: RegionRule | null = null;
  for (const rule of REGION_RULES) {
    if (
      lat >= rule.minLat && lat <= rule.maxLat &&
      lon >= rule.minLon && lon <= rule.maxLon
    ) {
      if (best === null || rule.priority < best.priority) best = rule;
    }
  }

  // Return priority-1/2 winners immediately — before the polar imperatives —
  // so Greenland and high-latitude North America are never mislabelled Arctic Ocean
  if (best !== null && best.priority <= 2) return best.name;

  // Polar catch-alls: between priority-2 and priority-3 matches so that
  // lat=70 lon=0 is "Arctic Ocean", not "Europe"
  if (lat > 67)  return "Arctic Ocean";
  if (lat < -60) return "Southern Ocean";

  // Return the best priority-3/4 match (other land masses, open ocean)
  return best?.name ?? "";
}
