"use client";

import { Wind, Zap, Activity, Satellite } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LoadingSkeleton } from "./LoadingSkeleton";

interface CurrentConditionsProps {
  solarWindSpeed: number | null;
  solarWindDensity: number | null;
  bz: number | null;
  kp: number | null;
  maxAuroraProbNA: number | null;
  isLoading: boolean;
  kpTime?: string | null;
  solarWindError?: unknown;
  ovationProcessed?: boolean;
}

export function CurrentConditions({
  solarWindSpeed,
  solarWindDensity,
  bz,
  kp,
  maxAuroraProbNA,
  isLoading,
  kpTime,
  solarWindError,
  ovationProcessed,
}: CurrentConditionsProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
      <div className="section-title flex items-baseline justify-between">
        <span>CURRENT CONDITIONS</span>
        <span className="text-[10px] font-normal text-[#64748b] normal-case tracking-normal">
          {kpTime ? `updated ${formatDistanceToNow(new Date(kpTime), { addSuffix: true })}` : 'syncing…'} • auto
        </span>
      </div>
      {isLoading ? (
        <LoadingSkeleton variant="metrics" count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="metric">
              <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                <Wind className="w-4 h-4" /> SOLAR WIND
              </div>
              <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                {solarWindSpeed !== null ? Math.round(solarWindSpeed) : "—"}
              </div>
              <div className="text-sm text-[#64748b] -mt-1">
                km/s{" "}
                <span className="text-xs ml-1">
                  • {solarWindDensity !== null ? solarWindDensity.toFixed(1) : "—"} p/cm³
                </span>
              </div>
              {!!solarWindError && (
                <div className="text-[9px] text-amber-400 mt-0.5">data delayed</div>
              )}
            </div>

            <div className="metric">
              <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                <Zap className="w-4 h-4" /> IMF Bz
              </div>
              <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                {bz !== null ? bz.toFixed(1) : "—"}
              </div>
              <div className="text-sm text-[#64748b] -mt-1">
                nT <span className="text-xs ml-1">• Southward = favorable</span>
              </div>
            </div>

            <div className="metric">
              <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                <Activity className="w-4 h-4" /> PLANETARY Kp
              </div>
              <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                {kp !== null ? kp.toFixed(1) : "—"}
              </div>
              <div className="text-sm text-[#64748b] -mt-1">Latest 3-hour • {kp !== null && kp < 4 ? "Quiet" : "Active"}</div>
            </div>

            <div className="metric">
              <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
                <Satellite className="w-4 h-4" /> OVATION (NA)
              </div>
              <div className="text-4xl font-semibold tracking-tighter tabular-nums">
                {ovationProcessed && maxAuroraProbNA !== null ? `${Math.round(maxAuroraProbNA)}%` : "—"}
              </div>
              <div className="text-sm text-[#64748b] -mt-1">
                {ovationProcessed === false
                  ? "Temporarily unavailable"
                  : maxAuroraProbNA === 0
                  ? "Quiet — aurora oval outside NA"
                  : "Max probability (North America)"}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
