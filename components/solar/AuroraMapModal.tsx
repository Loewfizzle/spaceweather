"use client";

import { useRef } from "react";
import { X, ChevronRight, Map } from "lucide-react";
import { useUserLocationContext } from "../../lib/context/UserLocationContext";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";

function locationBlurb(prob: number, label: string | null): { first: string; rest: string | null } {
  const name = label ?? "Your location";
  if (prob <= 0)  return { first: `${name} is showing no OVATION signal right now.`, rest: `The aurora oval isn't reaching your area.` };
  if (prob < 5)   return { first: `${name} is showing less than 5% on the OVATION model.`, rest: `The aurora oval is close but not quite overhead — very faint activity at best.` };
  if (prob < 15)  return { first: `${name} is showing ${Math.round(prob)}% — a faint but real signal.`, rest: `Aurora is present in your region, though it would be subtle. Dark skies and patience required.` };
  if (prob < 30)  return { first: `${name} is showing ${Math.round(prob)}% — a meaningful reading.`, rest: `There is aurora above your area right now. If skies are clear, it's worth going outside.` };
  if (prob < 50)  return { first: `${name} is showing ${Math.round(prob)}% — a solid signal.`, rest: `Aurora should be visible from your location under dark skies. Get away from city lights and look north.` };
  return { first: `${name} is showing ${Math.round(prob)}% — a strong OVATION signal directly over your location.`, rest: `This is an active aurora event at your latitude.` };
}

interface AuroraMapModalProps {
  userProb?: number | null;
  onClose: () => void;
}

export function AuroraMapModal({ userProb, onClose }: AuroraMapModalProps) {
  const { userLocationLabel, userLat } = useUserLocationContext();
  const hasLocation = userLat != null && userProb !== undefined;
  const locBlurb = hasLocation ? locationBlurb(userProb ?? 0, userLocationLabel) : null;
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Aurora map explained"
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
              <Map className="h-4 w-4 text-[#64748b]" />
              <span className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
                Aurora Map
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

            {/* Location context — first when location is set */}
            {locBlurb && (
              <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
                <p className="text-[12px] leading-relaxed">
                  <span className="font-semibold text-[#94a3b8]">{locBlurb.first}</span>
                  {locBlurb.rest && <>{" "}<span className="text-[#64748b]">{locBlurb.rest}</span></>}
                </p>
              </div>
            )}

            {/* 1 — What the map is showing */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">What this map is showing</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                This is the <span className="text-[#94a3b8]">NOAA OVATION aurora forecast</span> — a
                model that predicts where the aurora oval is located and how intense it is right now,
                updated every few minutes using live solar wind data from the DSCOVR satellite about
                a million miles from Earth.
              </p>
              <p className="text-[12px] text-[#64748b] leading-relaxed mt-2">
                <span className="text-[#94a3b8] font-semibold">This is not a live satellite image</span>{" "}
                and not a radar feed. It&apos;s a model forecast — think of it like a weather model
                that calculates where aurora is likely to be based on current space weather conditions.
              </p>
            </div>

            {/* 2 — What the colors mean */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">What the colors mean</div>
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center gap-2.5 text-[12px]">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#166534" }} />
                  <span className="text-[#64748b]">Dark green — very low, aurora mainly in polar regions</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12px]">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#22c55e" }} />
                  <span className="text-[#64748b]">Bright green — low but real activity starting</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12px]">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#eab308" }} />
                  <span className="text-[#64748b]">Yellow — moderate activity, oval pushing south</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12px]">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#f97316" }} />
                  <span className="text-[#64748b]">Orange — strong activity, worth going outside</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12px]">
                  <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: "#a78bfa" }} />
                  <span className="text-[#64748b]">Purple — high intensity, major aurora event</span>
                </div>
              </div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                When you see <span className="text-[#f97316]">orange</span> or{" "}
                <span className="text-[#a78bfa]">purple</span>{" "}over your area — that&apos;s your signal to head outside.
              </p>
            </div>

            {/* 3 — What the percentages mean */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">What the percentages actually mean</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                These are the OVATION model&apos;s estimate of how likely aurora is to be present in
                the <span className="text-[#94a3b8]">upper atmosphere</span>{" "}above each location —
                roughly 100 km up. They&apos;re not a simple &ldquo;chance of seeing it from your
                backyard&rdquo; number, because cloud cover and light pollution aren&apos;t in the model.
              </p>
              <div className="text-xs font-medium text-[#94a3b8] mt-2 mb-1">Don&apos;t dismiss moderate values</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                A reading of 20–30% over your area means there is real aurora above you right now.
                Whether you can see it depends on your skies — but the aurora is there. Anything
                above 15–20% is genuinely worth going outside for if conditions are clear.
              </p>
            </div>

            {/* 4 — How the slider works */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">How the filter slider works</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                The slider at the bottom sets a minimum probability threshold for what gets drawn on
                the map. At 3% (the default) you see all active aurora areas. Drag it right to filter
                out low-probability regions and focus on where aurora is strongest — useful when the
                map is busy during an active event. Drag it back left to see the full picture again.
              </p>
            </div>

            {/* Limitations */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">What the map can&apos;t tell you</div>
              <div className="space-y-2">
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  <span className="text-[#94a3b8]">Cloud cover:</span>{" "}
                  aurora above clouds is invisible from the ground. Check your local sky forecast before heading out.
                </p>
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  <span className="text-[#94a3b8]">Light pollution:</span>{" "}
                  faint aurora gets drowned out by city glow. Even a short drive to a darker spot makes a real difference at moderate activity levels.
                </p>
                <p className="text-[12px] text-[#64748b] leading-relaxed">
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
              className="flex items-center justify-between w-full text-xs text-[#475569] hover:text-[#64748b] transition-colors pt-3 border-t border-[#1e2937]"
            >
              <span>Aurora 30-Minute Forecast on NOAA SWPC</span>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
