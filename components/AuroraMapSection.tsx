"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LoadingSkeleton } from "./LoadingSkeleton";

// SSR-safe Leaflet map (local to the section so the heavy map only loads when this section is rendered)
const AuroraMap = dynamic(() => import("./AuroraMap"), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="map" />,
});

interface MapTarget {
  center: [number, number];
  zoom: number;
}

/**
 * AuroraMapSection
 * Map + controls: 4 recenter buttons (Great Lakes, Michigan, Continental US, North America),
 * minProb range slider (0-50) with live value + conditional reset, and the help text.
 * Local state for mapTarget and minProb (these only affect the map viz, no other sections).
 * The inner AuroraMap component owns the Leaflet + heatmap + legend.
 * Exact original classes, aria, and mobile notes preserved.
 */
export function AuroraMapSection() {
  // Map recenter control (passed to the dynamic map)
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null);

  // User controllable min probability for map points (makes OVATION viz much more useful)
  const [minProb, setMinProb] = useState(3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
        <div>
          <div className="section-title">AURORA MAP — OVATION MODEL</div>
          <div className="text-sm text-[#64748b]">North America • Probability of visible aurora (0–100%)</div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            className="button"
            onClick={() => setMapTarget({ center: [45.5, -86], zoom: 5.5 })}
          >
            Great Lakes
          </button>
          <button
            className="button"
            onClick={() => setMapTarget({ center: [44, -85], zoom: 6 })}
          >
            Michigan
          </button>
          <button
            className="button"
            onClick={() => setMapTarget({ center: [39, -98], zoom: 3.5 })}
          >
            Continental US
          </button>
          <button
            className="button"
            onClick={() => setMapTarget({ center: [48, -100], zoom: 3 })}
          >
            North America
          </button>

          {/* Min prob filter - powerful control for the dense OVATION data */}
          <div className="flex items-center gap-2 ml-2 text-xs text-[#64748b] bg-[#0f1425] px-2 py-1 rounded-full border border-[#1e2937]">
            <span className="font-medium">Filter ≥</span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={minProb}
              onChange={(e) => setMinProb(parseInt(e.target.value))}
              className="w-20 accent-[#22c55e] cursor-pointer"
              aria-label="Minimum aurora probability to show on map"
              aria-valuemin={0}
              aria-valuemax={50}
              aria-valuenow={minProb}
            />
            <span className="tabular-nums font-mono w-8 text-right text-[#22c55e]">{minProb}%</span>
            {minProb > 3 && (
              <button
                onClick={() => setMinProb(3)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2937] hover:bg-[#334155] transition-colors"
                title="Reset filter"
              >
                reset
              </button>
            )}
          </div>
        </div>
        <div className="text-[10px] text-[#64748b] mt-1">Drag the slider to hide low-probability areas — very useful on mobile to focus on the aurora oval.</div>
      </div>

      <AuroraMap target={mapTarget} minProb={minProb} />
    </div>
  );
}
