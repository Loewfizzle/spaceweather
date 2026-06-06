"use client";

import { MapPin, Loader2, Cloud } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { TonightOutlook } from "../lib/use-noaa-data";
import { cloudCoverColor } from "../lib/noaa";
import { ShareButton } from "./ShareButton";
import { NotificationPrompt } from "./NotificationPrompt";
import { InstallPrompt } from "./InstallPrompt";

interface HeroOutlookProps {
  outlook: TonightOutlook;
  latestUpdate?: Date | null;
  error?: Error | null;
  isFetching?: boolean;
  userLocationProb?: number | null;
  userLocationLabel?: string | null;
  onRequestLocation?: () => void;
  isLocating?: boolean;
  locationTimedOut?: boolean;
  cloudCoverPct?: number | null;
  cloudCoverLabel?: string | null;
  kp?: number | null;
}

export function HeroOutlook({
  outlook,
  error,
  isFetching,
  userLocationProb,
  userLocationLabel,
  onRequestLocation,
  isLocating,
  locationTimedOut,
  cloudCoverPct,
  cloudCoverLabel,
  kp,
  latestUpdate,
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
          TONIGHT&apos;S OUTLOOK
        </div>

        {outlook.status === "Loading" ? (
          <div className="mb-3">
            <div className="h-10 w-40 rounded animate-pulse bg-[#1e2937] mb-3" />
            <div className="h-4 w-full rounded animate-pulse bg-[#1e2937] mb-2" />
            <div className="h-4 w-4/5 rounded animate-pulse bg-[#1e2937]" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
              <div
                className="text-4xl font-semibold tracking-tighter"
                style={{ color: outlook.accentColor }}
              >
                {outlook.status}
              </div>
              {outlook.drivers && (
                <div className="text-sm text-[#64748b] tabular-nums font-medium">
                  {outlook.drivers}
                </div>
              )}
            </div>

            <p className="text-[#cbd5e1] text-[15px] leading-relaxed mb-3">
              {outlook.message}
            </p>
          </>
        )}

        {outlook.status !== "Loading" && (
          <div className="space-y-1 mb-2">
            {/* User location row — shown first when granted */}
            {userLocationProb != null && (
              <div className="text-sm text-[#94a3b8] flex items-center gap-2">
                <MapPin className="h-2.5 w-2.5 flex-shrink-0" style={{ color: outlook.accentColor }} />
                <span className="flex-1 text-[#cbd5e1] font-medium">
                  {userLocationLabel ?? "Your location"}
                </span>
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

            {/* Cloud cover — only shown when geolocation is granted */}
            {cloudCoverPct != null && (
              <div className="flex items-center gap-1.5 text-[11px] mt-2 pt-2 border-t border-[#1e2937]">
                <Cloud className="h-3 w-3 text-[#64748b] flex-shrink-0" />
                <span className="text-[#64748b]">Skies tonight:</span>
                <span
                  className="font-medium"
                  style={{ color: cloudCoverColor(cloudCoverPct) }}
                >
                  {cloudCoverLabel ?? "Unknown"} ({cloudCoverPct}%)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-xs text-amber-400">
          {kp !== null
            ? <>
                NOAA temporarily unreachable — showing last known values
                {latestUpdate ? ` from ${formatDistanceToNow(latestUpdate, { addSuffix: true })}` : ''}.
              </>
            : 'NOAA temporarily unreachable — data will appear when connection is restored.'}
          {isFetching && " Retrying…"}
        </div>
      )}

      {outlook.status !== "Loading" && (
        <div className="mt-4 pt-3 border-t border-[#1e2937] flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {userLocationProb == null && onRequestLocation && (
              <button
                onClick={onRequestLocation}
                disabled={isLocating}
                className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-50"
                title="Get aurora probability for your current location"
              >
                {isLocating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
                {isLocating ? "Locating…" : locationTimedOut ? "Try again" : "Use my location"}
              </button>
            )}
            <NotificationPrompt />
            <InstallPrompt />
          </div>
          <ShareButton
            status={outlook.status}
            kp={kp ?? null}
            cityProbs={outlook.cityProbs ?? []}
          />
        </div>
      )}
    </div>
  );
}
