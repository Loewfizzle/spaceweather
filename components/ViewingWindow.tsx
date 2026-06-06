"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";
import { computeViewingWindow, computeLastNightPeak } from "../lib/utils/viewingWindow";
import type { KpEntry, KpForecastEntry } from "../lib/api/schemas";

interface ViewingWindowProps {
  kpForecast: KpForecastEntry[];
  kpHistory: KpEntry[];
  cloudCoverPct?: number | null;
  cloudCoverLabel?: string | null;
  isLoading?: boolean;
}

function formatET(date: Date): string {
  return date
    .toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(":00", ""); // "11 pm" not "11:00 pm"
}

function peakToLabel(kp: number): { label: string; color: string; guidance: string } {
  if (kp >= 5)
    return { label: "Aurora likely", color: "#22c55e", guidance: "Get outside and look north." };
  if (kp >= 4)
    return { label: "Active", color: "#86efac", guidance: "Worth watching from dark skies." };
  if (kp >= 3)
    return { label: "Low activity", color: "#eab308", guidance: "Best chance from rural areas." };
  return { label: "Quiet", color: "#475569", guidance: "Calm conditions expected." };
}

export function ViewingWindow({ kpForecast, kpHistory, cloudCoverPct, cloudCoverLabel, isLoading }: ViewingWindowProps) {
  const windowData = useMemo(() => computeViewingWindow(kpForecast), [kpForecast]);
  const lastNight = useMemo(() => computeLastNightPeak(kpHistory), [kpHistory]);

  if (!windowData.hasData && !lastNight) {
    if (!isLoading) return null;
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
        <div className="card p-5 max-w-3xl animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 rounded bg-[#1e2937]" />
            <div className="h-2.5 w-40 rounded bg-[#1e2937]" />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 rounded bg-[#1e2937]" />
              <div className="h-3 w-56 rounded bg-[#1e2937]" />
            </div>
            <div className="h-10 w-12 rounded bg-[#1e2937]" />
          </div>
        </div>
      </div>
    );
  }

  const tonight = windowData.hasData ? peakToLabel(windowData.peakKp) : null;
  const hasClear = cloudCoverPct != null;
  const cloudColor = cloudCoverPct == null ? '' : cloudCoverPct < 30 ? '#22c55e' : cloudCoverPct < 60 ? '#eab308' : '#94a3b8';
  const lastNightLabel = lastNight ? peakToLabel(lastNight.peakKp) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
      <div className="card p-5 max-w-3xl">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-3 w-3 text-[#64748b]" />
          <span className="uppercase tracking-[2.5px] text-[10px] text-[#64748b]">
            BEST VIEWING WINDOW TONIGHT
          </span>
        </div>

        {tonight && (
          <div className="flex items-start justify-between gap-4">
            <div>
              {windowData.windowStart && windowData.windowEnd ? (
                <div className="text-xl font-semibold text-white tracking-tight mb-1">
                  {formatET(windowData.windowStart)}
                  {" – "}
                  {formatET(windowData.windowEnd)}
                  <span className="text-[#64748b] text-sm font-normal ml-1.5">ET</span>
                </div>
              ) : null}

              <div className="text-[13px] text-[#94a3b8]">{tonight.guidance}</div>

              {hasClear && (
                <div className="mt-2 text-[11px]">
                  <span className="text-[#64748b]">Skies: </span>
                  <span className="font-medium" style={{ color: cloudColor }}>
                    {cloudCoverLabel} ({cloudCoverPct}%)
                  </span>
                </div>
              )}
            </div>

            <div className="text-right flex-shrink-0">
              <div className="text-[10px] text-[#64748b] mb-0.5">Peak Kp</div>
              <div
                className="text-3xl font-bold tabular-nums leading-none"
                style={{ color: tonight.color }}
              >
                {windowData.peakKp.toFixed(1)}
              </div>
              <div className="text-[11px] font-medium mt-0.5" style={{ color: tonight.color }}>
                {tonight.label}
              </div>
            </div>
          </div>
        )}

        {lastNight && lastNightLabel && (
          <div className={`flex items-center justify-between text-[12px] ${tonight ? 'mt-4 pt-4 border-t border-[#1e2937]' : ''}`}>
            <div>
              <span className="text-[#64748b]">Last night — </span>
              <span className="text-[#94a3b8]">
                peaked at {formatET(lastNight.peakTime)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 tabular-nums">
              <span className="font-semibold" style={{ color: lastNightLabel.color }}>
                Kp {lastNight.peakKp.toFixed(1)}
              </span>
              <span style={{ color: lastNightLabel.color }} className="text-[11px]">
                — {lastNightLabel.label}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
