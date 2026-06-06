"use client";

import { Activity, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCurrentConditions, useSolarActivity } from "../lib/use-noaa-data";
import { useGlobalFreshness } from "../lib/hooks/useGlobalFreshness";
import { DataStatus } from "./DataStatus";

export function LiveHeader() {
  const conditions = useCurrentConditions();
  const solarActivity = useSolarActivity();

  const { kp, kpTime, riskLevel, isLoading, isFetching, refetchAll } = conditions;

  const latestGlobalUpdate = useGlobalFreshness(
    kpTime,
    solarActivity.flareTime,
    solarActivity.alertsTime,
    solarActivity.regionsTime
  );

  const kpClass =
    kp === null ? "kp-low" : kp >= 5 ? "kp-high" : kp >= 4 ? "kp-moderate" : "kp-low";

  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      <div
        className={`kp-pill ${kpClass}`}
        title="Planetary K-index (live from NOAA)"
      >
        <Activity className="w-3.5 h-3.5" />
        <span>Kp {kp !== null ? kp.toFixed(1) : "—"}</span>
      </div>

      {riskLevel && (
        <div
          className={`risk-pill risk-${riskLevel.toLowerCase()}`}
          title="Current aurora visibility risk for Michigan (Kp + OVATION + Bz)"
        >
          MI {riskLevel}
        </div>
      )}

      {latestGlobalUpdate && (
        <div
          className="flex items-center gap-1 text-[10px] text-[#64748b] tabular-nums"
          title="Most recent data across all sources"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c55e]" />
          </span>
          <span className="hidden sm:inline">
            {formatDistanceToNow(latestGlobalUpdate, { addSuffix: true })}
          </span>
          <span className="sm:hidden text-[#22c55e] font-medium">LIVE</span>
        </div>
      )}

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
