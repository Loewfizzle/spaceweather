"use client";

/**
 * LiveHeader — right-side header controls.
 *
 * Intentionally minimal: Kp index pill, optional health indicator (DataStatus),
 * and a manual refresh button.
 *
 * The LIVE dot + timestamp moved to LiveIndicator inside the branding area;
 * the MI risk pill was removed to reduce header noise.
 */

import { Activity, RefreshCw } from "lucide-react";
import { useCurrentConditions, useSolarActivity } from "../lib/use-noaa-data";
import { getKpTier } from "../lib/aurora/kp";
import { DataStatus } from "./DataStatus";

export function LiveHeader() {
  const conditions = useCurrentConditions();
  const solarActivity = useSolarActivity();

  const { kp, isLoading, isFetching, refetchAll } = conditions;

  const kpClass = `kp-${kp !== null ? getKpTier(kp) : "quiet"}`;

  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      {/* Kp index — primary live signal in the header */}
      <div
        className={`kp-pill ${kpClass}`}
        title="Planetary K-index (live from NOAA)"
      >
        <Activity className="w-3.5 h-3.5" />
        <span>Kp {kp !== null ? kp.toFixed(1) : "—"}</span>
      </div>

      {/* Appears only when a data source is degraded or down */}
      <DataStatus />

      <button
        onClick={() => { refetchAll(); solarActivity.refetchAll(); }}
        disabled={isLoading || solarActivity.isLoading}
        className="button flex items-center justify-center gap-1.5 text-xs px-2.5 sm:px-3 py-1 min-h-[38px] sm:min-h-0"
        title="Refresh live data"
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${
            isFetching || solarActivity.isFetching ? "animate-spin" : ""
          }`}
        />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
  );
}
