"use client";

import { Sparkles } from "lucide-react";
import { useCurrentConditions } from "../lib/use-noaa-data";
import { getKpTier, AURORA_TIERS } from "../lib/aurora/kp";

export function BrandIcon() {
  const { kp } = useCurrentConditions();
  const tier = getKpTier(kp ?? 0);
  const color = kp !== null ? AURORA_TIERS[tier].color : '#64748b';

  return (
    <div
      aria-hidden="true"
      className="w-10 h-10 rounded-full bg-[#0d1425] border border-[#1e2937] flex items-center justify-center flex-shrink-0"
    >
      <Sparkles className="w-5 h-5" style={{ color }} />
    </div>
  );
}
