"use client";

import { useMemo } from "react";

/**
 * useGlobalFreshness
 * Computes the single latest timestamp across multiple data sources.
 * Used for the consolidated "LIVE" / relative freshness indicator in header and Current Conditions.
 * Pure derived state; no fetching side effects.
 */
export function useGlobalFreshness(
  kpTime?: string | null,
  flareTime?: string | null,
  alertsTime?: string | null,
  regionsTime?: string | null
): Date | null {
  return useMemo(() => {
    const lastUpdatedTimes = [
      kpTime ? new Date(kpTime) : null,
      flareTime ? new Date(flareTime) : null,
      alertsTime ? new Date(alertsTime) : null,
      regionsTime ? new Date(regionsTime) : null,
    ].filter((d): d is Date => d !== null && !isNaN(d.getTime()));

    if (lastUpdatedTimes.length === 0) return null;

    return new Date(Math.max(...lastUpdatedTimes.map((d) => d.getTime())));
  }, [kpTime, flareTime, alertsTime, regionsTime]);
}
