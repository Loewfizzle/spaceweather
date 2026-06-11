"use client";

import { useRef } from "react";
import { X, ChevronRight, Map } from "lucide-react";
import { useUserLocationContext } from "../../lib/context/UserLocationContext";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import { mapLocationBlurb } from "../../lib/aurora/conditions";

interface AuroraMapModalProps {
  userProb?: number | null;
  onClose: () => void;
}

export function AuroraMapModal({ userProb, onClose }: AuroraMapModalProps) {
  useBodyScrollLock();
  const { userLocationLabel, userLat } = useUserLocationContext();
  const hasLocation = userLat != null && userProb !== undefined;
  const locBlurb = hasLocation ? mapLocationBlurb(userProb ?? 0, userLocationLabel) : null;
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="aurora-map-modal-title"
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
              <Map className="h-4 w-4 text-[#94a3b8]" />
              <span id="aurora-map-modal-title" className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
                Aurora Map
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-1 -mr-1 focus:outline-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 pt-4 space-y-5">

            {/* Location context — first when location is set */}
            {locBlurb && (
              <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
                <p className="text-sm leading-relaxed">
                  <span className="font-semibold text-white">{locBlurb.first}</span>
                  {locBlurb.rest && <>{" "}<span className="text-[#94a3b8]">{locBlurb.rest}</span></>}
                </p>
              </div>
            )}

            {/* 1 — What the map is showing */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-1.5">What this map is showing</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                This is the <span className="text-[#94a3b8]">NOAA OVATION aurora forecast</span> — a
                model that predicts where the aurora oval is located and how intense it is right now,
                updated every few minutes using live solar wind data from the DSCOVR satellite about
                a million miles from Earth.
              </p>
              <p className="text-sm text-[#94a3b8] leading-relaxed mt-2">
                <span className="text-white font-semibold">This is not a live satellite image</span>{" "}
                and not a radar feed. It&apos;s a model forecast — think of it like a weather model
                that calculates where aurora is likely to be based on current space weather conditions.
              </p>
            </div>

            {/* 2 — What the colors mean */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-1.5">What the colors mean</div>
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#166534" }} />
                  <span className="text-[#94a3b8]">Dark green — very low, aurora mainly in polar regions</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#22c55e" }} />
                  <span className="text-[#94a3b8]">Bright green — low but real activity starting</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#eab308" }} />
                  <span className="text-[#94a3b8]">Yellow — moderate activity, oval pushing south</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#f97316" }} />
                  <span className="text-[#94a3b8]">Orange — strong activity, worth going outside</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#a78bfa" }} />
                  <span className="text-[#94a3b8]">Purple — high intensity, major aurora event</span>
                </div>
              </div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                When you see <span className="text-[#f97316]">orange</span> or{" "}
                <span className="text-[#a78bfa]">purple</span>{" "}over your area — that&apos;s your signal to head outside.
              </p>
            </div>

            {/* 3 — What the percentages mean */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-1.5">What the percentages actually mean</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                These are the OVATION model&apos;s estimate of how likely aurora is to be present in
                the <span className="text-[#94a3b8]">upper atmosphere</span>{" "}above each location —
                roughly 100 km up. They&apos;re not a simple &ldquo;chance of seeing it from your
                backyard&rdquo; number, because cloud cover and light pollution aren&apos;t in the model.
              </p>
              <div className="text-sm font-semibold text-[#cbd5e1] mt-2 mb-1">Don&apos;t dismiss moderate values</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                A reading of 20–30% over your area means there is real aurora above you right now.
                Whether you can see it depends on your skies — but the aurora is there. Anything
                above 15–20% is genuinely worth going outside for if conditions are clear.
              </p>
            </div>

            {/* Limitations */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-1.5">What the map can&apos;t tell you</div>
              <div className="space-y-2">
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  <span className="text-[#94a3b8]">Cloud cover:</span>{" "}
                  aurora above clouds is invisible from the ground. Check your local sky forecast before heading out.
                </p>
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  <span className="text-[#94a3b8]">Light pollution:</span>{" "}
                  faint aurora gets drowned out by city glow. Even a short drive to a darker spot makes a real difference at moderate activity levels.
                </p>
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  <span className="text-[#94a3b8]">Northern horizon:</span>{" "}
                  aurora appears low in the north first. Trees, hills, or buildings blocking your northern view will block your sighting. Find open sky.
                </p>
              </div>
            </div>

            {/* NOAA link */}
            <a
              href="https://www.swpc.noaa.gov/products/aurora-30-minute-forecast"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors pt-3 border-t border-[#1e2937]"
            >
              <span>Aurora 30-Minute Forecast on NOAA SWPC</span>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm text-[#94a3b8] hover:text-white border border-[#293548] hover:border-[#475569] rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
