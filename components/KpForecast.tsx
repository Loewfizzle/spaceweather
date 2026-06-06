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
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorState } from "./ErrorState";
import type { KpEntry, KpForecastEntry } from "../lib/api/schemas";

// Register Chart.js components once (when this module is first imported)
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
  michiganGuidance: string;
}

interface StormDay {
  date: string;
  maxKp: number;
}

function kpToStormLabel(kp: number): { label: string; color: string } {
  if (kp >= 7) return { label: "G3+ Storm", color: "#22c55e" };
  if (kp >= 6) return { label: "G2 Storm", color: "#22c55e" };
  if (kp >= 5) return { label: "G1 Storm", color: "#86efac" };
  if (kp >= 4) return { label: "Active", color: "#eab308" };
  if (kp >= 3) return { label: "Unsettled", color: "#94a3b8" };
  return { label: "Quiet", color: "#475569" };
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

export function KpForecast({ michiganGuidance }: KpForecastProps) {
  const kpQuery = useKpData();
  const forecastQuery = useKpForecast();

  const kpHistory = (kpQuery.data || []) as KpEntry[];
  const kpForecastData = (forecastQuery.data || []) as KpForecastEntry[];

  const { chartData, chartOptions, tonightPlugin, hasTonight, hasForecast } =
    useChartData(kpHistory, kpForecastData);

  const stormDays = useStormDays(kpForecastData);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="section-title">KP OUTLOOK + MICHIGAN FORECAST</div>
      <div className="card p-6">
        <div className="h-56">
          {kpQuery.isLoading ? (
            <div className="h-full animate-pulse bg-[#1e2937] rounded" />
          ) : kpQuery.error ? (
            <ErrorState
              message="Unable to load Kp outlook data right now."
              onRetry={kpQuery.refetch}
            />
          ) : kpHistory.length > 0 ? (
            <Line
              data={chartData}
              options={chartOptions}
              plugins={[tonightPlugin as Plugin<"line">]}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[#64748b]">
              No recent Kp data
            </div>
          )}
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-4 text-sm">
          <div className="text-[#cbd5e1]">
            <span className="font-medium text-white">Tonight (Michigan):</span>{" "}
            {michiganGuidance}
          </div>
          <div className="text-[#cbd5e1]">
            <span className="font-medium text-white">Recent trend:</span>{" "}
            {kpHistory.length > 1 ? (
              (kpHistory[kpHistory.length - 1].Kp ?? 0) >
              (kpHistory[kpHistory.length - 2].Kp ?? 0)
                ? "Rising — elevated activity possible if trend continues."
                : "Stable or declining — conditions quieting."
            ) : (
              "Based on current solar wind and Bz."
            )}
          </div>
        </div>

        <div className="mt-3 text-[10px] text-[#64748b]">
          Chart shows last ~36 hours of 3-hour Kp values
          {hasForecast && " plus 36-hour NOAA forecast (dashed)"}
          {hasTonight && ". Shaded area = tonight (Michigan time, 8 pm–6 am ET)"}
          {"."}
          {forecastQuery.error && !hasForecast && (
            <span className="ml-2 text-amber-400/70">Forecast temporarily unavailable.</span>
          )}
        </div>

        {/* 3-Day Storm Outlook derived from NOAA Kp forecast */}
        {stormDays.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[#1e2937]">
            <div className="uppercase tracking-[2px] text-[10px] text-[#64748b] mb-3">
              3-DAY MAX KP FORECAST
            </div>
            <div className="grid grid-cols-3 gap-3">
              {stormDays.map(({ date, maxKp }) => {
                const { label, color } = kpToStormLabel(maxKp);
                return (
                  <div key={date} className="rounded-lg bg-[#0a0e1a] border border-[#1e2937] p-3">
                    <div className="text-[10px] text-[#64748b] mb-1.5">{date}</div>
                    <div
                      className="text-2xl font-semibold tabular-nums leading-none mb-1"
                      style={{ color }}
                    >
                      {maxKp.toFixed(1)}
                    </div>
                    <div className="text-[11px] font-medium" style={{ color }}>
                      {label}
                    </div>
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
