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
        <div className="text-[#94a3b8] text-sm">Loading map data…</div>
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
  const { data: ovationData } = useOvationData();
  const observedAt = formatObsTime(ovationData?.["Observation Time"]);

  const [showModal, setShowModal] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="card overflow-hidden">

        {/* Card header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#94a3b8]">
              OVATION MODEL
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-[#94a3b8] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
            >
              Details <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-sm font-medium text-[#94a3b8]">Aurora Visibility Forecast</div>
        </div>

        {/* Map — fills full card width */}
        <AuroraMap
          insideCard={true}
          userLat={userLat}
          userLon={userLon}
          userProb={userProb}
          ovationPoints={ovationPoints}
        />

        {/* Footer — observation timestamp */}
        {observedAt && (
          <div className="px-5 pt-3 pb-4">
            <span className="tabular-nums text-xs text-[#94a3b8]">Observed {observedAt}</span>
          </div>
        )}

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
