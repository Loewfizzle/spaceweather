"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
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
} from "./api/fetchers";

// Pure business logic and display helpers
import { latest } from "./noaa";
import { getTonightOutlook, getLocationAuroraProb } from "./aurora/outlook";
import type { CityAuroraProb, TonightOutlook } from "./aurora/outlook";
import { getAuroraRiskLevel } from "./aurora/kp";
import { getNextMeteorShower, formatMeteorPeak, createGoogleCalendarLink } from "./aurora/meteors";
import type { MeteorShower } from "./aurora/meteors";
import { formatFireballDate, formatFireballLocation, formatFireballEnergy } from "./aurora/fireballs";
import { approximateLocation } from "./aurora/location";

import type { ViewingWindowData } from "./utils/viewingWindow";

import { useDerivedConditions } from "./hooks/useDerivedConditions";
import { useStableRefetch } from "./hooks/useStableRefetch";

import type {
  // Types from the Zod schemas (single source of truth for shapes)
  OvationResponse,
  KpEntry,
  KpForecastEntry,
  PlasmaEntry,
  MagEntry,
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
    gcTime: 1000 * 60 * 360,
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
    gcTime: 1000 * 60 * 360,
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

// Combined hook for current conditions + aurora guidance
export function useCurrentConditions() {
  const kpQuery = useKpData();
  const ovationQuery = useOvationData();
  const solarWind = useSolarWindData();
  const forecastQuery = useKpForecast();

  const latestKp = kpQuery.data ? latest(kpQuery.data) : null;

  const { ovationPoints, maxAuroraProbNA, ovationProcessed, cityProbs, viewingWindow, guidance, riskLevel } =
    useDerivedConditions({
      latestKp,
      ovationData: ovationQuery.data,
      ovationIsSuccess: ovationQuery.isSuccess,
      bz: solarWind.current.bz,
      speed: solarWind.current.speed,
      forecastData: forecastQuery.data,
    });

  const kpError = kpQuery.error;
  const ovationError = ovationQuery.error;

  // Observability: log when OVATION yields unexpectedly low/empty NA results.
  // Runs in an effect (not render body) to avoid firing on discarded renders in StrictMode.
  useEffect(() => {
    if (!ovationQuery.data?.coordinates) return;
    const coordsCount = ovationQuery.data.coordinates.length;
    if (maxAuroraProbNA === 0 && coordsCount > 0) {
      logDataError('OVATION: 0 max prob in NA after filtering (oval may be shifted or bounds/filter issue)', null, { coordsCount, minProbUsed: 0 }, false);
    } else if (maxAuroraProbNA != null && maxAuroraProbNA < 5 && latestKp?.Kp != null && latestKp.Kp >= 4) {
      logDataError('OVATION: unexpectedly low NA max prob given current Kp (possible data shift or filter)', null, { maxAuroraProbNA, kp: latestKp.Kp, coordsCount: ovationQuery.data.coordinates.length }, false);
    }
  }, [ovationQuery.data, maxAuroraProbNA, latestKp]);

  useEffect(() => {
    if (kpError) logDataError('Critical data (Kp)', kpError, ['useCurrentConditions'], true);
    if (ovationError) logDataError('Critical data (OVATION)', ovationError, ['useCurrentConditions'], true);
  }, [kpError, ovationError]);

  const refetchAll = useStableRefetch({
    kp: kpQuery.refetch,
    ovation: ovationQuery.refetch,
    plasma: solarWind.plasma.refetch,
    mag: solarWind.mag.refetch,
  });

  return {
    kp: latestKp?.Kp ?? null,
    kpTime: latestKp?.time_tag ?? null,
    kpHistory: kpQuery.data ?? [],
    maxAuroraProbNA,
    ovationPoints,
    viewingWindow,
    ovationProcessed,
    cityProbs,
    solarWindSpeed: solarWind.current.speed,
    solarWindDensity: solarWind.current.density,
    bz: solarWind.current.bz,
    bzHistory: (solarWind.mag.data ?? [])
      .slice(-90)
      .map((e) => e.bz_gsm)
      .filter((v): v is number => v != null),
    guidance,
    riskLevel,
    isLoading: kpQuery.isLoading || ovationQuery.isLoading || solarWind.isLoading,
    error: kpError || ovationError,
    kpError,
    ovationError,
    solarWindError: solarWind.error,
    isFetching: kpQuery.isFetching || ovationQuery.isFetching || solarWind.plasma.isFetching || solarWind.mag.isFetching,
    lastFetchedAt: (() => {
      const ts = [kpQuery.dataUpdatedAt, ovationQuery.dataUpdatedAt, solarWind.plasma.dataUpdatedAt, solarWind.mag.dataUpdatedAt].filter(t => t > 0);
      return ts.length ? Math.max(...ts) : 0;
    })(),
    refetchAll,
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

// Re-exports from lib/hooks/ — convenience barrel for UI consumers that already import hooks here.
export { useSolarActivity } from "./hooks/useSolarActivity";
export { useFireballs } from "./hooks/useFireballs";

// Re-exports from lib/noaa.ts — convenience barrel for UI consumers that already import hooks here.
export {
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  getTonightOutlook,
  getLocationAuroraProb,
  getAuroraRiskLevel,
  formatFireballDate,
  formatFireballLocation,
  formatFireballEnergy,
  approximateLocation,
  type MeteorShower,
  type TonightOutlook,
  type CityAuroraProb,
  type Fireball,
};
export type { ViewingWindowData };
