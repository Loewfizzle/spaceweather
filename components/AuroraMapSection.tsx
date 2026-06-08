"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { useOvationData } from "../lib/use-noaa-data";
import { useUserLocationContext } from "../lib/context/UserLocationContext";
import { AuroraMapModal } from "./solar/AuroraMapModal";
import type { OvationPoint } from "../lib/aurora/ovation";

const AuroraMap = dynamic(() => import("./AuroraMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] sm:h-[480px] md:h-[520px] flex items-center justify-center bg-[#0c1222]">
      <div className="text-center">
        <div className="h-4 w-32 bg-[#1e2937] rounded animate-pulse mb-2 mx-auto" />
        <div className="text-[#64748b] text-sm">Loading map data…</div>
      </div>
    </div>
  ),
});

interface AuroraMapSectionProps {
  userProb?: number | null;
  ovationPoints?: OvationPoint[];
}

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

export function AuroraMapSection({ userProb, ovationPoints }: AuroraMapSectionProps) {
  const { userLat, userLon } = useUserLocationContext();
  const [minProb, setMinProbState] = useState<number>(() => {
    if (typeof window === "undefined") return 3;
    try {
      const saved = localStorage.getItem("aurora-min-prob");
      if (saved !== null) {
        const n = parseInt(saved, 10);
        if (Number.isFinite(n) && n >= 0 && n <= 50) return n;
      }
    } catch { /* localStorage unavailable */ }
    return 3;
  });

  const setMinProb = (value: number) => {
    setMinProbState(value);
    try { localStorage.setItem("aurora-min-prob", String(value)); } catch { /* ignore */ }
  };

  const { data: ovationData } = useOvationData();
  const observedAt = formatObsTime(ovationData?.["Observation Time"]);

  const [showModal, setShowModal] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="card overflow-hidden">

        {/* Card header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="uppercase tracking-[2.5px] text-[10px] text-[#64748b]">
              OVATION MODEL
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
            >
              Details <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-sm font-medium text-[#94a3b8]">Aurora Visibility Forecast</div>
        </div>

        {/* Map — fills full card width */}
        <AuroraMap
          insideCard={true}
          minProb={minProb}
          userLat={userLat}
          userLon={userLon}
          userProb={userProb}
          ovationPoints={ovationPoints}
        />

        {/* Slider footer */}
        <div className="px-5 pt-4 pb-5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#64748b] shrink-0">Min probability</span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={minProb}
              onChange={(e) => setMinProb(parseInt(e.target.value))}
              className="flex-1 accent-[#22c55e] cursor-pointer"
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
          <div className="flex items-center gap-2 text-[10px] text-[#475569] mt-1.5">
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

      {showModal && (
        <AuroraMapModal
          userProb={userProb}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
