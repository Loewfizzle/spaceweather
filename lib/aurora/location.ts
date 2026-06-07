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

interface RegionEntry {
  name: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Geographic regions grouped into four named evaluation tiers.
 *
 * ENCLOSED_SEAS (tier 1)
 *   Checked before Greenland / North America so the Gulf of Mexico, Caribbean Sea, etc.
 *   are not shadowed by the broad North America bbox. Within this tier, array order matters:
 *   Black Sea must precede Mediterranean because its bbox is entirely contained within it.
 *
 * GREENLAND_AND_NORTH_AMERICA (tier 2)
 *   Checked before the Arctic Ocean polar guard so that high-latitude land — Greenland,
 *   the Canadian Arctic Archipelago, northern Alaska — resolves to land rather than ocean.
 *
 * OTHER_LANDMASSES (tier 3)
 *   Checked after the polar guards, so lat=70 lon=0 returns "Arctic Ocean" (the guard fires
 *   first) rather than "Europe", and lat=68 lon=90 returns "Arctic Ocean" rather than
 *   "Russia / N. Asia".
 *
 * OPEN_OCEAN (tier 4)
 *   Catch-alls covering the remaining ocean surface. Pacific rules are listed before
 *   Atlantic/Indian so that shared longitude boundaries (lon=120, lon=−75) resolve to
 *   Pacific, matching the original evaluation order.
 */
const REGIONS: {
  ENCLOSED_SEAS: RegionEntry[];
  GREENLAND_AND_NORTH_AMERICA: RegionEntry[];
  OTHER_LANDMASSES: RegionEntry[];
  OPEN_OCEAN: RegionEntry[];
} = {
  ENCLOSED_SEAS: [
    // Black Sea before Mediterranean — its bbox is entirely inside Mediterranean's
    { name: "Black Sea",         minLat:  41, maxLat:  47, minLon:  27, maxLon:  42 },
    { name: "Mediterranean Sea", minLat:  30, maxLat:  47, minLon:  -6, maxLon:  42 },
    { name: "Red Sea",           minLat:  22, maxLat:  32, minLon:  32, maxLon:  45 },
    { name: "Persian Gulf",      minLat:  22, maxLat:  30, minLon:  47, maxLon:  57 },
    { name: "Gulf of Mexico",    minLat:  18, maxLat:  31, minLon: -98, maxLon: -80 },
    { name: "Caribbean Sea",     minLat:  10, maxLat:  24, minLon: -88, maxLon: -60 },
    { name: "Gulf of Guinea",    minLat:  -5, maxLat:  10, minLon:  -5, maxLon:  10 },
  ],

  GREENLAND_AND_NORTH_AMERICA: [
    { name: "Greenland",     minLat:  60, maxLat:  90, minLon:  -73, maxLon:  -12 },
    { name: "North America", minLat:  54, maxLat:  90, minLon: -168, maxLon: -130 }, // Alaska band
    { name: "North America", minLat:  15, maxLat:  85, minLon: -130, maxLon:  -52 }, // main continent
  ],

  OTHER_LANDMASSES: [
    { name: "Central America",  minLat:   7, maxLat:  15, minLon:  -93, maxLon:  -77 },
    { name: "South America",    minLat: -56, maxLat:  13, minLon:  -82, maxLon:  -34 },
    { name: "Europe",           minLat:  35, maxLat:  72, minLon:  -12, maxLon:   40 },
    { name: "Africa",           minLat: -35, maxLat:  38, minLon:  -18, maxLon:   52 },
    { name: "Middle East",      minLat:  12, maxLat:  38, minLon:   34, maxLon:   62 },
    { name: "South Asia",       minLat:   5, maxLat:  50, minLon:   60, maxLon:   92 },
    { name: "Russia / N. Asia", minLat:  50, maxLat:  78, minLon:   30, maxLon:  190 },
    { name: "East Asia",        minLat:  18, maxLat:  55, minLon:  100, maxLon:  145 },
    { name: "SE Asia",          minLat: -10, maxLat:  25, minLon:   95, maxLon:  155 },
    { name: "Australia",        minLat: -45, maxLat: -10, minLon:  112, maxLon:  155 },
  ],

  OPEN_OCEAN: [
    // Pacific before Atlantic/Indian so shared lon boundaries resolve to Pacific
    { name: "North Pacific Ocean",  minLat:   0, maxLat:  90, minLon:  120, maxLon:  180 },
    { name: "North Pacific Ocean",  minLat:   0, maxLat:  90, minLon: -180, maxLon:  -75 },
    { name: "South Pacific Ocean",  minLat: -90, maxLat:   0, minLon:  120, maxLon:  180 },
    { name: "South Pacific Ocean",  minLat: -90, maxLat:   0, minLon: -180, maxLon:  -75 },
    { name: "North Atlantic Ocean", minLat:   0, maxLat:  90, minLon:  -75, maxLon:   25 },
    { name: "South Atlantic Ocean", minLat: -90, maxLat:   0, minLon:  -75, maxLon:   25 },
    { name: "Indian Ocean",         minLat: -90, maxLat:  90, minLon:   25, maxLon:  120 },
  ],
};

// ── Special-case predicates ───────────────────────────────────────────────────
// These three regions cannot be expressed as a single bounding box or have
// evaluation-order requirements that place them outside the normal tier system.

/**
 * The Bering Sea straddles the antimeridian and cannot be expressed as a single bbox.
 * Must be checked before any REGIONS lookup because the Russia / N. Asia bbox (lon 30–190)
 * would otherwise capture the Russia side of the Bering Sea first.
 */
function isBeringSeaCoord(lat: number, lon: number): boolean {
  return lat >= 50 && lat <= 65 && (lon >= 155 || lon <= -168);
}

/**
 * Arctic Ocean polar guard. Applied after GREENLAND_AND_NORTH_AMERICA (tier 2) so that
 * the Canadian Arctic Archipelago and Greenland resolve to land rather than ocean,
 * but before OTHER_LANDMASSES (tier 3) so that lat=70 lon=0 returns "Arctic Ocean"
 * rather than "Europe".
 */
function isArcticOcean(lat: number): boolean {
  return lat > 67;
}

/**
 * Southern Ocean polar guard. Applied alongside isArcticOcean so that no tier-3
 * land-mass bbox can claim a point at lat < −60°.
 */
function isSouthernOcean(lat: number): boolean {
  return lat < -60;
}

/** Returns the first rule in `rules` whose bbox contains (lat, lon), or null. */
function findFirst(rules: RegionEntry[], lat: number, lon: number): RegionEntry | null {
  for (const rule of rules) {
    if (lat >= rule.minLat && lat <= rule.maxLat && lon >= rule.minLon && lon <= rule.maxLon) {
      return rule;
    }
  }
  return null;
}

/**
 * Maps a lat/lon pair to a plain-English location name.
 *
 * Evaluation order — each step takes precedence over all later steps:
 *
 *   1. Bering Sea — antimeridian special case; must precede all bbox lookups
 *      because Russia / N. Asia (lon 30–190) would capture the Russia side first.
 *   2. Enclosed seas (REGIONS.ENCLOSED_SEAS) — before Greenland / North America
 *      so the Gulf of Mexico, Caribbean Sea, etc. are not shadowed by the broad NA bbox.
 *   3. Greenland + North America (REGIONS.GREENLAND_AND_NORTH_AMERICA) — before the
 *      Arctic Ocean polar guard so high-latitude land resolves to land, not ocean.
 *   4. Arctic Ocean polar guard (lat > 67°N).
 *   5. Southern Ocean polar guard (lat < −60°S).
 *   6. Other land masses (REGIONS.OTHER_LANDMASSES) — after polar guards so "Arctic Ocean"
 *      beats "Europe" at lat=70 and "Russia / N. Asia" at lat=68 lon=90.
 *   7. Open-ocean catch-alls (REGIONS.OPEN_OCEAN) — Pacific listed before Atlantic/Indian
 *      so shared longitude boundaries resolve to Pacific.
 *
 * Returns "" when no region matches — callers should fall back to coordinates.
 */
export function approximateLocation(lat: number, lon: number): string {
  // 1. Bering Sea — antimeridian special case, before all bbox lookups
  if (isBeringSeaCoord(lat, lon)) return "Bering Sea";

  // 2. Enclosed seas — before Greenland / North America so the Gulf of Mexico,
  //    Caribbean Sea, etc. are not shadowed by the broad NA bbox
  const seaMatch = findFirst(REGIONS.ENCLOSED_SEAS, lat, lon);
  if (seaMatch) return seaMatch.name;

  // 3. Greenland + North America — before the Arctic Ocean polar guard so
  //    the Canadian Arctic Archipelago and Greenland resolve to land, not ocean
  const naMatch = findFirst(REGIONS.GREENLAND_AND_NORTH_AMERICA, lat, lon);
  if (naMatch) return naMatch.name;

  // 4–5. Polar guards — between tier-2 and tier-3 land masses so that
  //      lat=70 lon=0 → "Arctic Ocean" (not "Europe"), and
  //      lat=68 lon=90 → "Arctic Ocean" (not "Russia / N. Asia")
  if (isArcticOcean(lat))   return "Arctic Ocean";
  if (isSouthernOcean(lat)) return "Southern Ocean";

  // 6. Other land masses — first match in array order wins within this tier
  const landMatch = findFirst(REGIONS.OTHER_LANDMASSES, lat, lon);
  if (landMatch) return landMatch.name;

  // 7. Open-ocean catch-alls — Pacific listed first so lon=120 and lon=−75
  //    resolve to Pacific rather than Atlantic/Indian
  const oceanMatch = findFirst(REGIONS.OPEN_OCEAN, lat, lon);
  return oceanMatch?.name ?? "";
}
