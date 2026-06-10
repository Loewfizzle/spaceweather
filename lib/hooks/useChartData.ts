"use client";

import { useMemo } from "react";
import type { KpEntry, KpForecastEntry } from "../api/schemas";
import { normalizeTimeTag } from "../utils/viewingWindow";

// ── Helpers ───────────────────────────────────────────────────────────────────

function kpTierLabel(kp: number): string {
  if (kp >= 7) return 'Storm';
  if (kp >= 5) return 'Active';
  if (kp >= 4) return 'Moderate';
  if (kp >= 3) return 'Unsettled';
  return 'Quiet';
}

// "Tonight" for aurora watching = 20:00–05:59 Eastern Time.
// Uses direct millisecond offset to avoid Intl hour12:false returning 24 for midnight.
function isDST(date: Date): boolean {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(date).includes('EDT');
}

function isTonightAuroraWindow(utcDate: Date): boolean {
  const ET_OFFSET_MS = isDST(utcDate) ? -4 * 3600000 : -5 * 3600000;
  const etMs = utcDate.getTime() + ET_OFFSET_MS;
  const etHour = Math.floor((etMs % 86400000) / 3600000 + 24) % 24;
  return etHour >= 20 || etHour < 6;
}

// ── Chart options — module-level constant (no data-dependent values) ─────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHART_OPTIONS: Record<string, any> = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      min: 0,
      max: 9,
      ticks: {
        color: "#64748b",
        font: { size: 11 },
        // Only label values that map to meaningful activity thresholds
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (value: any) =>
          [0, 2, 4, 5, 7].includes(Number(value)) ? String(value) : '',
      },
      grid: {
        // Subtle color accent at the two key aurora onset thresholds
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        color: (context: any) => {
          const v = context.tick?.value;
          if (v === 5) return "rgba(234, 179, 8, 0.22)";  // yellow — active onset (G1)
          if (v === 4) return "rgba(34, 197, 94, 0.18)";  // green  — moderate onset
          return "#171f2e";
        },
      },
    },
    x: {
      ticks: { color: "#64748b", font: { size: 10 }, maxRotation: 0 },
      grid: { color: "#171f2e" },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0d1425",
      borderColor: "#1e2937",
      borderWidth: 1,
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 10,
      callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        label: (context: any) => {
          const val = context.parsed?.y;
          if (val === null || val === undefined) return '';
          const isForecast = context.dataset.label === 'Forecast';
          const prefix = isForecast ? '◌ Forecast' : '● Kp';
          return ` ${prefix} ${(val as number).toFixed(1)} — ${kpTierLabel(val as number)}`;
        },
      },
    },
  },
};

// ── Plugins ───────────────────────────────────────────────────────────────────

// Shades contiguous "tonight" columns with a soft violet tint.
// Runs beforeDraw so the shading sits behind the line and points.
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

      const spacing = Math.abs(
        scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0)
      );
      const half = spacing / 2;

      ctx.save();
      ctx.fillStyle = "rgba(139, 92, 246, 0.07)";

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

// Draws a subtle vertical boundary line + "FORECAST →" label at the point
// where historical data ends and NOAA forecast begins.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeForecastBoundaryPlugin(splitIdx: number): Record<string, any> {
  return {
    id: "forecastBoundary",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    afterDraw(chart: any) {
      if (splitIdx <= 0) return;
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;

      // Place the line midway between last historical point and first forecast point
      const xL = scales.x.getPixelForValue(splitIdx - 1);
      const xR = scales.x.getPixelForValue(splitIdx);
      const x = (xL + xR) / 2;

      ctx.save();
      ctx.strokeStyle = "#293548";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "9px system-ui, sans-serif";
      ctx.fillStyle = "#3d5068";
      ctx.textAlign = "left";
      ctx.fillText("FORECAST →", x + 5, chartArea.top + 13);
      ctx.restore();
    },
  };
}

// ── Label formatter ───────────────────────────────────────────────────────────

