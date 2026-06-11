"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  exponentialBackoff,
  shouldRetryCritical,
  shouldRetryNonCritical,
} from "../utils/retry";
import {
  fetchXrayFlaresLatest,
  fetchXrayFlares7Day,
  fetchAlerts,
  fetchSolarRegions,
} from "../api/fetchers";
import { parseRecentCmes, currentSunspotNumber } from "../aurora/solar";
import type { XrayFlare, Alert, SolarRegion } from "../api/schemas";

export function useSolarActivity() {
  const flaresQuery = useQuery<XrayFlare[]>({
    queryKey: ["xray-flares"],
    queryFn: fetchXrayFlaresLatest,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 5,
    refetchIntervalInBackground: false,
    retry: shouldRetryCritical,
    retryDelay: exponentialBackoff,
  });

  const flares7DayQuery = useQuery<XrayFlare[]>({
    queryKey: ["xray-flares-7day"],
    queryFn: fetchXrayFlares7Day,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 15,
    refetchIntervalInBackground: false,
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
  });

  const alertsQuery = useQuery<Alert[]>({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 5,
    refetchIntervalInBackground: false,
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

  // 7-day data sorted newest-first; drop entry matching latestFlare so the modal
  // doesn't repeat the featured flare in the "recent" list.
  const recentFlares: XrayFlare[] = useMemo(() => {
    const all = flares7DayQuery.data ?? [];
    const sorted = [...all].sort((a, b) => {
      const ta = new Date(a.max_time ?? a.time_tag).getTime();
      const tb = new Date(b.max_time ?? b.time_tag).getTime();
      return tb - ta;
    });
    if (!latestFlare) return sorted;
    const latestTag = latestFlare.max_time ?? latestFlare.time_tag;
    return sorted.filter((f) => (f.max_time ?? f.time_tag) !== latestTag);
  }, [flares7DayQuery.data, latestFlare]);

  // parseRecentCmes and currentSunspotNumber produce new array/value references every call;
  // memoize so consumers (e.g. tonightOutlook useMemo in DashboardClient) get stable deps.
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
    recentFlares,
    recentCmes,
    sunspotNumber,
    isLoading,
    error,
    regionsError,
    isFetching: flaresQuery.isFetching || alertsQuery.isFetching || regionsQuery.isFetching,
    lastFetchedAt: (() => {
      const ts = [flaresQuery.dataUpdatedAt, alertsQuery.dataUpdatedAt, regionsQuery.dataUpdatedAt].filter(t => t > 0);
      return ts.length ? Math.max(...ts) : 0;
    })(),
    refetchAll,
    flareTime: latestFlare?.max_time || latestFlare?.time_tag || null,
    alertsTime: alertsQuery.data && alertsQuery.data.length > 0 ? alertsQuery.data[0].issue_datetime : null,
    regionsTime: regionsQuery.data && regionsQuery.data.length > 0 ? regionsQuery.data[0]?.observed_date : null,
  };
}
