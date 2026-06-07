"use client";

import { useMemo } from "react";

/**
 * useGlobalFreshness
 * Computes the single latest timestamp across multiple data sources.
 * Used for the consolidated "LIVE" / relative freshness indicator in header and Current Conditions.
 * Pure derived state; no fetching side effects.
 */
// NOAA timestamps are always UTC but arrive in mixed formats:
// "2026-06-05 23:00:00.000" (space-sep, no Z), "2026-06-05T23:00:00Z" (already correct), "2026-06-05" (date-only, parses as UTC natively).
// Normalize to unambiguous UTC before constructing Date objects.
function parseNoaaTimestamp(s: string): Date {
  const normalized = s.replaceAll(' ', 'T');
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized);
  return new Date(hasOffset ? normalized : normalized + 'Z');
}

export function useGlobalFreshness(
  kpTime?: string | null,
  flareTime?: string | null,
  alertsTime?: string | null,
  regionsTime?: string | null
): Date | null {
  return useMemo(() => {
    const lastUpdatedTimes = [kpTime, flareTime, alertsTime, regionsTime]
      .filter((s): s is string => !!s)
      .map(parseNoaaTimestamp)
      .filter((d) => !isNaN(d.getTime()));

    if (lastUpdatedTimes.length === 0) return null;

    return new Date(Math.max(...lastUpdatedTimes.map((d) => d.getTime())));
  }, [kpTime, flareTime, alertsTime, regionsTime]);
}
