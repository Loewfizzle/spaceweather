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

// ── Region rules ──────────────────────────────────────────────────────────────
//
// Each rule has an explicit `priority` field that encodes the evaluation tier:
//   1 — Bering Sea (antimeridian special case; must fire before any bbox lookup)
//   2 — Enclosed seas (before Greenland/NA so Gulf of Mexico, Caribbean, etc.
//       are not shadowed by the broad North America bbox)
//   3 — Greenland + North America (before the Arctic Ocean polar guard so
//       high-latitude land resolves to land rather than ocean)
//   4 — Arctic Ocean polar guard (lat > 67°N)
//   5 — Southern Ocean polar guard (lat < −60°S)
//   6 — Other landmasses (after polar guards so Arctic beats Europe/Russia)
//   7 — Open-ocean catch-alls (Pacific listed first so shared lon boundaries
//       resolve to Pacific rather than Atlantic/Indian)
//
// Within each priority tier, array order determines first-match precedence.

interface RegionRule {
  name: string;
  priority: number;
  match: (lat: number, lon: number) => boolean;
}

/** Inline bbox predicate — avoids repeating the comparison pattern. */
function bbox(minLat: number, maxLat: number, minLon: number, maxLon: number) {
  return (lat: number, lon: number) =>
    lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

const RULES: RegionRule[] = [
  // ── Priority 1: Bering Sea ───────────────────────────────────────────────────
  // Straddles the antimeridian; expressed as two half-strips rather than a single
  // bbox. Checked first so the Russia / N. Asia bbox (lon 30–190) cannot capture
  // the Russia side of the Bering Sea.
  { name: "Bering Sea", priority: 1, match: (lat, lon) => lat >= 50 && lat <= 65 && (lon >= 155 || lon <= -168) },

  // ── Priority 2: Enclosed seas ────────────────────────────────────────────────
  // Black Sea before Mediterranean — its bbox is entirely inside Mediterranean's.
  { name: "Black Sea",         priority: 2, match: bbox( 41,  47,  27,  42) },
  { name: "Mediterranean Sea", priority: 2, match: bbox( 30,  47,  -6,  42) },
  { name: "Red Sea",           priority: 2, match: bbox( 22,  32,  32,  45) },
  { name: "Persian Gulf",      priority: 2, match: bbox( 22,  30,  47,  57) },
  { name: "Gulf of Mexico",    priority: 2, match: bbox( 18,  31, -98, -80) },
  { name: "Caribbean Sea",     priority: 2, match: bbox( 10,  24, -88, -60) },
  { name: "Gulf of Guinea",    priority: 2, match: bbox( -5,  10,  -5,  10) },

  // ── Priority 3: Greenland + North America ─────────────────────────────────────
  // Checked before the Arctic Ocean guard so that high-latitude land — Greenland,
  // the Canadian Arctic Archipelago, northern Alaska — resolves to land not ocean.
  { name: "Greenland",     priority: 3, match: bbox( 60,  90,  -73,  -12) },
  { name: "North America", priority: 3, match: bbox( 54,  90, -168, -130) }, // Alaska band
  { name: "North America", priority: 3, match: bbox( 15,  85, -130,  -52) }, // main continent

  // ── Priority 4: Arctic Ocean polar guard ─────────────────────────────────────
  // Applied after tier 3 so Canadian Arctic / Greenland resolves to land; before
  // tier 6 so lat=70 lon=0 returns "Arctic Ocean" rather than "Europe".
  { name: "Arctic Ocean",   priority: 4, match: (lat) => lat > 67 },

  // ── Priority 5: Southern Ocean polar guard ────────────────────────────────────
  { name: "Southern Ocean", priority: 5, match: (lat) => lat < -60 },

  // ── Priority 6: Other landmasses ─────────────────────────────────────────────
  // After polar guards, so lat=68 lon=90 → "Arctic Ocean" (not "Russia / N. Asia").
  { name: "Central America",  priority: 6, match: bbox(  7,  15,  -93,  -77) },
  { name: "South America",    priority: 6, match: bbox(-56,  13,  -82,  -34) },
  { name: "Europe",           priority: 6, match: bbox( 35,  72,  -12,   40) },
  { name: "Africa",           priority: 6, match: bbox(-35,  38,  -18,   52) },
  { name: "Middle East",      priority: 6, match: bbox( 12,  38,   34,   62) },
  { name: "South Asia",       priority: 6, match: bbox(  5,  50,   60,   92) },
  { name: "Russia / N. Asia", priority: 6, match: bbox( 50,  78,   30,  190) },
  { name: "East Asia",        priority: 6, match: bbox( 18,  55,  100,  145) },
  { name: "SE Asia",          priority: 6, match: bbox(-10,  25,   95,  155) },
  { name: "Australia",        priority: 6, match: bbox(-45, -10,  112,  155) },

  // ── Priority 7: Open-ocean catch-alls ────────────────────────────────────────
  // Pacific listed before Atlantic/Indian so shared longitude boundaries
  // (lon=120, lon=−75) resolve to Pacific, matching the original evaluation order.
  { name: "North Pacific Ocean",  priority: 7, match: bbox(  0, 90,  120,  180) },
  { name: "North Pacific Ocean",  priority: 7, match: bbox(  0, 90, -180,  -75) },
  { name: "South Pacific Ocean",  priority: 7, match: bbox(-90,  0,  120,  180) },
  { name: "South Pacific Ocean",  priority: 7, match: bbox(-90,  0, -180,  -75) },
  { name: "North Atlantic Ocean", priority: 7, match: bbox(  0, 90,  -75,   25) },
  { name: "South Atlantic Ocean", priority: 7, match: bbox(-90,  0,  -75,   25) },
  { name: "Indian Ocean",         priority: 7, match: bbox(-90, 90,   25,  120) },
];

/**
 * Maps a lat/lon pair to a plain-English location name.
 *
 * Iterates RULES in array order (rules are pre-sorted by ascending priority,
 * with ties broken by array position). Returns "" when no rule matches —
 * callers should fall back to coordinates.
 */
export function approximateLocation(lat: number, lon: number): string {
  for (const rule of RULES) {
    if (rule.match(lat, lon)) return rule.name;
  }
  // The catch-all ocean rules cover every lat/lon; this path is unreachable.
  /* v8 ignore next 2 */
  return "";
}
