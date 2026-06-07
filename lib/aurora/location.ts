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

/**
 * Maps a lat/lon pair to a plain-English location name.
 * Checks enclosed seas first, then land masses, then open-ocean buckets.
 * Returns "" when no region matches — callers should fall back to coordinates.
 */
export function approximateLocation(lat: number, lon: number): string {
  // Evaluation order matters:
  // 1. Enclosed seas — their bounding boxes overlap land-mass boxes
  // 2. Greenland + NA — must precede the Arctic catch-all
  // 3. Polar catch-alls
  // 4. Remaining land masses + open-ocean catch-alls

  // Black Sea must precede Mediterranean — its bbox is entirely inside the Mediterranean bbox.
  if (lat >= 41 && lat <= 47 && lon >= 27   && lon <= 42)  return "Black Sea";
  if (lat >= 30 && lat <= 47 && lon >= -6   && lon <= 42)  return "Mediterranean Sea";
  if (lat >= 22 && lat <= 32 && lon >= 32   && lon <= 45)  return "Red Sea";
  if (lat >= 22 && lat <= 30 && lon >= 47   && lon <= 57)  return "Persian Gulf";
  if (lat >= 50 && lat <= 65 && lon >= 155  && lon <= 192) return "Bering Sea";
  if (lat >= 18 && lat <= 31 && lon >= -98  && lon <= -80) return "Gulf of Mexico";
  if (lat >= 10 && lat <= 24 && lon >= -88  && lon <= -60) return "Caribbean Sea";
  if (lat >= -5 && lat <= 10 && lon >= -5   && lon <= 10)  return "Gulf of Guinea";

  if (lat >= 60 && lon >= -73 && lon <= -12) return "Greenland";

  if (lat >= 54  && lon >= -168 && lon <= -130) return "North America";
  if (lat >= 15  && lat <= 85  && lon >= -130 && lon <= -52) return "North America";

  if (lat > 67)  return "Arctic Ocean";
  if (lat < -60) return "Southern Ocean";

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

  if (lon >= 120 || lon <= -75) return lat >= 0 ? "North Pacific Ocean" : "South Pacific Ocean";
  if (lon >= -75 && lon <= 25)  return lat >= 0 ? "North Atlantic Ocean" : "South Atlantic Ocean";
  if (lon >   25 && lon <  120) return "Indian Ocean";

  return "";
}
