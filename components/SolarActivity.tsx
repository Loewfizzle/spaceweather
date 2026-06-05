"use client";

import { Zap, Cloud, Sun, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSolarActivity } from "../lib/use-noaa-data";
import { LoadingSkeleton } from "./LoadingSkeleton";

/**
 * SolarActivity
 * The 4 solar cards: Latest Flare, Recent CMEs, Sunspot Number, Coronal Holes.
 * Self-contained: calls useSolarActivity internally.
 * Exact card content, conditional formatting for times/classes, error row, bottom note with last update preserved.
 * Non-fatal error handling for regions is already inside the hook.
 */
export function SolarActivity() {
  const solarActivity = useSolarActivity();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
      <div className="section-title flex items-baseline justify-between">
        <span>SOLAR ACTIVITY</span>
        <span className="text-[10px] font-normal text-[#64748b] normal-case tracking-normal">
          Key drivers of geomagnetic activity • Michigan-relevant
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {solarActivity.isLoading ? (
          <LoadingSkeleton variant="metrics" count={4} />
        ) : (
          <>
            {/* 1. Latest Solar Flares (highest priority) */}
            <div className="metric">
              <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                <Zap className="w-4 h-4" /> LATEST FLARE
              </div>
              <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                {solarActivity.latestFlare?.max_class || solarActivity.latestFlare?.current_class || "—"}
              </div>
              <div className="text-sm text-[#64748b] -mt-1">
                {solarActivity.latestFlare?.max_time
                  ? formatDistanceToNow(new Date(solarActivity.latestFlare.max_time), { addSuffix: true })
                  : solarActivity.flareTime
                  ? formatDistanceToNow(new Date(solarActivity.flareTime), { addSuffix: true })
                  : "—"}
                {solarActivity.latestFlare?.region ? ` • Region ${solarActivity.latestFlare.region}` : ""}
              </div>
              <div className="text-[10px] text-[#475569] mt-1">
                Most recent X-ray flare. Earth-facing flares are most relevant for Michigan aurora.
              </div>
            </div>

            {/* 2. Recent / Earth-directed CMEs */}
            <div className="metric">
              <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                <Cloud className="w-4 h-4" /> RECENT CMEs
              </div>
              <div className="text-2xl font-semibold tracking-tighter tabular-nums leading-tight">
                {solarActivity.recentCmes.length > 0
                  ? solarActivity.recentCmes
                      .map((c) => (c.speed ? `${c.speed} km/s` : "CME"))
                      .join(" / ")
                  : "—"}
              </div>
              <div className="text-sm text-[#64748b] -mt-1">
                {solarActivity.recentCmes.length > 0
                  ? solarActivity.recentCmes[0].earthImpact || "Analyzed"
                  : "No recent Earth-directed CMEs reported"}
              </div>
              <div className="text-[10px] text-[#475569] mt-1">
                {solarActivity.recentCmes.length > 0 && solarActivity.recentCmes[0].direction
                  ? `${solarActivity.recentCmes[0].direction} • `
                  : ""}
                Earth-directed CMEs can trigger geomagnetic storms and aurora in 1–3 days.
              </div>
            </div>

            {/* 3. Sunspot Number + trend context */}
            <div className="metric">
              <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                <Sun className="w-4 h-4" /> SUNSPOT NUMBER
              </div>
              <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                {solarActivity.sunspotNumber !== null ? solarActivity.sunspotNumber : "—"}
              </div>
              <div className="text-sm text-[#64748b] -mt-1">
                Total active regions • Higher = more flare/CME potential
              </div>
              <div className="text-[10px] text-[#475569] mt-1">
                Current solar cycle activity level. More sunspots generally mean higher aurora odds over time.
              </div>
              {solarActivity.regionsError && (
                <div className="text-[9px] text-amber-400 mt-0.5">sunspot data delayed</div>
              )}
            </div>

            {/* 4. Coronal Holes (lighter treatment) */}
            <div className="metric">
              <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                <TrendingUp className="w-4 h-4" /> CORONAL HOLES
              </div>
              <div className="text-xl font-semibold tracking-tighter leading-snug">
                Monitor for streams
              </div>
              <div className="text-sm text-[#64748b] -mt-1">
                High-speed wind source
              </div>
              <div className="text-[10px] text-[#475569] mt-1">
                {solarActivity.coronalHoleNote}
              </div>
            </div>
          </>
        )}
      </div>
      {solarActivity.error && (
        <div className="mt-2 text-[10px] text-amber-400">
          Some solar data sources unavailable — using cached values if available.
          {solarActivity.isFetching && ' (retrying…)'}
        </div>
      )}
      <div className="text-[10px] text-[#64748b] mt-2">
        Data from NOAA SWPC • Flares update frequently; CMEs when analyzed; sunspots daily.
        {solarActivity.flareTime && (
          <span className="ml-2">
            Last flare update: {formatDistanceToNow(new Date(solarActivity.flareTime), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  );
}
