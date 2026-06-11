import { z } from "zod";
import type { Alert, CmeSummary, DonkiCme, SolarRegion } from "../api/schemas";
import { normalizeTimeTag } from "../utils/viewingWindow";

// Raw shape returned by NASA DONKI CMEAnalysis endpoint — intentionally permissive.
const DonkiCmeRawSchema = z.object({
  time21_5: z.string().nullable().optional(),
  speed: z.number().nullable().optional(),
  halfAngle: z.number().nullable().optional(),
  type: z.string().nullable().optional(),
  isMostAccurate: z.boolean().nullable().optional(),
  note: z.string().nullable().optional(),
  predictedEarthImpactTime: z.string().nullable().optional(),
  kpIndex18: z.number().nullable().optional(),
  catalog: z.string().nullable().optional(),
  associatedCMEID: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
});

/** Fetch Earth-directed CME predictions from NASA DONKI (last 3 days). */
/* v8 ignore start */
export async function fetchDonkiCmeDetails(signal?: AbortSignal): Promise<DonkiCme[]> {
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const today = new Date();
  const startDate = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    startDate: fmt(startDate),
    endDate: fmt(today),
    mostAccurateOnly: 'true',
    speed: '0',
    halfAngle: '0',
  });
  const url = `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/CMEAnalysis?${params}`;
  const res = await fetch(url, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`DONKI CMEAnalysis: ${res.status}`);
  const raw = await res.json();
  const result = z.array(DonkiCmeRawSchema).safeParse(raw);
  if (!result.success) return [];
  return result.data
    .filter((item) => item.isMostAccurate === true && item.predictedEarthImpactTime != null)
    .map((item) => ({
      speed: item.speed ?? null,
      arrivalTime: item.predictedEarthImpactTime!,
      kpIndex: item.kpIndex18 ?? null,
      note: item.note ?? '',
    }));
}
/* v8 ignore stop */

// NOAA geomagnetic storm watch product IDs — issued specifically when Earth-directed CMEs
// are detected and projected to impact Earth. More reliable as a primary signal than
// body-text regex alone, which can break if NOAA changes alert wording.
// G1=WATA07, G2=WATA20, G3=WATA30, G4=WATA40, G5=WATA50
const STORM_WATCH_IDS = new Set(['WATA07', 'WATA20', 'WATA30', 'WATA40', 'WATA50']);

const STORM_WATCH_LEVEL: Record<string, string> = {
  WATA07: 'G1', WATA20: 'G2', WATA30: 'G3', WATA40: 'G4', WATA50: 'G5',
};

/** Parse recent Earth-directed or relevant CMEs from NOAA alerts. */
export function parseRecentCmes(alerts: Alert[] | undefined): CmeSummary[] {
  if (!alerts || alerts.length === 0) return [];

  const stormWatches = alerts.filter((a) => STORM_WATCH_IDS.has(a.product_id));
  const cmeBodyAlerts = alerts.filter(
    (a) => !STORM_WATCH_IDS.has(a.product_id) && /CME|Coronal Mass Ejection/i.test(a.message)
  );

  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
  const candidates = [...stormWatches, ...cmeBodyAlerts]
    .filter((a) => {
      const raw = a.issue_datetime.trim().replace(' ', 'T');
      const withTz = /[Z+-]\d*$/.test(raw) ? raw : raw + 'Z';
      const t = Date.parse(withTz);
      return isFinite(t) && Date.now() - t <= fourDaysMs;
    })
    .slice(0, 2);

  return candidates.map((a) => {
    const msg = a.message;
    const speedMatch = msg.match(/\b(\d{3,4})\s*km\/s/i);
    const dirMatch = msg.match(/Earth-directed|Earth-facing|full halo|partial halo|halo CME/i);
    const isDirectHit = /Earth-directed|Earth-facing|will reach Earth|geomagnetic storm|full halo|halo CME/i.test(msg);
    const isGlancing = !isDirectHit && /partial halo|glancing/i.test(msg);
    const impactNote = isDirectHit ? "Likely Earth impact" : isGlancing ? "Glancing impact possible" : "Monitor for effects";
    const flareMatch = msg.match(/\b([BCMX]\d+\.?\d*)\b/);

    // G-scale from product_id WATA code
    const gLevel = STORM_WATCH_LEVEL[a.product_id];

    // Geomagnetic latitude from "ABOVE GEOMAGNETIC LATITUDE NN DEGREES"
    const latMatch = msg.match(/ABOVE\s+GEOMAGNETIC\s+LATITUDE\s+(\d+)/i);
    const affectedLat = latMatch ? parseInt(latMatch[1], 10) : null;

    // Arrival window — VALID TIME takes priority, then inline EXPECTED / ARRIVAL mentions
    const validTimeMatch = msg.match(/VALID\s+TIME[:\s]+([^\n]+)/i);
    const arrivalLineMatch = msg.match(/(?:expected\s+arrival|arrival\s+expected|estimated\s+to\s+arrive)[^\n]*/i);
    const rawWindow = validTimeMatch?.[1]?.trim() ?? arrivalLineMatch?.[0]?.trim() ?? null;
    // Compact the window: "2026 Jun 14 0000 UTC - 2026 Jun 15 2359 UTC" → "Jun 14 0000–Jun 15 2359 UTC"
    const arrivalWindow = rawWindow
      ? rawWindow.replace(/\b\d{4}\s+/g, '').replace(/\s*UTC\s*-\s*/i, '–').replace(/\s+UTC$/, ' UTC').trim()
      : null;

    let note: string;
    if (gLevel) {
      const parts: string[] = [`A ${gLevel} geomagnetic storm watch is in effect.`];
      if (affectedLat != null) {
        parts.push(`Aurora may be visible as far south as ${affectedLat}° latitude.`);
      }
      if (arrivalWindow) {
        parts.push(`Active: ${arrivalWindow}.`);
      }
      note = parts.join(' ');
    } else {
      const speedText = speedMatch ? ` at ${parseInt(speedMatch[1], 10).toLocaleString()} km/s` : '';
      if (isDirectHit) {
        note = `Earth-directed CME detected${speedText}.`;
      } else if (isGlancing) {
        note = `A glancing CME impact is possible${speedText}.`;
      } else {
        note = `CME activity detected${speedText}.`;
      }
    }

    return {
      time: a.issue_datetime,
      speed: speedMatch ? parseInt(speedMatch[1], 10) : undefined,
      direction: dirMatch ? dirMatch[0] : undefined,
      earthImpact: impactNote,
      note,
      associatedFlare: flareMatch ? flareMatch[1] : undefined,
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
 * Ignores CMEs older than 4 days — by then they've already arrived or missed.
 */
export function assessEarthImpact(recentCmes: CmeSummary[]): EarthImpactAssessment {
  const fresh = recentCmes.filter((c) => {
    const t = new Date(normalizeTimeTag(c.time)).getTime();
    return isFinite(t) && Date.now() - t < 1000 * 60 * 60 * 24 * 4;
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
