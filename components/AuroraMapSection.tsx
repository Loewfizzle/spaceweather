"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LoadingSkeleton } from "./LoadingSkeleton";

const AuroraMap = dynamic(() => import("./AuroraMap"), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="map" />,
});

export function AuroraMapSection() {
  const [minProb, setMinProb] = useState(3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
        <div>
          <div className="section-title">AURORA MAP — OVATION MODEL</div>
          <div className="text-sm text-[#64748b]">North America · Probability of visible aurora (0–100%)</div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1">
          <div className="flex items-center gap-2.5 text-xs text-[#64748b] bg-[#0f1425] px-3 py-1.5 rounded-full border border-[#1e2937]">
            <span className="text-[#64748b]">Min</span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={minProb}
              onChange={(e) => setMinProb(parseInt(e.target.value))}
              className="w-24 accent-[#22c55e] cursor-pointer"
              aria-label="Minimum aurora probability to show on map"
              aria-valuemin={0}
              aria-valuemax={50}
              aria-valuenow={minProb}
            />
            <span className="tabular-nums font-mono w-7 text-right text-[#22c55e]">{minProb}%</span>
            {minProb > 3 && (
              <button
                onClick={() => setMinProb(3)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2937] hover:bg-[#334155] transition-colors"
                title="Reset filter to default"
              >
                reset
              </button>
            )}
          </div>
          <div className="text-[10px] text-[#475569]">Filter out low-probability areas</div>
        </div>
      </div>

      <AuroraMap minProb={minProb} />
    </div>
  );
}
