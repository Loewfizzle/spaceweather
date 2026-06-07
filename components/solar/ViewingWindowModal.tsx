"use client";

import { X, ChevronRight, Clock } from "lucide-react";
import { US_CITIES } from "../../lib/constants/usCities";

// Prefer well-known city names when building the reference list
const PREFERRED = new Set([
  "Fairbanks", "Anchorage", "Juneau", "Seattle", "Spokane", "Portland",
  "Billings", "Great Falls", "Missoula", "Duluth", "Fargo", "Minneapolis",
  "Bismarck", "Milwaukee", "Chicago", "Detroit", "Cleveland", "Buffalo",
  "Burlington", "Boston", "Denver", "Salt Lake City", "Boise",
]);

function visibleCities(kp: number) {
  const minLat = Math.max(30, 67 - kp * 3);
  const qualifying = [...US_CITIES].filter((c) => c.lat >= minLat);
  qualifying.sort((a, b) => {
    const ap = PREFERRED.has(a.name) ? 0 : 1;
    const bp = PREFERRED.has(b.name) ? 0 : 1;
    return ap !== bp ? ap - bp : b.lat - a.lat;
  });
  return { cities: qualifying.slice(0, 5), minLat };
}

function kpBlurb(kp: number): string {
  if (kp >= 8) return `Kp ${kp.toFixed(1)} is an extreme geomagnetic storm — one of the strongest on record. Aurora may be visible as far south as Florida and Texas. Get outside right now if skies are clear.`;
  if (kp >= 7) return `Kp ${kp.toFixed(1)} is a major storm. Aurora should be visible well into the southern US. This kind of event is rare — don't miss it.`;
  if (kp >= 6) return `Kp ${kp.toFixed(1)} is a strong storm. Aurora should be visible across most of the upper Midwest, the Northeast, and the Pacific Northwest — even from a suburban backyard.`;
  if (kp >= 5) return `Kp ${kp.toFixed(1)} is a moderate storm. This is the level where aurora becomes reliably visible across the northern US. Get somewhere dark and look north.`;
  if (kp >= 4) return `Kp ${kp.toFixed(1)} is slightly elevated above quiet. Aurora is possible in the far northern states but you'll need very dark, rural skies — city light pollution will wash it out.`;
  if (kp >= 3) return `Kp ${kp.toFixed(1)} is quiet-to-borderline. Aurora is mostly limited to Alaska and the very northern fringe of the lower 48.`;
  return `Kp ${kp.toFixed(1)} means conditions are quiet. Aurora activity is minimal and only visible in Alaska and northern Canada right now.`;
}

function locationBlurb(userLat: number, kp: number, label?: string | null): string {
  const minLat = Math.max(30, 67 - kp * 3);
  const diff = userLat - minLat;
  const name = label ?? "Your location";
  if (diff >= 5)   return `${name} is comfortably within the viewing zone at this activity level — good conditions for you tonight.`;
  if (diff >= 0)   return `${name} is just inside the viewing zone tonight. Dark skies away from city lights will make a real difference.`;
  if (diff >= -3)  return `${name} is just outside the typical viewing zone. Conditions would need to tick up slightly for aurora to reach you.`;
  const needed = Math.ceil(Math.max(0, (67 - userLat) / 3));
  if (diff >= -8)  return `${name} is outside the viewing zone at this Kp level. Activity would need to reach around Kp ${needed} for aurora to be likely from your area.`;
  return `${name} is well south of the aurora oval right now. Aurora reaching your area would require a very strong storm — Kp ${needed} or higher.`;
}

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
  const effectiveKp = kp ?? peakKp;
  const { cities, minLat } = visibleCities(effectiveKp);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Tonight's forecast details"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#64748b]" />
              <span className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
                Tonight&apos;s Forecast
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[#475569] hover:text-[#94a3b8] transition-colors p-1 -mr-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 pt-4 space-y-5">

            {/* What this card is */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">About this forecast</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                This is the big-picture prediction for the night ahead — think of it like a weather
                forecast for aurora. It uses NOAA&apos;s 36-hour Kp forecast and the OVATION
                model to estimate when conditions will peak after sunset.
                The <span className="text-[#94a3b8]">Live Conditions</span> section shows
                what&apos;s happening right now; this card looks ahead.
              </p>
            </div>

            {/* Dynamic Kp description */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">
                What Kp {effectiveKp.toFixed(1)} means
              </div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                {kpBlurb(effectiveKp)}
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
                        <span className="text-[#475569] tabular-nums">{city.lat.toFixed(1)}°N</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#475569] leading-relaxed pt-2">
                    Cities above ~{minLat.toFixed(0)}°N are within the viewing zone at this activity level.
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  At current activity levels aurora is visible mainly in Alaska and northern Canada.
                  Conditions would need to strengthen significantly for the lower 48 to see anything.
                </p>
              )}
            </div>

            {/* User location context */}
            {userLat != null && (
              <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  {locationBlurb(userLat, effectiveKp, userLocationLabel)}
                </p>
              </div>
            )}

            {/* What affects visibility */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">What affects what you see</div>
              <div className="space-y-2.5">
                {cloudCoverPct != null && (
                  <p className="text-[12px] text-[#64748b] leading-relaxed">
                    <span className="text-[#94a3b8]">Cloud cover:</span>{" "}
                    {cloudCoverLabel} ({cloudCoverPct}%) forecast for your area tonight.{" "}
                    {cloudCoverPct <= 20
                      ? "Skies look clear — great for viewing."
                      : cloudCoverPct <= 50
                      ? "Partial clouds — keep watching for gaps and check the north."
                      : "Significant cloud cover will likely block your view. Check for breaks later in the night."}
                  </p>
                )}
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  <span className="text-[#94a3b8]">Light pollution:</span>{" "}
                  Aurora can cut through city glow during strong storms, but for anything below
                  Kp 6 a short drive out of town makes a big difference. Even 15–20 minutes away
                  from streetlights opens up the view significantly.
                </p>
                <p className="text-[12px] text-[#64748b] leading-relaxed">
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
              className="flex items-center justify-between w-full text-xs text-[#475569] hover:text-[#64748b] transition-colors pt-3 border-t border-[#1e2937]"
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
