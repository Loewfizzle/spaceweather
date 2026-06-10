"use client";

import { useRef } from "react";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import { formatMeteorPeak } from "../../lib/aurora/meteors";
import type { MeteorShower } from "../../lib/api/schemas";

interface MeteorShowerModalProps {
  shower: MeteorShower;
  peakDate: Date;
  onClose: () => void;
}

function activityColor(level: string): string {
  const lc = level.toLowerCase();
  if (lc.includes("high")) return "#a78bfa";
  if (lc.includes("moderate")) return "#eab308";
  return "#94a3b8";
}

export function MeteorShowerModal({ shower, peakDate, onClose }: MeteorShowerModalProps) {
  useBodyScrollLock();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);
  const color = activityColor(shower.activityLevel);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="meteor-shower-modal-title"
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
              <Sparkles className="h-4 w-4 text-[#94a3b8]" />
              <span id="meteor-shower-modal-title" className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
                Meteor Shower
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

            {/* Shower summary box */}
            <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
              <div className="text-base font-semibold" style={{ color }}>{shower.name}</div>
              <div className="text-[12px] text-[#94a3b8] mt-0.5">{formatMeteorPeak(peakDate, shower)}</div>
              <div className="mt-2">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    color,
                    backgroundColor: color + "1a",
                    border: `1px solid ${color}33`,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  {shower.activityLevel} activity
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-[#1e2937] space-y-2">
                <p className="text-sm text-[#94a3b8] leading-relaxed">{shower.description}</p>
                {shower.parentComet && (
                  <p className="text-sm text-[#94a3b8] leading-relaxed">
                    <span className="text-[#94a3b8]">Parent comet:</span>{" "}{shower.parentComet}
                  </p>
                )}
                {shower.radiantConstellation && (
                  <p className="text-sm text-[#94a3b8] leading-relaxed">
                    <span className="text-[#94a3b8]">Radiant:</span>{" "}{shower.radiantConstellation}
                  </p>
                )}
                {shower.peakZHR && (
                  <p className="text-sm text-[#94a3b8] leading-relaxed">
                    <span className="text-[#94a3b8]">Peak ZHR:</span>{" "}{shower.peakZHR}
                  </p>
                )}
              </div>
            </div>

            {/* What causes meteor showers */}
            <div>
              <div className="text-xs font-semibold text-[#cbd5e1] mb-1.5">What causes meteor showers</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                As a comet travels through the inner solar system, heat from the Sun causes it to shed
                ice and dust, leaving a debris trail along its orbit. Earth passes through these trails
                at the same point each year. Each speck of comet dust — typically no larger than a grain
                of sand — enters the atmosphere at tens of thousands of kilometers per hour, compressing
                the air ahead of it and glowing brightly for a second or two before burning up completely.
              </p>
              <p className="text-sm text-[#94a3b8] leading-relaxed mt-2">
                The{" "}<span className="text-[#94a3b8]">radiant</span>{" "}is the point in the sky from
                which meteors appear to originate — a perspective effect, like driving through snow where
                all flakes seem to come from a single point ahead. Showers are named after the constellation
                containing their radiant.
              </p>
            </div>

            {/* Viewing tips */}
            <div>
              <div className="text-xs font-semibold text-[#cbd5e1] mb-1.5">Viewing tips</div>
              <div className="space-y-2">
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  <span className="text-[#94a3b8]">No equipment needed:</span>{" "}
                  binoculars and telescopes narrow your field of view too much. Lie flat on your back,
                  look up, and let your eyes scan the whole sky — meteors can appear anywhere, not just
                  near the radiant.
                </p>
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  <span className="text-[#94a3b8]">After midnight is best:</span>{" "}
                  your location rotates to face the direction Earth is traveling, scooping up more meteors
                  in the second half of the night. Rates typically double compared to early evening.
                </p>
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  <span className="text-[#94a3b8]">Dark adaptation takes 15–20 minutes:</span>{" "}
                  your eyes need time to adjust after any bright light. Avoid your phone — if you must
                  use it, switch to red mode. Once adapted, you&apos;ll see far more.
                </p>
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  <span className="text-[#94a3b8]">Moon phase matters:</span>{" "}
                  a full or gibbous moon washes out faint meteors just like light pollution. A new moon
                  gives the best conditions. Check the phase for peak night before heading out.
                </p>
              </div>
            </div>

            {/* AMS link */}
            <a
              href="https://www.amsmeteors.org/meteor-showers/meteor-shower-calendar/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors pt-3 border-t border-[#1e2937]"
            >
              <span>Meteor Shower Calendar on AMS</span>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