function formatTimeLabel(timeTag: string, referenceUtcDate: string): string {
  const d = new Date(normalizeTimeTag(timeTag));
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

// ── Core computation (exported for unit tests) ────────────────────────────────

export function buildChartData(kpHistory: KpEntry[], kpForecast: KpForecastEntry[] = []) {
  // Last ~12 entries (~36 hours of 3h Kp data); skip entries with null Kp so
  // they don't coerce to 0 and create spurious dips on the chart.
  const recent = kpHistory
    .filter((entry) => !!entry.time_tag && entry.Kp != null && !isNaN(new Date(normalizeTimeTag(entry.time_tag)).getTime()))
    .slice(-12);

  const todayUtc =
    recent.length > 0
      ? new Date(normalizeTimeTag(recent[recent.length - 1].time_tag!)).toLocaleDateString("en-US", {
          timeZone: "UTC",
        })
      : "";

  const historicalLabels = recent.map((e) => formatTimeLabel(e.time_tag!, todayUtc));
  const historicalValues = recent.map((entry) => entry.Kp!);
  const historicalTonightMask = recent.map((e) => isTonightAuroraWindow(new Date(normalizeTimeTag(e.time_tag!))));

  const lastHistoricalTime =
    recent.length > 0 ? new Date(normalizeTimeTag(recent[recent.length - 1].time_tag!)).getTime() : 0;

  const futureForecast = kpForecast
    .filter(
      (e) =>
        !!e.time_tag &&
        e.kp != null &&
        e.observed !== 'observed' &&
        !isNaN(new Date(normalizeTimeTag(e.time_tag)).getTime()) &&
        new Date(normalizeTimeTag(e.time_tag)).getTime() > lastHistoricalTime,
    )
    .slice(0, 12); // next 36 hours

  const forecastLabels = futureForecast.map((e) => formatTimeLabel(e.time_tag!, todayUtc));
  const forecastValues = futureForecast.map((e) => e.kp!);
  const forecastTonightMask = futureForecast.map((e) => isTonightAuroraWindow(new Date(normalizeTimeTag(e.time_tag!))));

  const fullMask = [...historicalTonightMask, ...forecastTonightMask];
  const hasTonight = fullMask.some((v) => v);

  // Pad datasets so both span the full label array
  const histPad = Array<null>(futureForecast.length).fill(null);
  const fcstPad = Array<null>(recent.length).fill(null);

  const histDataset = {
    label: "Kp Index",
    data: [...historicalValues, ...histPad] as (number | null)[],
    borderColor: "#22c55e",
    backgroundColor: "rgba(34, 197, 94, 0.10)",
    borderWidth: 2.5,
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 5,
    pointBackgroundColor: "#22c55e",
    spanGaps: false,
  };

  const fcstDataset =
    futureForecast.length > 0
      ? {
          label: "Forecast",
          data: [...fcstPad, ...forecastValues] as (number | null)[],
          borderColor: "#94a3b8",
          backgroundColor: "rgba(148, 163, 184, 0.04)",
          borderWidth: 2,
          borderDash: [5, 4],
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: "#94a3b8",
          spanGaps: false,
        }
      : null;

  const chartData = {
    labels: [...historicalLabels, ...forecastLabels],
    datasets: fcstDataset ? [histDataset, fcstDataset] : [histDataset],
  };

  // Build plugin list: tonight shading + forecast boundary marker (when forecast exists)
  const chartPlugins = [
    makeTonightPlugin(fullMask),
    ...(futureForecast.length > 0 ? [makeForecastBoundaryPlugin(recent.length)] : []),
  ];

  return {
    chartData,
    chartOptions: CHART_OPTIONS,
    chartPlugins,
    hasTonight,
    hasForecast: futureForecast.length > 0,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChartData(kpHistory: KpEntry[], kpForecast: KpForecastEntry[] = []) {
  return useMemo(() => buildChartData(kpHistory, kpForecast), [kpHistory, kpForecast]);
}
