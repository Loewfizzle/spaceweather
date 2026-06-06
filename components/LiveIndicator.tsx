"use client";

/**
 * LiveIndicator — pulsing dot + data freshness timestamp for the header branding area.
 *
 * Designed to sit directly below the AuroraWatch subtitle so the live-data signal
 * feels part of the brand identity rather than a separate control.
 *
 * Shares the same TanStack Query cache as DashboardClient (no extra network requests).
 * Returns null during initial load so the branding has no layout shift before data arrives.
 */

import { formatDistanceToNow } from "date-fns";
import { useCurrentConditions, useSolarActivity } from "../lib/use-noaa-data";
import { useGlobalFreshness } from "../lib/hooks/useGlobalFreshness";

export function LiveIndicator() {
  const { kpTime } = useCurrentConditions();
  const solarActivity = useSolarActivity();

  const latestGlobalUpdate = useGlobalFreshness(
    kpTime,
    solarActivity.flareTime,
    solarActivity.alertsTime,
    solarActivity.regionsTime
  );

  // Stay invisible until we have at least one timestamp so there's no "hole"
  // in the branding layout during the brief initial-fetch window.
  if (!latestGlobalUpdate) return null;

  return (
    <div
      className="flex items-center gap-1 mt-1 text-[10px] text-[#64748b] tabular-nums"
      title="Most recent data across all sources"
    >
      {/* Pulsing green live dot */}
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
      </span>

      {/* Full relative timestamp on sm+; compact chip on mobile to save space */}
      <span className="hidden sm:inline">
        {formatDistanceToNow(latestGlobalUpdate, { addSuffix: true })}
      </span>
      <span className="sm:hidden text-[9px] font-medium tracking-wider text-[#22c55e]">
        LIVE
      </span>
    </div>
  );
}
