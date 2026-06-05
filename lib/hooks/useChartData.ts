"use client";

import { useMemo } from "react";
import type { KpEntry } from "../api/schemas";

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

export function useChartData(kpHistory: KpEntry[]) {
  return useMemo(() => {
    // Last ~12 entries (~36 hours of 3h Kp data); drop entries with no valid timestamp
    const recent = kpHistory
      .filter((entry) => !!entry.time_tag && !isNaN(new Date(entry.time_tag).getTime()))
      .slice(-12);

    // Entries from an earlier UTC date get a "Mon 14:00" prefix so the 36h window
    // doesn't look like a single-day chart when it spans midnight.
    const todayUtc =
      recent.length > 0
        ? new Date(recent[recent.length - 1].time_tag!).toLocaleDateString("en-US", {
            timeZone: "UTC",
          })
        : "";
    const labels = recent.map((entry) => {
      const d = new Date(entry.time_tag!);
      const time = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      });
      const entryDate = d.toLocaleDateString("en-US", { timeZone: "UTC" });
      if (entryDate !== todayUtc) {
        const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
        return `${day} ${time}`;
      }
      return time;
    });

    const values = recent.map((entry) => entry.Kp ?? 0);

    // Which entries fall in Michigan's overnight aurora window (8 pm – 6 am ET)?
    const tonightMask = recent.map((entry) => isTonightMichigan(new Date(entry.time_tag!)));
    const hasTonight = tonightMask.some((v) => v);

    const chartData = {
      labels,
      datasets: [
        {
          label: "Kp Index",
          data: values,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.15)",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 2.5,
          pointHoverRadius: 4,
          pointBackgroundColor: "#22c55e",
        },
      ],
    };

    return {
      chartData,
      chartOptions: CHART_OPTIONS,
      tonightPlugin: makeTonightPlugin(tonightMask),
      hasTonight,
    };
  }, [kpHistory]);
}
