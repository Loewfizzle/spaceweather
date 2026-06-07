"use client";

import { Activity } from "lucide-react";
import { useCurrentConditions } from "../lib/use-noaa-data";
import { getKpTier } from "../lib/aurora/kp";
import { DataStatus } from "./DataStatus";

export function LiveHeader() {
  const { kp } = useCurrentConditions();

  const kpClass = `kp-${kp !== null ? getKpTier(kp) : "quiet"}`;

  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      {/* Kp index — primary live signal in the header */}
      <div
        className={`kp-pill ${kpClass}`}
        title="Planetary K-index (live from NOAA)"
      >
        <Activity className="w-3.5 h-3.5" />
        <span>Kp {kp !== null ? kp.toFixed(1) : "—"}</span>
      </div>

      {/* Appears only when a data source is degraded or down */}
      <DataStatus />
    </div>
  );
}
