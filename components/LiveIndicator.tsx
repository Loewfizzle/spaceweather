"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useCurrentConditions, useSolarActivity } from "../lib/use-noaa-data";
import { useGlobalFreshness } from "../lib/hooks/useGlobalFreshness";

const LIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

// Compact age string for the narrow mobile viewport: "5m", "2h".
// Avoids date-fns prose ("about 2 hours ago") which wraps badly at tiny sizes.
function compactAge(nowMs: number, date: Date): string {
  const mins = Math.floor((nowMs - date.getTime()) / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export function LiveIndicator() {
  const { kpTime } = useCurrentConditions();
  const solarActivity = useSolarActivity();

  const latestGlobalUpdate = useGlobalFreshness(
    kpTime,
    solarActivity.flareTime,
    solarActivity.alertsTime,
    solarActivity.regionsTime
  );

  // Current timestamp, updated every minute so the freshness label stays accurate.
  // Stored in state (not called directly in render) to satisfy react-hooks/purity.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!latestGlobalUpdate) return null;

  const isLive = now - latestGlobalUpdate.getTime() < LIVE_THRESHOLD_MS;
  const dotColor = isLive ? "#22c55e" : "#64748b";

  return (
    <span
      className="flex items-center gap-1 tabular-nums"
      title="Most recent data across all sources"
    >
      {/* Dot: pulsing green when live, static slate when stale */}
      <span className="relative flex h-1.5 w-1.5 shrink-0">
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

      {/* Desktop: full prose timestamp */}
      <span className="hidden sm:inline">
        {formatDistanceToNow(latestGlobalUpdate, { addSuffix: true })}
      </span>

      {/* Mobile: "LIVE" only when fresh; compact age string ("5m", "2h") otherwise */}
      {isLive ? (
        <span className="sm:hidden text-[9px] font-medium tracking-wider text-[#22c55e]">
          LIVE
        </span>
      ) : (
        <span className="sm:hidden text-[9px] tabular-nums text-[#64748b]">
          {compactAge(now, latestGlobalUpdate)}
        </span>
      )}
    </span>
  );
}
