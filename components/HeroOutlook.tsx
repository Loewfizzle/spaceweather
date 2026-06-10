"use client";

import { useState } from "react";
import { MapPin, Loader2, Cloud, Navigation, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { TonightOutlook } from "../lib/use-noaa-data";
import { cloudCoverColor } from "../lib/aurora/kp";
import { getAuroraColor } from "../lib/aurora/ovation";
import { useUserLocationContext } from "../lib/context/UserLocationContext";
import { ShareButton } from "./ShareButton";
import { CurrentConditionsModal } from "./solar/CurrentConditionsModal";
import { NotificationPrompt } from "./NotificationPrompt";
import { InstallPrompt } from "./InstallPrompt";
import { LocationPicker } from "./LocationPicker";
import { Portal } from "./Portal";

interface HeroOutlookProps {
  outlook: TonightOutlook;
  latestUpdate?: Date | null;
  error?: Error | null;
  isFetching?: boolean;
  userLocationProb?: number | null;
  cloudCoverPct?: number | null;
  cloudCoverLabel?: string | null;
  kp?: number | null;
  bz?: number | null;
  solarWindSpeed?: number | null;
  maxAuroraProbNA?: number | null;
  ovationProcessed?: boolean;
}

export function HeroOutlook({
  outlook,
  error,
  isFetching,
  userLocationProb,
  cloudCoverPct,
  cloudCoverLabel,
  kp,
  bz,
  solarWindSpeed,
  maxAuroraProbNA,
  ovationProcessed,
  latestUpdate,
}: HeroOutlookProps) {
  const {
    userLocationLabel,
    locationSource,
    onRequestLocation,
    isLocating,
    locationTimedOut,
    setManualLocation: onSetManualLocation,
    clearLocation: onClearLocation,
  } = useUserLocationContext();
  const [showPicker, setShowPicker] = useState(false);
  const [showConditionsModal, setShowConditionsModal] = useState(false);

  const locationIsSet = locationSource != null;

  const displayedCities = (outlook.cityProbs ?? []).filter((c) => c.prob > 0).slice(0, 6);

  return (
    <div
      className="card p-5 border-l-4"
      style={{ borderLeftColor: outlook.accentColor }}
    >
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#94a3b8]">
            CURRENT DATA SUGGESTS
          </span>
          <button
            onClick={() => setShowConditionsModal(true)}
            className="text-xs text-[#94a3b8] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
          >
            Details <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-[#64748b] mb-3">
          Solar wind and Kp · live OVATION model
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
                <div className="text-sm text-[#94a3b8] tabular-nums font-medium">
                  {outlook.drivers}
                </div>
              )}
            </div>

            <p className={`text-[15px] leading-relaxed ${outlook.reasons.length > 0 ? 'mb-1' : 'mb-3'}`}>
              <span className="text-[#94a3b8]">Current indicators — </span>
              <span className="text-[#cbd5e1]">{outlook.message}</span>
            </p>
            {outlook.reasons.length > 0 && (
              <ul className="mb-3 space-y-0.5">
                {outlook.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#94a3b8]">
                    <span className="mt-[7px] h-1 w-1 rounded-full bg-[#334155] flex-shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {outlook.status !== "Loading" && (
          <div className="space-y-1 mb-2">
            {(displayedCities.length > 0 || userLocationProb != null) && (
              <div className="border-t border-[#1e2937] pt-2 mt-1 mb-0.5">
                <span className="text-xs text-[#94a3b8]">Aurora in the sky right now</span>
              </div>
            )}

            {userLocationProb != null ? (
              <div className="flex items-center gap-2 py-0.5 animate-fade-in">
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
            ) : !locationIsSet && !showPicker && displayedCities.length > 0 && (
              <button
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-2 py-0.5 w-full text-left group"
              >
                <span className="block h-1.5 w-1.5 rounded-full bg-[#1e2937] border border-[#475569] flex-shrink-0 group-hover:border-[#64748b] transition-colors" />
                <span className="flex-1 text-sm text-[#94a3b8] group-hover:text-[#94a3b8] transition-colors">
                  Your location
                </span>
                <span className="text-sm text-[#94a3b8] group-hover:text-[#94a3b8] transition-colors tabular-nums">
                  + Add yours
                </span>
              </button>
            )}

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

            {displayedCities.length === 0 && userLocationProb == null && (
              <div className="border-t border-[#1e2937] pt-2 mt-1">
                <p className="text-sm text-[#94a3b8]">
                  No aurora expected at surveyed US locations under current conditions.
                </p>
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
        <div className="mt-2 pt-3 border-t border-[#1e2937]">

          {/* Primary row: location controls LEFT, Share forecast RIGHT */}
          <div className="flex items-start justify-between gap-3">

            {/* LEFT: location state or picker trigger */}
            <div className="min-w-0 flex-1">
              {locationIsSet ? (
                /* active location row — icon, truncated label, Clear */
                <div className="flex items-center gap-1.5 min-w-0 text-xs">
                  {locationSource === "gps" ? (
                    <Navigation className="h-3.5 w-3.5 shrink-0" style={{ color: '#94a3b8' }} />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: '#94a3b8' }} />
                  )}
                  <span
                    className="font-medium truncate min-w-0"
                    style={{ color: '#94a3b8' }}
                  >
                    {userLocationLabel ?? "Your location"}
                  </span>
                  {onClearLocation && (
                    <>
                      <span className="text-[#2d3748] shrink-0">·</span>
                      <button
                        onClick={() => onClearLocation()}
                        className="shrink-0 whitespace-nowrap text-[#64748b] hover:text-[#94a3b8] transition-colors"
                        aria-label="Clear saved location"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              ) : !showPicker ? (
                /* no location set — stack vertically */
                <div className="flex flex-col gap-2">
                  {onRequestLocation && (
                    <button
                      onClick={onRequestLocation}
                      disabled={isLocating}
                      style={{ color: '#94a3b8' }}
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
                    className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-colors"
                    style={{ color: '#94a3b8' }}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {onRequestLocation ? "Enter manually" : "Set location"}
                  </button>
                  <p className="text-sm text-[#94a3b8]">See your exact aurora probability and cloud cover forecast</p>
                </div>
              ) : null}
            </div>

            {/* RIGHT: Share forecast — always anchored right, hidden only when picker is open */}
            {!showPicker && (
              <div className="shrink-0 pt-0.5">
                <ShareButton accentColor="#94a3b8" />
              </div>
            )}
          </div>

          {/* Secondary row: cloud cover + notification + install prompts */}
          {!showPicker && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {cloudCoverPct != null && (
                <div className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                  <Cloud className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Your skies tonight:</span>
                  <span className="font-medium" style={{ color: cloudCoverColor(cloudCoverPct) }}>
                    {cloudCoverLabel ?? "Unknown"} ({cloudCoverPct}%)
                  </span>
                </div>
              )}
              <NotificationPrompt accentColor="#94a3b8" />
              <InstallPrompt accentColor="#94a3b8" />
            </div>
          )}

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

      {showConditionsModal && (
        <Portal>
          <CurrentConditionsModal
            kp={kp ?? null}
            bz={bz ?? null}
            solarWindSpeed={solarWindSpeed ?? null}
            maxAuroraProbNA={maxAuroraProbNA ?? null}
            ovationProcessed={ovationProcessed}
            userLocationProb={userLocationProb}
            onClose={() => setShowConditionsModal(false)}
          />
        </Portal>
      )}
    </div>
  );
}
