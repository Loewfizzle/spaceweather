"use client";

import { useRef } from "react";
import { X, ChevronRight, Clock } from "lucide-react";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import { forecastKpBlurb, viewingWindowLocationBlurb } from "../../lib/aurora/conditions";
import { getVisibleCities } from "../../lib/aurora/visibleCities";

interface ViewingWindowModalProps {
  kp: number | null;
  peakKp: number;
  cloudCoverPct?: number | null;
  cloudCoverLabel?: string | null;
  userLat?: number | null;
  userLocationLabel?: string | null;
  onClose: () => void;
}

export function ViewingWindowModal({
  kp,
  peakKp,
  cloudCoverPct,
  cloudCoverLabel,
  userLat,
  userLocationLabel,
  onClose,
}: ViewingWindowModalProps) {
  useBodyScrollLock();
  const effectiveKp = kp ?? peakKp;
  const { cities, minLat } = getVisibleCities(effectiveKp);
  const locBlurb = userLat != null ? viewingWindowLocationBlurb(userLat, effectiveKp, userLocationLabel) : null;
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewing-window-modal-title"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#94a3b8]" />
              <span id="viewing-window-modal-title" className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
                Tonight&apos;s Forecast
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-1 -mr-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 pt-4 space-y-5">

            {/* User location context — first when location is set */}
            {locBlurb && (
              <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
                <p className="text-[12px] leading-relaxed">
                  <span className="font-semibold text-[#94a3b8]">{locBlurb.first}</span>
                  {locBlurb.rest && <>{" "}<span className="text-[#94a3b8]">{locBlurb.rest}</span></>}
                </p>
              </div>
            )}

            {/* What this card is */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">About this forecast</div>
              <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                This is the big-picture prediction for the night ahead — think of it like a weather
                forecast for aurora. It uses NOAA&apos;s 36-hour Kp forecast and the OVATION
                model to estimate when conditions will peak after sunset.
                The <span className="font-semibold text-[#94a3b8]">Live Conditions</span>{" "}section shows
                what&apos;s happening right now; this card looks ahead.
              </p>
            </div>

            {/* Dynamic Kp description */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">
                What Kp {effectiveKp.toFixed(1)} means
              </div>
              <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                {forecastKpBlurb(effectiveKp)}
              </p>
            </div>

            {/* Reference cities */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">
                Where aurora may be visible tonight
              </div>
              {cities.length > 0 ? (
                <>
                  <div className="space-y-1">
                    {cities.map((city) => (
                      <div
                        key={`${city.name}-${city.state}`}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <span className="text-[#94a3b8]">{city.name}, {city.state}</span>
                        <span className="text-[#64748b] tabular-nums">{city.lat.toFixed(1)}°N</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#64748b] leading-relaxed pt-2">
                    Cities above ~{minLat.toFixed(0)}°N are within the viewing zone at this activity level.
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                  At current activity levels aurora is visible mainly in Alaska and northern Canada.
                  Conditions would need to strengthen significantly for the lower 48 to see anything.
                </p>
              )}
            </div>

            {/* What affects visibility */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">What affects what you see</div>
              <div className="space-y-2.5">
                {cloudCoverPct != null && (
                  <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                    <span className="text-[#94a3b8]">Cloud cover:</span>{" "}
                    {cloudCoverLabel} ({cloudCoverPct}%) forecast for your area tonight.{" "}
                    {cloudCoverPct <= 20
                      ? "Skies look clear — great for viewing."
                      : cloudCoverPct <= 50
                      ? "Partial clouds — keep watching for gaps and check the north."
                      : "Significant cloud cover will likely block your view. Check for breaks later in the night."}
                  </p>
                )}
                <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                  <span className="text-[#94a3b8]">Light pollution:</span>{" "}
                  Aurora can cut through city glow during strong storms, but for anything below
                  Kp 6 a short drive out of town makes a big difference. Even 15–20 minutes away
                  from streetlights opens up the view significantly.
                </p>
                <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                  <span className="text-[#94a3b8]">Horizon and dark adaptation:</span>{" "}
                  Aurora usually appears low on the northern horizon first. Give your eyes 10–15
                  minutes to fully adjust to the dark before deciding there&apos;s nothing there.
                </p>
              </div>
            </div>

            {/* NOAA link */}
            <a
              href="https://www.swpc.noaa.gov/products/3-day-forecast"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors pt-3 border-t border-[#1e2937]"
            >
              <span>3-Day Forecast on NOAA SWPC</span>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
