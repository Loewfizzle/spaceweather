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
        <div className="flex items-center gap-2 mb-1">
          <span className="uppercase tracking-[2.5px] text-[10px] text-[#64748b]">
            CURRENT CONDITIONS
          </span>
          <span className="text-[9px] font-semibold text-emerald-500 tracking-wide">LIVE</span>
        </div>
        <p className="text-[11px] text-[#475569] mb-3">
          Live solar wind readings — tonight&apos;s forecast is shown below
        </p>

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
            {/* Section divider + live label */}
            {displayedCities.length > 0 && (
              <div className="flex items-center gap-1.5 border-t border-[#1e2937] pt-2 mt-1 mb-0.5">
                <span className="text-[11px] text-[#64748b]">Aurora chances now</span>
                <span className="text-[9px] font-semibold tracking-widest text-emerald-400">LIVE</span>
              </div>
            )}
            {/* User location row — same structure as city rows; differentiated by color + weight only */}
            {userLocationProb != null && (
              <div className="flex items-center gap-2 py-0.5">
                <span className="block h-1.5 w-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                <span className="flex-1 text-[15px] font-semibold text-white leading-tight">
                  {userLocationLabel ?? "Your location"}
                </span>
                <span className="tabular-nums font-semibold text-white w-10 text-right whitespace-nowrap">
                  {userLocationProb > 0 ? `${userLocationProb}%` : "< 1%"}
                </span>
              </div>
            )}

            {/* Pre-defined city rows */}
            {displayedCities.map((city, idx) => (
              <div key={idx} className="flex items-center gap-2 py-0.5">
                <span className="block h-1.5 w-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                <span className="flex-1 text-sm text-[#94a3b8]">{city.name}, {city.state}</span>
                <span className="tabular-nums font-medium text-[#cbd5e1] w-10 text-right whitespace-nowrap">
                  {city.prob > 0 ? `${city.prob}%` : "< 1%"}
                </span>
              </div>
            ))}
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

      {outlook.status !== "Loading" && !error && latestUpdate && (
        <div className="mt-3 text-[10px] text-[#334155]">
          Updated {formatDistanceToNow(latestUpdate, { addSuffix: true })}
        </div>
      )}

      {outlook.status !== "Loading" && (
        <div className="mt-2 pt-3 border-t border-[#1e2937] flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {userLocationProb == null && onRequestLocation && (
              <button
                onClick={onRequestLocation}
                disabled={isLocating}
                style={{ color: outlook.accentColor }}
                className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
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
            {/* Cloud cover lives in the footer so it shares a line with the Share button */}
            {cloudCoverPct != null && (
              <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
                <Cloud className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Cloud cover:</span>
                <span className="font-medium" style={{ color: cloudCoverColor(cloudCoverPct) }}>
                  {cloudCoverLabel ?? "Unknown"} ({cloudCoverPct}%)
                </span>
              </div>
            )}
            <NotificationPrompt accentColor={outlook.accentColor} />
            <InstallPrompt accentColor={outlook.accentColor} />
          </div>
          <ShareButton
            status={outlook.status}
            kp={kp ?? null}
            cityProbs={outlook.cityProbs ?? []}
            accentColor={outlook.accentColor}
          />
        </div>
      )}
    </div>
  );
}
