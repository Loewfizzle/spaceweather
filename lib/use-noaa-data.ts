"use client";

import { useQuery, useQueries } from "@tanstack/react-query";
import {
  // Fetchers are the single source for network + validation (lib/api/fetchers)
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

import {
  // Pure business logic and helpers live in lib/noaa.ts
  latest,
  maxOvationNorthAmerica,
  parseRecentCmes,
  currentSunspotNumber,
  getTonightOutlook,
  getMichiganRiskLevel,
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  formatFireballDate,
  formatFireballLocation,
} from "./noaa";

import type { MeteorShower, TonightOutlook } from "./noaa";

import type {
  // Types from the Zod schemas (single source of truth for shapes)
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

/**
 * Error Handling Strategy (critical vs. enhancement / non-critical data)
 *
 * Philosophy: Enable graceful degradation. Core "decision" data for the user (Tonight’s Michigan
 * Outlook / hero) must be resilient. Supporting / enhancement data can fail without breaking the
 * primary experience.
 *
 * Critical (bubbles to top-level .error for the section):
 *   - useCurrentConditions: Kp + OVATION (error = kpQuery.error || ovationQuery.error)
 *     Bz and solar wind are treated as enhancement — nulls become "—" in UI.
 *     Purpose: hero outlook + main risk/guidance should still attempt to render (often from cache).
 *
 *   - useSolarActivity: flares + alerts (error = flaresQuery.error || alertsQuery.error)
 *     Regions (sunspots) explicitly non-fatal so sunspot card doesn't break the whole section.
 *
 * Non-critical / enhancement (graceful fallback to null/—, never pollute primary error):
 *   - Solar wind (plasma + mag) inside useSolarWindData: error returned but ignored by
 *     useCurrentConditions for its .error. Values fall back to null.
 *   - Solar regions in useSolarActivity: sunspotNumber can be null.
 *   - Fireballs: handled locally in MeteorActivity (uses ErrorState with retry).
 *   - Sky (legacy, unused in UI): separate.
 *
 * UI pattern:
 *   - Hero / primary outlook: show card (using available/cached data) + subtle warning line on critical error.
 *   - Metric cards: prefer "—" fallbacks over hiding whole row.
 *   - Section cards (solar, meteor): use ErrorState or warning only for their critical subset; render
 *     available data otherwise.
 *   - Top-level ErrorBoundary catches unexpected render crashes.
 *
 * This keeps the dashboard useful even when some NOAA endpoints are flaky.
 */
export function useOvationData() {
  return useQuery<OvationResponse>({
    queryKey: ["ovation"],
    queryFn: fetchOvation,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useKpData() {
  return useQuery<KpEntry[]>({
    queryKey: ["kp"],
    queryFn: fetchKpIndex,
    staleTime: 1000 * 60 * 3,
  });
}

export function useSolarWindData() {
  const plasmaQuery = useQuery<PlasmaEntry[]>({
    queryKey: ["plasma"],
    queryFn: fetchPlasma,
    staleTime: 1000 * 60 * 1,
  });

  const magQuery = useQuery<MagEntry[]>({
    queryKey: ["mag"],
    queryFn: fetchMag,
    staleTime: 1000 * 60 * 1,
  });

  const currentPlasma = plasmaQuery.data ? latest(plasmaQuery.data) : null;
  const currentMag = magQuery.data ? latest(magQuery.data) : null;

  return {
    plasma: plasmaQuery,
    mag: magQuery,
    current: {
      speed: currentPlasma?.speed ?? null,
      density: currentPlasma?.density ?? null,
      bz: currentMag?.bz_gsm ?? null,
      bt: currentMag?.bt ?? null,
    },
    isLoading: plasmaQuery.isLoading || magQuery.isLoading,
    error: plasmaQuery.error || magQuery.error,
  };
}

// Combined hook for current conditions + Michigan guidance
export function useCurrentConditions() {
  const kpQuery = useKpData();
  const ovationQuery = useOvationData();
  const solarWind = useSolarWindData();

  const latestKp = kpQuery.data ? latest(kpQuery.data) : null;
  const maxProbNA = ovationQuery.data
    ? maxOvationNorthAmerica(ovationQuery.data)
    : null;

  // Enhanced Michigan guidance that incorporates Kp + OVATION max prob + Bz for more accurate plain-English advice.
  // (Previously Kp-only; now aligns better with riskLevel logic while staying concise.)
  const getMichiganGuidance = (kp: number | null, maxProb: number | null, bz: number | null) => {
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
  };

  return {
    kp: latestKp?.Kp ?? null,
    kpTime: latestKp?.time_tag ?? null,
    maxAuroraProbNA: maxProbNA,
    solarWindSpeed: solarWind.current.speed,
    solarWindDensity: solarWind.current.density,
    bz: solarWind.current.bz,
    michiganGuidance: getMichiganGuidance(latestKp?.Kp ?? null, maxProbNA, solarWind.current.bz),
    riskLevel: getMichiganRiskLevel(latestKp?.Kp ?? null, maxProbNA, solarWind.current.bz),
    isLoading:
      kpQuery.isLoading ||
      ovationQuery.isLoading ||
      solarWind.isLoading,
    // Only propagate errors from Kp and OVATION as fatal for the hero/outlook.
    // Solar wind glitches (plasma/mag) are non-fatal; values gracefully fall back to null.
    // This prevents spurious "Error loading outlook" when supporting data sources are flaky.
    error: kpQuery.error || ovationQuery.error,
    refetchAll: () => {
      kpQuery.refetch();
      ovationQuery.refetch();
      solarWind.plasma.refetch();
      solarWind.mag.refetch();
    },
  };
}

// --- Solar Activity hook for the new SOLAR ACTIVITY section ---
export function useSolarActivity() {
  const flaresQuery = useQuery<XrayFlare[]>({
    queryKey: ["xray-flares"],
    queryFn: fetchXrayFlaresLatest,
    staleTime: 1000 * 60 * 5, // 5 minutes - flares update frequently
  });

  const alertsQuery = useQuery<Alert[]>({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    staleTime: 1000 * 60 * 5,
  });

  const regionsQuery = useQuery<SolarRegion[]>({
    queryKey: ["solar-regions"],
    queryFn: fetchSolarRegions,
    staleTime: 1000 * 60 * 30, // 30 min is fine for sunspots
  });

  const latestFlare = flaresQuery.data && flaresQuery.data.length > 0
    ? flaresQuery.data[0]
    : null;

  const recentCmes: CmeSummary[] = parseRecentCmes(alertsQuery.data);

  const sunspotNumber = currentSunspotNumber(regionsQuery.data);

  // Light treatment for coronal holes - no dedicated high-frequency JSON, use contextual note
  const coronalHoleNote =
    "Coronal holes can launch high-speed solar wind streams that enhance aurora potential 2–4 days later. Monitor solar wind speed and Bz for impacts.";

  const isLoading =
    flaresQuery.isLoading || alertsQuery.isLoading || regionsQuery.isLoading;
  // Only treat flares and alerts as fatal errors for the hook.
  // Sunspot data (regions) is non-critical for outlook computation and solar display;
  // failure there should not hide the other solar cards or trigger hero error.
  const error = flaresQuery.error || alertsQuery.error;

  const refetchAll = () => {
    flaresQuery.refetch();
    alertsQuery.refetch();
    regionsQuery.refetch();
  };

  return {
    latestFlare,
    recentCmes,
    sunspotNumber,
    coronalHoleNote,
    isLoading,
    error,
    refetchAll,
    // raw for freshness if needed
    flareTime: latestFlare?.max_time || latestFlare?.time_tag || null,
    alertsTime: alertsQuery.data && alertsQuery.data.length > 0 ? alertsQuery.data[0].issue_datetime : null,
    regionsTime: regionsQuery.data && regionsQuery.data.length > 0 ? regionsQuery.data[0]?.observed_date : null,
  };
}



// Michigan sky conditions for aurora viewing (cloud cover tonight).
// Note: UI section was removed ("for now"); hook retained to avoid behavior changes
// and for potential future re-use. It still performs real Open-Meteo fetches.
const SKY_LOCATIONS = [
  { name: "Marquette (UP)", lat: 46.5436, lon: -87.3954 },
  { name: "Traverse City", lat: 44.7631, lon: -85.6206 },
  { name: "Houghton (UP)", lat: 47.1219, lon: -88.5694 },
];

export type SkyCondition = {
  name: string;
  cloudCover: number;
  status: "Clear" | "Partly Cloudy" | "Cloudy";
  note: string;
};

export function useSkyConditions() {
  const queries = SKY_LOCATIONS.map((loc) => ({
    queryKey: ["cloudcover", loc.name],
    queryFn: () => fetchCloudCover(loc.lat, loc.lon),
    staleTime: 1000 * 60 * 45, // 45 minutes — weather changes slower than space data
  }));

  const results = useQueries({ queries });

  const conditions: SkyCondition[] = SKY_LOCATIONS.map((loc, index) => {
    const data: CloudCoverData | undefined = results[index].data;
    if (!data) {
      return {
        name: loc.name,
        cloudCover: 0,
        status: "Cloudy" as const,
        note: "Unable to load forecast.",
      };
    }

    const now = new Date();
    let minCloud = 101;

    // Look for the clearest night hour in next ~18 hours (focus on 8pm-6am local)
    for (let i = 0; i < data.time.length; i++) {
      const t = new Date(data.time[i]);
      const hour = t.getHours();
      const isNightHour = hour >= 20 || hour <= 6;
      const hoursAhead = (t.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursAhead > 2 && hoursAhead < 18 && isNightHour) {
        const c = data.cloudcover[i];
        if (c < minCloud) {
          minCloud = c;
        }
      }
    }

    const cloud = minCloud > 100 ? (data.cloudcover[0] ?? 50) : minCloud;
    let status: "Clear" | "Partly Cloudy" | "Cloudy";
    let note: string;

    if (cloud < 20) {
      status = "Clear";
      note = "Clear skies — excellent viewing window likely.";
    } else if (cloud < 50) {
      status = "Partly Cloudy";
      note = "Partly cloudy — look for breaks after midnight.";
    } else {
      status = "Cloudy";
      note = "Cloudy skies — limited aurora viewing chances.";
    }

    return {
      name: loc.name,
      cloudCover: Math.round(cloud),
      status,
      note,
    };
  });

  const isLoading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error || null;

  const refetchAll = () => results.forEach((r) => r.refetch());

  return { conditions, isLoading, error, refetchAll };
}

// Fireball tracker (proxied via our /api/fireballs route to avoid CORS issues in production)
export function useFireballs(limit = 8) {
  const query = useQuery<Fireball[]>({
    queryKey: ["fireballs", limit],
    queryFn: () => fetchFireballs(limit),
    staleTime: 1000 * 60 * 60, // 1 hour – data is historical
  });

  return {
    fireballs: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Re-exports of pure business logic (sourced from lib/noaa.ts) for convenience
// of current UI consumers (page.tsx, MeteorActivity, etc.). Prefer importing
// hooks from here; business fns are composed inside the hooks.
export { getNextMeteorShower, type MeteorShower, formatMeteorPeak, createGoogleCalendarLink, type TonightOutlook, getTonightOutlook };

// Re-export of the pure MI risk helper (defined in lib/noaa.ts)
export { getMichiganRiskLevel };

// Re-export fireball format helpers for display consistency
export { formatFireballDate, formatFireballLocation, type Fireball };
