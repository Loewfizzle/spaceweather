"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useCurrentConditions, useSolarActivity } from "../lib/use-noaa-data";
import { useGlobalFreshness } from "../lib/hooks/useGlobalFreshness";

// "LIVE" = the app successfully reached NOAA within this window.
// Intentionally separate from NOAA data age: pressing Refresh always turns
// the dot green once the fetch completes, even if NOAA's data hasn't changed.
const LIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

function compactAge(nowMs: number, date: Date): string {
  const mins = Math.floor((nowMs - date.getTime()) / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export function LiveIndicator() {
  const conditions = useCurrentConditions();
  const solarActivity = useSolarActivity();

  // lastFetchedAt: epoch ms of the most recent successful network response.
  // TanStack Query sets dataUpdatedAt = Date.now() on every successful fetch,
  // so this updates immediately when Refresh is pressed and the call lands.
  const lastFetchedAt = Math.max(
    conditions.lastFetchedAt,
    solarActivity.lastFetchedAt,
  );

  // latestGlobalUpdate: the most recent timestamp embedded in NOAA's data.
  // Used only for the prose "updated X ago" label — reflects actual data age,
  // not when the app last contacted the server.
  const latestGlobalUpdate = useGlobalFreshness(
    conditions.kpTime,
    solarActivity.flareTime,
    solarActivity.alertsTime,
    solarActivity.regionsTime,
  );

  // Current time stored in state so Date.now() isn't called in the render body.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Hide the indicator entirely until we have both a fetch result and a data timestamp.
  if (!latestGlobalUpdate || lastFetchedAt === 0) return null;

  const isLive = now - lastFetchedAt < LIVE_THRESHOLD_MS;
  const dotColor = isLive ? "#22c55e" : "#64748b";

  const ageText = formatDistanceToNow(latestGlobalUpdate, { addSuffix: true });

  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center gap-1 tabular-nums"
      title="Most recent data across all sources"
    >
      {/* Screen-reader label — announces when data age changes */}
      <span className="sr-only">
        {isLive
          ? `Space weather data live — updated ${ageText}`
          : `Space weather data stale — last updated ${ageText}`}
      </span>

      <span aria-hidden="true" className="relative flex h-1.5 w-1.5 shrink-0">
        {isLive && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      </span>

      {/* Show compact data age only when stale; dot alone signals live */}
      {!isLive && (
        <span aria-hidden="true" className="text-[9px] tabular-nums text-[#94a3b8]">
          {compactAge(now, latestGlobalUpdate)}
        </span>
      )}
    </span>
  );
}
