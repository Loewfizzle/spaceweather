"use client";

import { useKpData } from "../lib/use-noaa-data";
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
} from "chart.js";
import { LoadingSkeleton } from "./LoadingSkeleton";

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

/**
 * KpForecast
 * KP OUTLOOK + MICHIGAN FORECAST section.
 * Owns its kpQuery + chart preparation via hook.
 * Renders the chart card + the two guidance lines (Tonight MI + Recent trend) + footer note.
 * Exact original logic for trend text, loading/empty states, and classes preserved.
 */
export function KpForecast({ michiganGuidance }: KpForecastProps) {
  const kpQuery = useKpData();
  const kpHistory = kpQuery.data || [];
  const { chartData, chartOptions } = useChartData(kpHistory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="section-title">KP OUTLOOK + MICHIGAN FORECAST</div>
      <div className="card p-6">
        <div className="h-56">
          {kpQuery.isLoading ? (
            <LoadingSkeleton variant="chart" />
          ) : kpHistory.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex h-full items-center justify-center text-[#64748b]">No recent Kp data</div>
          )}
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-4 text-sm">
          <div className="text-[#cbd5e1]">
            <span className="font-medium text-white">Tonight (Michigan):</span> {michiganGuidance}
          </div>
          <div className="text-[#cbd5e1]">
            <span className="font-medium text-white">Recent trend:</span>{" "}
            {kpHistory.length > 1 ? (
              (kpHistory[kpHistory.length - 1].Kp ?? 0) > (kpHistory[kpHistory.length - 2].Kp ?? 0)
                ? "Rising — elevated activity possible if trend continues."
                : "Stable or declining — conditions quieting."
            ) : (
              "Based on current solar wind and Bz."
            )}
          </div>
        </div>
        <div className="mt-3 text-[10px] text-[#64748b]">
          Chart shows last ~36 hours of 3-hour Kp values. Full multi-day forecasts available from NOAA.
        </div>
      </div>
    </div>
  );
}
