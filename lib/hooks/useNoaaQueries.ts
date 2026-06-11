"use client";

import { useQuery } from "@tanstack/react-query";
import {
  exponentialBackoff,
  shouldRetryCritical,
  shouldRetryNonCritical,
} from "../utils/retry";
import {
  fetchOvation,
  fetchKpIndex,
  fetchKpForecast,
  fetchPlasma,
  fetchMag,
  fetchDonkiCmes,
} from "../api/fetchers";
import { latest } from "../noaa";
import type { OvationResponse, KpEntry, KpForecastEntry, PlasmaEntry, MagEntry, DonkiCme } from "../api/schemas";

export function useOvationData() {
  return useQuery<OvationResponse>({
    queryKey: ["ovation"],
    queryFn: fetchOvation,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 360,
    refetchInterval: 1000 * 60 * 2,
    refetchIntervalInBackground: false,
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

export function useKpForecast() {
  return useQuery<KpForecastEntry[]>({
    queryKey: ["kp-forecast"],
    queryFn: fetchKpForecast,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 30,
    refetchIntervalInBackground: false,
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
  });
}

export function useDonkiCmes() {
  return useQuery<DonkiCme[]>({
    queryKey: ["donki-cmes"],
    queryFn: fetchDonkiCmes,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 30,
    refetchIntervalInBackground: false,
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
  });
}
