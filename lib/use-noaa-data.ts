"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  exponentialBackoff,
  shouldRetryCritical,
  shouldRetryNonCritical,
  logDataError,
} from "./utils/retry";
// Network + Zod validation (single source for all external data)
import {
  fetchOvation,
  fetchKpIndex,
  fetchKpForecast,
  fetchPlasma,
  fetchMag,
  fetchXrayFlaresLatest,
  fetchAlerts,
  fetchSolarRegions,
  fetchFireballs,
} from "./api/fetchers";

// Pure business logic and display helpers
import {
  latest,
  maxOvationNorthAmerica,
  parseRecentCmes,
  currentSunspotNumber,
  getTonightOutlook,
  getMichiganRiskLevel,
  getMichiganGuidance,
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  formatFireballDate,
  formatFireballLocation,
  formatFireballEnergy,
  getCityAuroraProbabilities,
  getLocationAuroraProb,
} from "./noaa";

import type { MeteorShower, TonightOutlook, CityAuroraProb } from "./noaa";

import type {
  // Types from the Zod schemas (single source of truth for shapes)
  OvationResponse,
  KpEntry,
  KpForecastEntry,
  PlasmaEntry,
  MagEntry,
  XrayFlare,
  Alert,
  SolarRegion,
  Fireball,
} from "./api/schemas";

/**
 * Error handling philosophy: critical vs. non-critical data.
 *
 * Critical (surfaces as .error to the section): Kp + OVATION (hero outlook), flares + alerts (solar section).
 * Non-critical (graceful null fallback): solar wind plasma/mag, sunspot regions, fireballs.
 *
 * Solar wind errors do not bubble to the hero — they show a subtle "data delayed" note instead.
 * This keeps the dashboard usable when individual NOAA endpoints are temporarily unavailable.
 */
export function useOvationData() {
  return useQuery<OvationResponse>({
    queryKey: ["ovation"],
    queryFn: fetchOvation,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 2,
    refetchIntervalInBackground: false, // pause polling when tab is hidden (TanStack v5 default; explicit for clarity)
    retry: shouldRetryCritical,
    retryDelay: exponentialBackoff,
    refetchOnWindowFocus: true,
  });
}

export function useKpData() {
  return useQuery<KpEntry[]>({
    queryKey: ["kp"],
    queryFn: fetchKpIndex,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 3,
    refetchIntervalInBackground: false,
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
    gcTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60,
    refetchIntervalInBackground: false,
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
  });

  const magQuery = useQuery<MagEntry[]>({
    queryKey: ["mag"],
    queryFn: fetchMag,
    staleTime: 1000 * 60 * 1,
    gcTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60,
    refetchIntervalInBackground: false,
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

  // maxOvationNorthAmerica walks the full OVATION grid (~65k entries); memoize on data identity.
  const maxProbNA = useMemo(
    () => (ovationData ? maxOvationNorthAmerica(ovationData) : null),
    [ovationData]
  );

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

  // Observability: expose fetching state and separate non-critical errors for UI indicators
  const criticalError = kpQuery.error || ovationQuery.error;
  const nonCriticalError = solarWind.error;

  useEffect(() => {
    if (criticalError) {
      logDataError('Critical data (Kp/OVATION)', criticalError, ['useCurrentConditions'], true);
    }
  }, [criticalError]);

  const cityProbs = useMemo(
    () => getCityAuroraProbabilities(ovationData ?? null, latestKp?.Kp ?? null, solarWind.current.bz),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ovationData, latestKp?.Kp, solarWind.current.bz]
  );

  return {
    kp: latestKp?.Kp ?? null,
    kpTime: latestKp?.time_tag ?? null,
    kpHistory: kpQuery.data ?? [],
    maxAuroraProbNA: maxProbNA,
    ovationProcessed,  // true if we got non-empty coordinates from OVATION (for distinguishing real 0% vs processing failure)
    cityProbs,
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

export function useKpForecast() {
  return useQuery<KpForecastEntry[]>({
    queryKey: ['kp-forecast'],
    queryFn: fetchKpForecast,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 30,
    refetchIntervalInBackground: false,
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
  });
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
    gcTime: 1000 * 60 * 60,
    refetchInterval: false, // sunspot regions update daily; no background polling needed
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
  });

  const latestFlare = flaresQuery.data && flaresQuery.data.length > 0
    ? flaresQuery.data[0]
    : null;

  // parseRecentCmes and currentSunspotNumber produce new array/value references every call;
  // memoize so consumers (e.g. tonightOutlook useMemo in page.tsx) get stable deps.
  const recentCmes = useMemo(
    () => parseRecentCmes(alertsQuery.data),
    [alertsQuery.data]
  );

  const sunspotNumber = useMemo(
    () => currentSunspotNumber(regionsQuery.data),
    [regionsQuery.data]
  );

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
    alerts: alertsQuery.data,
    latestFlare,
    recentCmes,
    sunspotNumber,
    isLoading,
    error,
    regionsError,
    isFetching: flaresQuery.isFetching || alertsQuery.isFetching || regionsQuery.isFetching,
    refetchAll,
    flareTime: latestFlare?.max_time || latestFlare?.time_tag || null,
    alertsTime: alertsQuery.data && alertsQuery.data.length > 0 ? alertsQuery.data[0].issue_datetime : null,
    regionsTime: regionsQuery.data && regionsQuery.data.length > 0 ? regionsQuery.data[0]?.observed_date : null,
  };
}

// Fireball tracker (proxied via our /api/fireballs route to avoid CORS issues in production)
export function useFireballs(limit = 10) {
  const query = useQuery<Fireball[]>({
    queryKey: ["fireballs", limit],
    queryFn: () => fetchFireballs(limit),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 4,
    refetchInterval: false,
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

// Re-exports from lib/noaa.ts — convenience barrel for UI consumers that already import hooks here.
export {
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  getTonightOutlook,
  getLocationAuroraProb,
  getMichiganRiskLevel,
  formatFireballDate,
  formatFireballLocation,
  formatFireballEnergy,
  type MeteorShower,
  type TonightOutlook,
  type CityAuroraProb,
  type Fireball,
};
