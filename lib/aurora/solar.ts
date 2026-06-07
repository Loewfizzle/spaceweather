import type { Alert, CmeSummary, SolarRegion } from "../api/schemas";

// NOAA geomagnetic storm watch product IDs — issued specifically when Earth-directed CMEs
// are detected and projected to impact Earth. More reliable as a primary signal than
// body-text regex alone, which can break if NOAA changes alert wording.
// G1=WATA07, G2=WATA20, G3=WATA30, G4=WATA40, G5=WATA50
const STORM_WATCH_IDS = new Set(['WATA07', 'WATA20', 'WATA30', 'WATA40', 'WATA50']);

/** Parse recent Earth-directed or relevant CMEs from NOAA alerts. */
export function parseRecentCmes(alerts: Alert[] | undefined): CmeSummary[] {
  if (!alerts || alerts.length === 0) return [];

  const stormWatches = alerts.filter((a) => STORM_WATCH_IDS.has(a.product_id));
  const cmeBodyAlerts = alerts.filter(
    (a) => !STORM_WATCH_IDS.has(a.product_id) && /CME|Coronal Mass Ejection/i.test(a.message)
  );

  const candidates = [...stormWatches, ...cmeBodyAlerts].slice(0, 2);

  return candidates.map((a) => {
    const msg = a.message;
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

export type CmeImpactLevel = "likely" | "glancing" | "possible" | "none";

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
  const fresh = recentCmes.filter((c) => {
    const t = new Date(c.time).getTime();
    return isFinite(t) && Date.now() - t < 1000 * 60 * 60 * 24 * 5;
  });

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

  const glancing = fresh.find((c) => c.earthImpact === "Glancing impact possible");
  if (glancing) {
    const speedStr = glancing.speed ? ` (${glancing.speed.toLocaleString()} km/s)` : "";
    return {
      level: "glancing",
      headline: "Glancing CME impact possible",
      detail: `A glancing blow from a CME${speedStr} may arrive in 1–3 days. Partial aurora enhancement is possible, particularly at higher latitudes.`,
      cme: glancing,
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
