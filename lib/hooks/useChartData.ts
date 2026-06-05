"use client";

import { useMemo } from "react";
import type { KpEntry } from "../api/schemas";

/**
 * useChartData
 * Prepares the limited recent Kp slice + Chart.js data + options objects for the Kp outlook timeline.
 * Exact logic and styling (colors, tension, scales, dark theme tooltips) preserved from original god component.
 * No side effects; pure derived + memoized for render perf.
 */
export function useChartData(kpHistory: KpEntry[]) {
  const chartData = useMemo(() => {
    // Last ~12 entries (~36 hours of 3h Kp data)
    const recent = kpHistory.slice(-12);
    const labels = recent.map((entry) => {
      const d = new Date(entry.time_tag || "");
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  const chartOptions = {
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

  return { chartData, chartOptions };
}
