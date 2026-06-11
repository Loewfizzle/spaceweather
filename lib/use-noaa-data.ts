"use client";

import { useEffect } from "react";
import { logDataError } from "./utils/retry";
import {
  useOvationData,
  useKpData,
  useSolarWindData,
  useKpForecast,
} from "./hooks/useNoaaQueries";

// Pure business logic and display helpers
import { latest } from "./noaa";
import { getTonightOutlook, getLocationAuroraProb } from "./aurora/outlook";
import type { CityAuroraProb, TonightOutlook } from "./aurora/outlook";
import { getAuroraRiskLevel } from "./aurora/kp";
import { getNextMeteorShower, formatMeteorPeak, createGoogleCalendarLink, createIcsContent, icsFileName } from "./aurora/meteors";
import type { MeteorShower } from "./aurora/meteors";
import { formatFireballDate, formatFireballLocation, formatFireballEnergy } from "./aurora/fireballs";
import { approximateLocation } from "./aurora/location";

import type { ViewingWindowData } from "./utils/viewingWindow";

import { useDerivedConditions } from "./hooks/useDerivedConditions";
import { useStableRefetch } from "./hooks/useStableRefetch";

import type { Fireball } from "./api/schemas";

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

// Re-exports from lib/hooks/ — convenience barrel for UI consumers that already import hooks here.
export { useOvationData, useKpData, useSolarWindData, useKpForecast } from "./hooks/useNoaaQueries";
export { useSolarActivity } from "./hooks/useSolarActivity";
export { useFireballs } from "./hooks/useFireballs";

// Re-exports from lib/noaa.ts — convenience barrel for UI consumers that already import hooks here.
export {
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  createIcsContent,
  icsFileName,
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
