"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { useOvationData } from "../lib/use-noaa-data";

const AuroraMap = dynamic(() => import("./AuroraMap"), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="map" />,
});

function formatObsTime(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return (
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    );
  } catch {
    return null;
  }
}

export function AuroraMapSection() {
  const [minProb, setMinProb] = useState(3);

  // Read from the already-cached OVATION query — no extra network request.
  const { data: ovationData } = useOvationData();
  const observedAt = formatObsTime(ovationData?.["Observation Time"]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      {/* Header row: stacks vertically on mobile, side-by-side on desktop */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <div className="section-title">AURORA MAP — OVATION MODEL</div>
          <div className="text-sm text-[#64748b]">
            North America · Probability of visible aurora (0–100%)
          </div>
        </div>

        {/* Filter control — full-width pill on mobile, compact pill on desktop */}
        <div className="flex flex-col gap-1.5 sm:items-end">
          <div className="flex items-center gap-3 bg-[#0f1425] px-3 py-2.5 sm:py-1.5 rounded-xl sm:rounded-full border border-[#1e2937]">
            <span className="text-xs text-[#64748b] shrink-0">Min</span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={minProb}
              onChange={(e) => setMinProb(parseInt(e.target.value))}
              // flex-1 stretches the slider across available space on mobile;
              // sm:w-24 sm:flex-none locks it to a fixed width on desktop.
              className="flex-1 sm:w-24 sm:flex-none accent-[#22c55e] cursor-pointer"
              aria-label="Minimum aurora probability to show on map"
              aria-valuemin={0}
              aria-valuemax={50}
              aria-valuenow={minProb}
            />
            <span className="text-xs tabular-nums font-mono w-7 text-right text-[#22c55e] shrink-0">
              {minProb}%
            </span>
            {minProb > 3 && (
              <button
                onClick={() => setMinProb(3)}
                className="text-[10px] px-2 py-1 rounded-md bg-[#1e2937] hover:bg-[#334155] transition-colors shrink-0 min-h-[28px] min-w-[40px]"
                title="Reset filter to default"
              >
                reset
              </button>
            )}
          </div>

          {/* Meta line: hint + observation timestamp */}
          <div className="flex items-center gap-2 text-[10px] text-[#475569] px-1">
            <span>Drag to filter low-probability areas</span>
            {observedAt && (
              <>
                <span className="text-[#2d3748]">·</span>
                <span className="tabular-nums text-[#3d4f63]">Observed {observedAt}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <AuroraMap minProb={minProb} />
    </div>
  );
}
