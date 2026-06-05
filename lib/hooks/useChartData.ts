"use client";

import { useMemo } from "react";
import type { KpEntry } from "../api/schemas";

/**
 * useChartData
 * Prepares the limited recent Kp slice + Chart.js data + options objects for the Kp outlook timeline.
 * Exact logic and styling (colors, tension, scales, dark theme tooltips) preserved from original god component.
 * No side effects; pure derived + memoized for render perf.
 */
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

export function useChartData(kpHistory: KpEntry[]) {
  const chartData = useMemo(() => {
    // Last ~12 entries (~36 hours of 3h Kp data); drop entries with no valid timestamp
    const recent = kpHistory
      .filter((entry) => !!entry.time_tag && !isNaN(new Date(entry.time_tag).getTime()))
      .slice(-12);

    // Entries from an earlier UTC date get a "Mon 14:00" prefix so the 36h window
    // doesn't look like a single-day chart when it spans midnight.
    const todayUtc = recent.length > 0
      ? new Date(recent[recent.length - 1].time_tag!).toLocaleDateString("en-US", { timeZone: "UTC" })
      : "";
    const labels = recent.map((entry) => {
      const d = new Date(entry.time_tag!);
      const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
      const entryDate = d.toLocaleDateString("en-US", { timeZone: "UTC" });
      if (entryDate !== todayUtc) {
        const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
        return `${day} ${time}`;
      }
      return time;
    });
    const values = recent.map((entry) => entry.Kp ?? 0);

    return {
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
  }, [kpHistory]);

  return { chartData, chartOptions: CHART_OPTIONS };
}
