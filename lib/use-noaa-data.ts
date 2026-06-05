"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  exponentialBackoff,
  shouldRetryCritical,
  shouldRetryNonCritical,
  logDataError,
} from "./utils/retry";
import {
  // Fetchers are the single source for network + validation (lib/api/fetchers)
  fetchOvation,
  fetchKpIndex,
  fetchPlasma,
  fetchMag,
  fetchXrayFlaresLatest,
  fetchAlerts,
  fetchSolarRegions,
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
    staleTime: 1000 * 60 * 2, // 2 minutes - fresh enough for live feel
    gcTime: 1000 * 60 * 30, // Keep data 30min for graceful degradation on outages
    retry: shouldRetryCritical,
    retryDelay: exponentialBackoff,
    refetchOnWindowFocus: true,
    // Critical data: Kp + OVATION power the hero outlook and Michigan risk.
    // Most resilient retry + longest cache retention.
  });
}

export function useKpData() {
  return useQuery<KpEntry[]>({
    queryKey: ["kp"],
    queryFn: fetchKpIndex,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 30,
    retry: shouldRetryCritical,
    retryDelay: exponentialBackoff,
    refetchOnWindowFocus: true,
  });
}

export function useSolarWindData() {
  const plasmaQuery = useQuery<PlasmaEntry[]>({
    queryKey: ["plasma"],
    queryFn: fetchPlasma,
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
  });

  const magQuery = useQuery<MagEntry[]>({
    queryKey: ["mag"],
    queryFn: fetchMag,
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 5,
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
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
  const ovationData = ovationQuery.data;
  const maxProbNA = ovationData
    ? maxOvationNorthAmerica(ovationData)
    : null;

  const ovationProcessed = !!ovationData && 
    Array.isArray(ovationData.coordinates) && 
    ovationData.coordinates.length > 0;

  // Observability: log when OVATION yields unexpectedly low/empty NA results.
  // Runs in an effect (not render body) to avoid firing on discarded renders in StrictMode.
  useEffect(() => {
    if (!ovationData || !ovationData.coordinates) return;
    const coordsCount = ovationData.coordinates.length;
    if (maxProbNA === 0 && coordsCount > 0) {
      logDataError(
        'OVATION: 0 max prob in NA after filtering (oval may be shifted or bounds/filter issue)',
        null,
        { coordsCount, minProbUsed: 0 },
        false
      );
    } else if (maxProbNA != null && maxProbNA < 5 && latestKp?.Kp != null && latestKp.Kp >= 4) {
      logDataError(
        'OVATION: unexpectedly low NA max prob given current Kp (possible data shift or filter)',
        null,
        { maxProbNA, kp: latestKp.Kp, coordsCount: ovationData.coordinates.length },
        false
      );
    }
  }, [ovationData, maxProbNA, latestKp]);

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

  // Observability: expose fetching state and separate non-critical errors for UI indicators
  const criticalError = kpQuery.error || ovationQuery.error;
  const nonCriticalError = solarWind.error;

  if (process.env.NODE_ENV === 'development' && criticalError) {
    // Log only when error present; throttled inside logDataError for prod
    logDataError('Critical data (Kp/OVATION)', criticalError, ['useCurrentConditions'], true);
  }

  return {
    kp: latestKp?.Kp ?? null,
    kpTime: latestKp?.time_tag ?? null,
    maxAuroraProbNA: maxProbNA,
    ovationProcessed,  // true if we got non-empty coordinates from OVATION (for distinguishing real 0% vs processing failure)
    solarWindSpeed: solarWind.current.speed,
    solarWindDensity: solarWind.current.density,
    bz: solarWind.current.bz,
    michiganGuidance: getMichiganGuidance(latestKp?.Kp ?? null, maxProbNA, solarWind.current.bz),
    riskLevel: getMichiganRiskLevel(latestKp?.Kp ?? null, maxProbNA, solarWind.current.bz),
    isLoading:
      kpQuery.isLoading ||
      ovationQuery.isLoading ||
      solarWind.isLoading,
    // Critical error for hero (only Kp/OVATION)
    error: criticalError,
    // For partial data UI (e.g. show subtle note in Current Conditions when solar wind delayed)
    solarWindError: nonCriticalError,
    isFetching: kpQuery.isFetching || ovationQuery.isFetching || solarWind.plasma.isFetching || solarWind.mag.isFetching,
    // Only propagate errors from Kp and OVATION as fatal for the hero/outlook.
    // Solar wind glitches (plasma/mag) are non-fatal; values gracefully fall back to null.
    // This prevents spurious "Error loading outlook" when supporting data sources are flaky.
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
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: shouldRetryCritical, // flares are high priority for solar context
    retryDelay: exponentialBackoff,
  });

  const alertsQuery = useQuery<Alert[]>({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: shouldRetryCritical,
    retryDelay: exponentialBackoff,
  });

  const regionsQuery = useQuery<SolarRegion[]>({
    queryKey: ["solar-regions"],
    queryFn: fetchSolarRegions,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60, // sunspots change slowly, keep longer
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
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
  const regionsError = regionsQuery.error;

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
    regionsError, // for potential subtle UI note when sunspots delayed but flares ok
    isFetching: flaresQuery.isFetching || alertsQuery.isFetching || regionsQuery.isFetching,
    refetchAll,
    // raw for freshness if needed
    flareTime: latestFlare?.max_time || latestFlare?.time_tag || null,
    alertsTime: alertsQuery.data && alertsQuery.data.length > 0 ? alertsQuery.data[0].issue_datetime : null,
    regionsTime: regionsQuery.data && regionsQuery.data.length > 0 ? regionsQuery.data[0]?.observed_date : null,
  };
}


// Fireball tracker (proxied via our /api/fireballs route to avoid CORS issues in production)
export function useFireballs(limit = 8) {
  const query = useQuery<Fireball[]>({
    queryKey: ["fireballs", limit],
    queryFn: () => fetchFireballs(limit),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 4, // historical, keep 4h
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
  });

  return {
    fireballs: (query.data || []) as Fireball[],
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
