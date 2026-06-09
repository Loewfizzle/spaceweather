"use client";

import { useMemo, useState } from "react";
import { Clock, ChevronRight } from "lucide-react";
import { computeViewingWindow, computeLastNightPeak, type ViewingWindowData } from "../lib/utils/viewingWindow";
import { cloudCoverColor, getKpTier, AURORA_TIERS } from "../lib/aurora/kp";
import { useUserLocationContext } from "../lib/context/UserLocationContext";
import { ViewingWindowModal } from "./solar/ViewingWindowModal";
import type { KpEntry, KpForecastEntry } from "../lib/api/schemas";

interface ViewingWindowProps {
  kpForecast: KpForecastEntry[];
  kpHistory: KpEntry[];
  cloudCoverPct?: number | null;
  cloudCoverLabel?: string | null;
  locationGranted?: boolean;
  isLoading?: boolean;
  viewingWindow?: ViewingWindowData | null;
  kp?: number | null;
}

function formatET(date: Date): string {
  return date
    .toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    // Strip ":00" only when immediately before AM/PM — avoids matching the wrong ":00"
    // if the locale ever includes seconds or other colons in the output.
    .replace(/:00\s*([AP]M)/i, " $1")
    .trim();
}

function peakToLabel(kp: number): { label: string; color: string; guidance: string } {
  const tier = getKpTier(kp);
  const { color, label } = AURORA_TIERS[tier];
  // All guidance strings use forecast/future language to distinguish from live
  // "Current Conditions" — these reflect what's expected later tonight, not right now.
  const guidance =
    tier === "storm"    ? "Strong aurora forecast — may be visible to the naked eye tonight." :
    tier === "active"   ? "Active conditions expected — dark skies are worth it tonight." :
    tier === "moderate" ? "Moderate activity forecast — dark rural skies give your best chance." :
                          "Quiet conditions forecast. Low aurora activity expected tonight.";
  return { label, color, guidance };
}

export function ViewingWindow({ kpForecast, kpHistory, cloudCoverPct, cloudCoverLabel, locationGranted, isLoading, viewingWindow: viewingWindowProp, kp }: ViewingWindowProps) {
  const windowData = useMemo(
    () => viewingWindowProp ?? computeViewingWindow(kpForecast),
    [viewingWindowProp, kpForecast]
  );
  const lastNight = useMemo(() => computeLastNightPeak(kpHistory), [kpHistory]);
  const { userLat, userLocationLabel } = useUserLocationContext();
  const [showModal, setShowModal] = useState(false);

  if (!windowData.hasData && !lastNight) {
    if (isLoading) return (
      <div className="card p-5 animate-pulse">
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
    );
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-3 w-3 text-[#64748b]" />
          <span className="uppercase tracking-[2.5px] text-[10px] text-[#64748b]">
            TONIGHT&apos;S FORECAST
          </span>
        </div>
        <p className="text-sm text-[#475569]">
          No forecast data available for tonight&apos;s viewing window.
        </p>
      </div>
    );
  }

  const tonight = windowData.hasData ? peakToLabel(windowData.peakKp) : null;
  const hasClear = cloudCoverPct != null;
  const cloudColor = cloudCoverPct == null ? '' : cloudCoverColor(cloudCoverPct);
  const lastNightLabel = lastNight ? peakToLabel(lastNight.peakKp) : null;

  return (
    <>
      <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-[#64748b]" />
              <span className="uppercase tracking-[2.5px] text-[10px] text-[#64748b]">
                TONIGHT&apos;S FORECAST
              </span>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
            >
              Details <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-[#475569] mb-3">
            36-hr NOAA Kp forecast — may differ from current conditions above
          </p>

          {tonight && (
            <div className="flex items-start justify-between gap-4">
              <div>
                {windowData.windowStart && windowData.windowEnd ? (() => {
                  const startStr = formatET(windowData.windowStart!);
                  const endStr   = formatET(windowData.windowEnd!);
                  return (
                    <div className="text-xl font-semibold text-white tracking-tight mb-1">
                      {startStr} – {endStr}
                      <span className="text-[#64748b] text-sm font-normal ml-1.5">ET</span>
                    </div>
                  );
                })() : null}

                <div className="text-[13px] text-[#94a3b8]">{tonight.guidance}</div>

                {/* When location is shared, show personalised sky conditions */}
                {locationGranted && hasClear && (
                  <div className="mt-2 text-[11px]">
                    <span className="text-[#64748b]">Your skies tonight: </span>
                    <span className="font-medium" style={{ color: cloudColor }}>
                      {cloudCoverLabel} ({cloudCoverPct}%)
                    </span>
                  </div>
                )}
                {/* When location is not shared, surface a gentle nudge */}
                {!locationGranted && (
                  <div className="mt-2 text-[11px] text-[#334155]">
                    Share location for personalised sky conditions
                  </div>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-[10px] text-[#64748b] mb-0.5">Forecast peak</div>
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

          {lastNight && lastNightLabel ? (
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
          ) : !isLoading ? (
            <div className={`text-[12px] text-[#475569] ${tonight ? 'mt-4 pt-4 border-t border-[#1e2937]' : ''}`}>
              Last night: no data available
            </div>
          ) : null}
      </div>

      {showModal && (
        <ViewingWindowModal
          kp={kp ?? null}
          peakKp={windowData.hasData ? windowData.peakKp : 0}
          cloudCoverPct={cloudCoverPct}
          cloudCoverLabel={cloudCoverLabel}
          userLat={userLat}
          userLocationLabel={userLocationLabel}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
