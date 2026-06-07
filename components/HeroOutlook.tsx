"use client";

import { useState } from "react";
import { MapPin, Loader2, Cloud, Navigation, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { TonightOutlook } from "../lib/use-noaa-data";
import type { LocationSource } from "../lib/hooks/useUserLocation";
import { cloudCoverColor, getAuroraColor } from "../lib/noaa";
import { ShareButton } from "./ShareButton";
import { NotificationPrompt } from "./NotificationPrompt";
import { InstallPrompt } from "./InstallPrompt";
import { LocationPicker } from "./LocationPicker";

interface HeroOutlookProps {
  outlook: TonightOutlook;
  latestUpdate?: Date | null;
  error?: Error | null;
  isFetching?: boolean;
  userLocationProb?: number | null;
  userLocationLabel?: string | null;
  locationSource?: LocationSource | null;
  onRequestLocation?: () => void;
  isLocating?: boolean;
  locationTimedOut?: boolean;
  onSetManualLocation?: (lat: number, lon: number, label: string) => void;
  onClearLocation?: () => void;
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
  locationSource,
  onRequestLocation,
  isLocating,
  locationTimedOut,
  onSetManualLocation,
  onClearLocation,
  cloudCoverPct,
  cloudCoverLabel,
  kp,
  latestUpdate,
}: HeroOutlookProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Show at most 6 pre-defined cities
  const displayedCities = outlook.cityProbs?.slice(0, 6) ?? [];

  const locationIsSet = locationSource != null;

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
            {displayedCities.length > 0 && (
              <div className="flex items-center gap-1.5 border-t border-[#1e2937] pt-2 mt-1 mb-0.5">
                <span className="text-[11px] text-[#64748b]">Aurora chances now</span>
                <span className="text-[9px] font-semibold tracking-widest text-emerald-400">LIVE</span>
              </div>
            )}

            {/* User location row — shown when probability is available */}
            {userLocationProb != null && (
              <div className="flex items-center gap-2 py-0.5">
                <span
                  className="block h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: outlook.accentColor }}
                />
                <span className="flex-1 text-[15px] font-semibold text-white leading-tight">
                  {userLocationLabel ?? "Your location"}
                </span>
                <span
                  className="tabular-nums font-semibold w-10 text-right whitespace-nowrap"
                  style={{ color: getAuroraColor(userLocationProb) }}
                >
                  {userLocationProb > 0 ? `${userLocationProb}%` : "< 1%"}
                </span>
              </div>
            )}

            {/* Pre-defined city rows */}
            {displayedCities.map((city, idx) => (
              <div key={idx} className="flex items-center gap-2 py-0.5">
                <span className="block h-1.5 w-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                <span className="flex-1 text-sm text-[#94a3b8]">{city.name}, {city.state}</span>
                <span
                  className="tabular-nums font-medium w-10 text-right whitespace-nowrap"
                  style={{ color: getAuroraColor(city.prob) }}
                >
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
        <div className="mt-2 pt-3 border-t border-[#1e2937]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">

              {/* ── Location controls ── */}
              {locationIsSet ? (
                /* Location is set — show label with source icon + change/clear */
                <div className="flex items-center gap-1.5 text-xs">
                  {locationSource === "gps" ? (
                    <Navigation
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: outlook.accentColor }}
                    />
                  ) : (
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: outlook.accentColor }}
                    />
                  )}
                  <span className="font-medium" style={{ color: outlook.accentColor }}>
                    {userLocationLabel ?? "Your location"}
                  </span>
                  <span className="text-[#2d3748]">·</span>
                  <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="text-[#475569] hover:text-[#94a3b8] transition-colors"
                  >
                    {showPicker ? "Cancel" : "Change"}
                  </button>
                  {onClearLocation && (
                    <button
                      onClick={() => { onClearLocation(); setShowPicker(false); }}
                      className="text-[#475569] hover:text-[#94a3b8] transition-colors"
                      aria-label="Clear saved location"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                /* No location set — GPS button and/or manual entry */
                !showPicker && (
                  <>
                    {onRequestLocation && (
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
                          <Navigation className="h-3.5 w-3.5" />
                        )}
                        {isLocating ? "Locating…" : locationTimedOut ? "Try again" : "Use my location"}
                      </button>
                    )}
                    <button
                      onClick={() => setShowPicker(true)}
                      className="flex items-center gap-1.5 text-xs text-[#475569] hover:text-[#94a3b8] transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {onRequestLocation ? "Enter manually" : "Set location"}
                    </button>
                  </>
                )
              )}

              {/* Cloud cover — hidden while picker is open to keep it tidy */}
              {!showPicker && cloudCoverPct != null && (
                <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
                  <Cloud className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Cloud cover:</span>
                  <span className="font-medium" style={{ color: cloudCoverColor(cloudCoverPct) }}>
                    {cloudCoverLabel ?? "Unknown"} ({cloudCoverPct}%)
                  </span>
                </div>
              )}

              {!showPicker && <NotificationPrompt accentColor={outlook.accentColor} />}
              {!showPicker && <InstallPrompt accentColor={outlook.accentColor} />}
            </div>

            {!showPicker && (
              <ShareButton
                status={outlook.status}
                kp={kp ?? null}
                cityProbs={outlook.cityProbs ?? []}
                accentColor={outlook.accentColor}
              />
            )}
          </div>

          {/* Inline location picker */}
          {showPicker && onSetManualLocation && (
            <LocationPicker
              onConfirm={(lat, lon, label) => {
                onSetManualLocation(lat, lon, label);
                setShowPicker(false);
              }}
              onCancel={() => setShowPicker(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
