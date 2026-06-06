"use client";

import { useMemo } from "react";
import type { KpEntry, KpForecastEntry } from "../api/schemas";

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      min: 0,
      max: 9,
      ticks: { color: "#64748b", stepSize: 1, font: { size: 11 } },
      grid: { color: "#1e2937" },
    },
    x: {
      ticks: { color: "#64748b", font: { size: 10 } },
      grid: { color: "#1e2937" },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0f1425",
      borderColor: "#1e2937",
      borderWidth: 1,
      titleColor: "#f1f5f9",
      bodyColor: "#cbd5e1",
    },
  },
};

// Michigan is Eastern Time: UTC-5 (EST, roughly Nov–Mar) or UTC-4 (EDT, roughly Mar–Nov).
// "Tonight" for aurora watching = local 20:00 (8 pm) through 05:59 (5:59 am next morning).
function isTonightMichigan(utcDate: Date): boolean {
  const month = utcDate.getUTCMonth(); // 0 = Jan
  const isDst = month >= 2 && month <= 10; // approximate: Mar–Nov
  const localHour = (utcDate.getUTCHours() - (isDst ? 4 : 5) + 24) % 24;
  return localHour >= 20 || localHour < 6;
}

// Inline Chart.js plugin that shades contiguous "tonight" columns with a soft violet tint.
// Uses beforeDraw so the shading sits behind the line and points.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTonightPlugin(tonightMask: boolean[]): Record<string, any> {
  return {
    id: "tonightShade",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeDraw(chart: any) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;

      const n = tonightMask.length;
      if (n < 2 || tonightMask.every((v) => !v)) return;

      // Half-tick width: used to extend shading to the edges of the first/last tonight point.
      const spacing = Math.abs(
        scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0)
      );
      const half = spacing / 2;

      ctx.save();
      ctx.fillStyle = "rgba(139, 92, 246, 0.08)"; // subtle violet — matches aurora violet accent

      // Walk the mask and draw one filled rect per contiguous tonight block.
      let blockStart: number | null = null;
      for (let i = 0; i <= n; i++) {
        const tonight = i < n && tonightMask[i];
        if (tonight && blockStart === null) {
          blockStart = i;
        } else if (!tonight && blockStart !== null) {
          const x0 = scales.x.getPixelForValue(blockStart) - half;
          const x1 = scales.x.getPixelForValue(i - 1) + half;
          ctx.fillRect(x0, chartArea.top, x1 - x0, chartArea.height);
          blockStart = null;
        }
      }

      ctx.restore();
    },
  };
}

function formatTimeLabel(timeTag: string, referenceUtcDate: string): string {
  const d = new Date(timeTag);
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  const entryDate = d.toLocaleDateString("en-US", { timeZone: "UTC" });
  if (entryDate !== referenceUtcDate) {
    const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    return `${day} ${time}`;
  }
  return time;
}

export function useChartData(kpHistory: KpEntry[], kpForecast: KpForecastEntry[] = []) {
  return useMemo(() => {
    // Last ~12 entries (~36 hours of 3h Kp data); drop entries with no valid timestamp
    const recent = kpHistory
      .filter((entry) => !!entry.time_tag && !isNaN(new Date(entry.time_tag).getTime()))
      .slice(-12);

    // Reference UTC date for label formatting (prevents "Mon 14:00" prefix on same-day entries)
    const todayUtc =
      recent.length > 0
        ? new Date(recent[recent.length - 1].time_tag!).toLocaleDateString("en-US", {
            timeZone: "UTC",
          })
        : "";

    const historicalLabels = recent.map((e) => formatTimeLabel(e.time_tag!, todayUtc));
    const historicalValues = recent.map((entry) => entry.Kp ?? 0);
    const historicalTonightMask = recent.map((e) => isTonightMichigan(new Date(e.time_tag!)));

    // Filter forecast to only entries AFTER the last historical point
    const lastHistoricalTime =
      recent.length > 0 ? new Date(recent[recent.length - 1].time_tag!).getTime() : 0;

    const futureForecast = kpForecast
      .filter(
        (e) => !!e.time_tag && !isNaN(new Date(e.time_tag).getTime()) &&
          new Date(e.time_tag).getTime() > lastHistoricalTime
      )
      .slice(0, 12); // next 36 hours

    const forecastLabels = futureForecast.map((e) => formatTimeLabel(e.time_tag!, todayUtc));
    const forecastValues = futureForecast.map((e) => e.kp ?? 0);
    const forecastTonightMask = futureForecast.map((e) => isTonightMichigan(new Date(e.time_tag!)));

    const fullMask = [...historicalTonightMask, ...forecastTonightMask];
    const hasTonight = fullMask.some((v) => v);

    // Pad datasets so both span the full label array
    const histPad = Array<null>(futureForecast.length).fill(null);
    const fcstPad = Array<null>(recent.length).fill(null);

    const histDataset = {
      label: "Kp Index",
      data: [...historicalValues, ...histPad] as (number | null)[],
      borderColor: "#22c55e",
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 2.5,
      pointHoverRadius: 4,
      pointBackgroundColor: "#22c55e",
      spanGaps: false,
    };

    const fcstDataset =
      futureForecast.length > 0
        ? {
            label: "Forecast",
            data: [...fcstPad, ...forecastValues] as (number | null)[],
            borderColor: "#475569",
            backgroundColor: "rgba(71, 85, 105, 0.06)",
            borderWidth: 1.5,
            borderDash: [5, 4],
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 3,
            pointBackgroundColor: "#475569",
            spanGaps: false,
          }
        : null;

    const chartData = {
      labels: [...historicalLabels, ...forecastLabels],
      datasets: fcstDataset ? [histDataset, fcstDataset] : [histDataset],
    };

    return {
      chartData,
      chartOptions: CHART_OPTIONS,
      tonightPlugin: makeTonightPlugin(fullMask),
      hasTonight,
      hasForecast: futureForecast.length > 0,
    };
  }, [kpHistory, kpForecast]);
}
