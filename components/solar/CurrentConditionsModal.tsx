"use client";

import { useRef } from "react";
import { X, ChevronRight, Activity } from "lucide-react";
import { useUserLocationContext } from "../../lib/context/UserLocationContext";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import {
  windBlurb,
  bzBlurb,
  liveKpBlurb,
  ovationNABlurb,
  ovationUserBlurb,
} from "../../lib/aurora/conditions";

// ── Modal ─────────────────────────────────────────────────────────────────────

interface CurrentConditionsModalProps {
  kp: number | null;
  bz: number | null;
  solarWindSpeed: number | null;
  maxAuroraProbNA: number | null;
  ovationProcessed?: boolean;
  userLocationProb?: number | null;
  onClose: () => void;
}

export function CurrentConditionsModal({
  kp,
  bz,
  solarWindSpeed,
  maxAuroraProbNA,
  ovationProcessed,
  userLocationProb,
  onClose,
}: CurrentConditionsModalProps) {
  useBodyScrollLock();
  const { userLocationLabel } = useUserLocationContext();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);

  const wind = windBlurb(solarWindSpeed);
  const bzData = bzBlurb(bz);
  const kpData = liveKpBlurb(kp);
  const ovationNA = ovationNABlurb(maxAuroraProbNA, ovationProcessed);
  const ovationUser = ovationUserBlurb(userLocationProb ?? null, userLocationLabel);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="current-conditions-modal-title"
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
              <Activity className="h-4 w-4 text-[#64748b]" />
              <span id="current-conditions-modal-title" className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
                Live Conditions
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

            {/* Location box — shown first when location is set */}
            {ovationUser && (
              <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
                <p className="text-[12px] leading-relaxed">
                  <span className="font-semibold text-[#94a3b8]">{ovationUser.first}</span>
                  {ovationUser.rest && <>{" "}<span className="text-[#64748b]">{ovationUser.rest}</span></>}
                </p>
              </div>
            )}

            {/* 1 — The key distinction */}
            <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">Live now vs. tonight&apos;s forecast</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                <span className="text-[#94a3b8] font-semibold">Live Conditions</span> is the real-time
                feed — data from NOAA satellites updated minute by minute, like looking out the window
                right now.
              </p>
              <p className="text-[12px] text-[#64748b] leading-relaxed mt-2">
                <span className="text-[#94a3b8] font-semibold">Tonight&apos;s Forecast</span>{" "}is the
                big-picture prediction for the night ahead — a 36-hour outlook that tells you when
                conditions might peak after sunset. Both matter; this section is about what&apos;s happening
                this instant.
              </p>
            </div>

            {/* 2 — Solar wind */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1">Solar Wind</div>
              <div className="text-[11px] text-[#475569] mb-1.5">{wind.status}</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                The Sun constantly blows a stream of charged particles into space — that&apos;s the solar
                wind. When it speeds up, it delivers more energy to Earth&apos;s magnetic field and makes
                aurora more likely. {wind.body}
              </p>
            </div>

            {/* 3 — IMF Bz */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1">IMF Bz</div>
              <div className="text-[11px] text-[#475569] mb-1.5">{bzData.status}</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                Bz measures the north-south direction of the magnetic field embedded in the solar wind.
                Southward (negative) means the fields line up with Earth&apos;s and energy flows in —
                that&apos;s what drives aurora. Northward (positive) blocks it almost entirely.{" "}
                {bzData.body}
              </p>
            </div>

            {/* 4 — Planetary Kp */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1">Planetary Kp — live reading</div>
              <div className="text-[11px] text-[#475569] mb-1.5">{kpData.status}</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                Kp is a 0–9 scale of how disturbed Earth&apos;s magnetic field is right now, averaged
                from stations worldwide. This is the <span className="text-[#94a3b8]">current live reading</span>{" "}—
                different from the forecasted Kp in Tonight&apos;s Forecast, which looks ahead. Higher
                Kp means aurora reaches further south.{" "}
                {kpData.body}
              </p>
            </div>

            {/* 5 — OVATION */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1">NOAA OVATION Model</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed mb-2">
                OVATION is a scientific model from NOAA that analyses live solar wind data and calculates
                where the aurora oval is and how intense it is right now. The percentage shown on the
                card is the <span className="text-[#94a3b8]">peak model output anywhere in North America</span>{" "}—
                not a simple &ldquo;chance of seeing aurora.&rdquo; Think of it more like a radar return:
                0% means the oval is well above Canada; 50%+ means a major aurora event is in progress
                over the continent.
              </p>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                {ovationNA}
              </p>
            </div>

            {/* NOAA link */}
            <a
              href="https://www.swpc.noaa.gov/products/real-time-solar-wind"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-xs text-[#475569] hover:text-[#64748b] transition-colors pt-3 border-t border-[#1e2937]"
            >
              <span>Real-Time Solar Wind on NOAA SWPC</span>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
