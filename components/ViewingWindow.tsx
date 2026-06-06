"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";
import { computeViewingWindow } from "../lib/utils/viewingWindow";
import type { KpForecastEntry } from "../lib/api/schemas";

interface ViewingWindowProps {
  kpForecast: KpForecastEntry[];
  cloudCoverPct?: number | null;
  cloudCoverLabel?: string | null;
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

export function ViewingWindow({ kpForecast, cloudCoverPct, cloudCoverLabel }: ViewingWindowProps) {
  const windowData = useMemo(() => computeViewingWindow(kpForecast), [kpForecast]);

  if (!windowData.hasData) return null;

  const { label, color, guidance } = peakToLabel(windowData.peakKp);
  const hasClear = cloudCoverPct != null;
  const cloudColor = cloudCoverPct == null ? '' : cloudCoverPct < 30 ? '#22c55e' : cloudCoverPct < 60 ? '#eab308' : '#94a3b8';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
      <div className="card p-5 max-w-3xl">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-3 w-3 text-[#64748b]" />
          <span className="uppercase tracking-[2.5px] text-[10px] text-[#64748b]">
            BEST VIEWING WINDOW TONIGHT
          </span>
        </div>

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

            <div className="text-[13px] text-[#94a3b8]">{guidance}</div>

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
              style={{ color }}
            >
              {windowData.peakKp.toFixed(1)}
            </div>
            <div className="text-[11px] font-medium mt-0.5" style={{ color }}>
              {label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
