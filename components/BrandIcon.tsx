"use client";

import { Sparkles } from "lucide-react";
import { useCurrentConditions } from "../lib/use-noaa-data";
import { getKpTier, AURORA_TIERS } from "../lib/aurora/kp";

const PULSE_DURATION: Record<string, string> = {
  quiet:    '4s',
  moderate: '3s',
  active:   '2.5s',
  strong:   '2s',
  storm:    '1.5s',
};

export function BrandIcon() {
  const { kp } = useCurrentConditions();
  const tier = getKpTier(kp ?? 0);
  const color = kp !== null ? AURORA_TIERS[tier].color : '#64748b';
  const duration = PULSE_DURATION[tier];

  return (
    <div className="w-8 h-8 rounded-full bg-[#0d1425] border border-[#1e2937] flex items-center justify-center flex-shrink-0">
      <Sparkles
        className="w-4 h-4 animate-pulse"
        style={{ color, animationDuration: duration }}
      />
    </div>
  );
}
