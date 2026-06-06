"use client";

import { MapPin, Loader2 } from "lucide-react";
import type { TonightOutlook } from "../lib/use-noaa-data";

interface HeroOutlookProps {
  outlook: TonightOutlook;
  isLoading?: boolean;
  error?: Error | null;
  isFetching?: boolean;
  userLocationProb?: number | null;
  onRequestLocation?: () => void;
  isLocating?: boolean;
}

export function HeroOutlook({
  outlook,
  isLoading,
  error,
  isFetching,
  userLocationProb,
  onRequestLocation,
  isLocating,
}: HeroOutlookProps) {
  // Show at most 4 pre-defined cities — enough for the north→south gradient without crowding
  const displayedCities = outlook.cityProbs?.slice(0, 4) ?? [];

  return (
    <div
      className="mt-8 card p-6 max-w-3xl border-l-4"
      style={{ borderLeftColor: outlook.accentColor }}
    >
      <div>
        <div className="uppercase tracking-[2.5px] text-[10px] text-[#64748b] mb-2">
          TONIGHT'S MICHIGAN OUTLOOK
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
          <div
            className="text-4xl font-semibold tracking-tighter"
            style={{ color: outlook.accentColor }}
          >
            {outlook.status}
          </div>
          {outlook.drivers && outlook.status !== "Loading" && (
            <div className="text-sm text-[#64748b] tabular-nums font-medium">
              {outlook.drivers}
            </div>
          )}
        </div>

        <p className="text-[#cbd5e1] text-[15px] leading-relaxed mb-3">
          {outlook.message}
        </p>

        {outlook.status !== "Loading" && (
          <div className="space-y-1 mb-2">
            {/* User location row — shown first when granted */}
            {userLocationProb != null && (
              <div className="text-sm text-[#94a3b8] flex items-center gap-2">
                <MapPin className="h-2.5 w-2.5 flex-shrink-0" style={{ color: outlook.accentColor }} />
                <span className="flex-1 text-[#cbd5e1] font-medium">Your location</span>
                <span className="tabular-nums font-medium text-[#cbd5e1]">
                  {userLocationProb > 0 ? `${userLocationProb}%` : "< 1%"}
                </span>
              </div>
            )}

            {/* Pre-defined city rows */}
            {displayedCities.map((city, idx) => (
              <div key={idx} className="text-sm text-[#94a3b8] flex items-center gap-2">
                <span
                  className="block h-1 w-1 rounded-full flex-shrink-0"
                  style={{ backgroundColor: outlook.accentColor }}
                />
                <span className="flex-1">{city.name}, {city.state}</span>
                <span className="tabular-nums font-medium text-[#cbd5e1]">
                  {city.prob > 0 ? `${city.prob}%` : "< 1%"}
                </span>
              </div>
            ))}

            {/* Geolocation button — idle/denied/unavailable states */}
            {userLocationProb == null && onRequestLocation && (
              <button
                onClick={onRequestLocation}
                disabled={isLocating}
                className="flex items-center gap-1.5 text-[10px] text-[#64748b] hover:text-[#94a3b8] transition-colors mt-1 disabled:opacity-50"
                title="Get aurora probability for your current location"
              >
                {isLocating ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <MapPin className="h-2.5 w-2.5" />
                )}
                {isLocating ? "Locating…" : "Use my location"}
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="mt-3 h-4 w-2/3 bg-[#1e2937] rounded animate-pulse" />
      )}
      {error && (
        <div className="mt-2 text-xs text-amber-400">
          Some data sources unavailable — displaying last known values.
          {isFetching && " (retrying…)"}
        </div>
      )}
    </div>
  );
}
