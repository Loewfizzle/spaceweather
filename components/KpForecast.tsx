"use client";

import { useMemo } from "react";
import { useKpData, useKpForecast } from "../lib/use-noaa-data";
import { useChartData } from "../lib/hooks/useChartData";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type Plugin,
} from "chart.js";
import { ErrorState } from "./ErrorState";
import type { KpEntry, KpForecastEntry } from "../lib/api/schemas";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface KpForecastProps {
  guidance: string;
}

interface StormDay {
  date: string;
  maxKp: number;
}

// Colors match AURORA_TIERS: storm=#a78bfa, active=#f97316, moderate=#eab308
// Labels omit the "Storm" suffix — G1/G2/G3+ are storm designations by definition,
// and the suffix varying length ("G3+ Storm" vs "G2 Storm") breaks badge uniformity.
function kpToStormLabel(kp: number): { label: string; color: string } {
  if (kp >= 7) return { label: "G3+",       color: "#a78bfa" };
  if (kp >= 6) return { label: "G2",        color: "#a78bfa" };
  if (kp >= 5) return { label: "G1",        color: "#f97316" };
  if (kp >= 4) return { label: "Active",    color: "#eab308" };
  if (kp >= 3) return { label: "Unsettled", color: "#94a3b8" };
  return       { label: "Quiet",            color: "#475569" };
}

function useStormDays(kpForecast: KpForecastEntry[]): StormDay[] {
  return useMemo(() => {
    if (kpForecast.length === 0) return [];
    const now = new Date();
    const byDay: Record<string, number[]> = {};

    for (const entry of kpForecast) {
      if (!entry.time_tag) continue;
      const t = new Date(entry.time_tag);
      if (t <= now) continue;
      const key = t.toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      });
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(entry.kp ?? 0);
    }

    return Object.entries(byDay)
      .slice(0, 3)
      .map(([date, vals]) => ({
        date,
        maxKp: Math.max(...vals),
      }));
  }, [kpForecast]);
}

export function KpForecast({ guidance }: KpForecastProps) {
  const kpQuery = useKpData();
  const forecastQuery = useKpForecast();

  const kpHistory = (kpQuery.data || []) as KpEntry[];
  const kpForecastData = (forecastQuery.data || []) as KpForecastEntry[];

  const { chartData, chartOptions, chartPlugins, hasTonight, hasForecast } =
    useChartData(kpHistory, kpForecastData);

  const stormDays = useStormDays(kpForecastData);

  const trend =
    kpHistory.length > 1
      ? (kpHistory[kpHistory.length - 1].Kp ?? 0) >
        (kpHistory[kpHistory.length - 2].Kp ?? 0)
        ? "Rising — elevated activity possible if trend continues."
        : "Stable or declining — conditions quieting."
      : "Based on current solar wind and Bz.";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="section-title">KP INDEX &amp; OUTLOOK</div>
      <div className="card p-6">
        <div className="h-56">
          {kpQuery.isLoading ? (
            <div className="h-full animate-pulse bg-[#1e2937] rounded" />
          ) : kpQuery.error ? (
            <ErrorState
              message="Unable to load Kp data right now."
              onRetry={kpQuery.refetch}
              standalone={false}
            />
          ) : kpHistory.length > 0 ? (
            <Line
              data={chartData}
              options={chartOptions}
              plugins={chartPlugins as Plugin<"line">[]}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[#64748b]">
              No recent Kp data
            </div>
          )}
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-4 text-sm">
          <div className="text-[#94a3b8]">
            <span className="font-medium text-white">Outlook:</span>{" "}
            {guidance}
          </div>
          <div className="text-[#94a3b8]">
            <span className="font-medium text-white">Trend:</span>{" "}
            {trend}
          </div>
        </div>

        <div className="mt-3 text-[10px] text-[#475569] space-y-1">
          <div>
            Solid line = recent observations · Dashed = NOAA 36-hr forecast
            {hasTonight && " · Shaded = tonight's viewing window"}
            {"."}
            {forecastQuery.error && !hasForecast && (
              <span className="ml-2 text-amber-400/70">Forecast temporarily unavailable.</span>
            )}
          </div>
          <div>G1 aurora at Kp&nbsp;5 · G2 at Kp&nbsp;6 · G3+ storm at Kp&nbsp;7</div>
        </div>

        {/* 3-Day Storm Outlook */}
        {(forecastQuery.isLoading || forecastQuery.error || stormDays.length > 0) && (
          <div className="mt-5 pt-5 border-t border-[#1e2937]">
            <div className="uppercase tracking-[2px] text-[10px] text-[#64748b] mb-3">
              {forecastQuery.isLoading ? (
                <div className="h-2.5 w-32 rounded animate-pulse bg-[#1e2937]" />
              ) : (
                "3-DAY STORM OUTLOOK"
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {forecastQuery.isLoading
                ? [0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg bg-[#0a0e1a] border border-[#1e2937] p-3">
                      <div className="h-2.5 w-10 rounded animate-pulse bg-[#1e2937] mb-3" />
                      <div className="h-7 w-8 rounded animate-pulse bg-[#1e2937] mb-2" />
                      <div className="h-2.5 w-14 rounded animate-pulse bg-[#1e2937]" />
                    </div>
                  ))
                : forecastQuery.error && stormDays.length === 0
                ? (
                    <div className="col-span-3 text-[11px] text-amber-400/70 py-1">
                      Forecast temporarily unavailable.{" "}
                      <button
                        onClick={() => forecastQuery.refetch()}
                        className="underline underline-offset-2 hover:text-amber-400 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )
                : stormDays.map(({ date, maxKp }) => {
                    const { label, color } = kpToStormLabel(maxKp);
                    return (
                      <div
                        key={date}
                        className="rounded-lg bg-[#0a0e1a] border border-[#1e2937] p-3"
                        style={{ borderLeftColor: color, borderLeftWidth: "3px" }}
                      >
                        <div className="text-[10px] text-[#64748b] mb-2">{date}</div>
                        <div
                          className="text-2xl font-bold tabular-nums leading-none mb-2"
                          style={{ color }}
                        >
                          {maxKp.toFixed(1)}
                        </div>
                        <span
                          className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            color,
                            backgroundColor: color + "1a",
                            border: `1px solid ${color}33`,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
