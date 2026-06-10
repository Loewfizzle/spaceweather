"use client";

import { useRef } from "react";
import { X, ChevronRight, TrendingUp } from "lucide-react";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";

interface KpForecastModalProps {
  onClose: () => void;
}

export function KpForecastModal({ onClose }: KpForecastModalProps) {
  useBodyScrollLock();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kp-forecast-modal-title"
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
              <TrendingUp className="h-4 w-4 text-[#64748b]" />
              <span id="kp-forecast-modal-title" className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
                Kp Index &amp; Outlook
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

            {/* 1 — Reading the chart */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-2">Reading the chart</div>
              <div className="space-y-2">
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  <span className="font-semibold text-[#22c55e]">Solid green line</span>{" "}
                  — recent observed Kp history. These are measured values from ground-based
                  magnetometer stations worldwide — definitive data, not estimates.
                </p>
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  <span className="font-semibold text-[#94a3b8]">Dashed gray line</span>{" "}
                  — NOAA 36-hour Kp forecast. This is modeled output and will diverge from
                  observations as conditions evolve.
                </p>
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  <span className="font-semibold text-[#a78bfa]">Shaded violet region</span>{" "}
                  — tonight&apos;s aurora viewing window (8 PM – 6 AM ET), when skies are dark
                  enough across the northern US to see aurora.
                </p>
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  The horizontal lines at{" "}
                  <span className="font-semibold text-[#22c55e]">Kp 4</span>{" "}
                  and{" "}
                  <span className="font-semibold text-[#eab308]">Kp 5</span>{" "}
                  mark the key aurora thresholds. Kp 4 is the lower limit for seeing aurora
                  across the northern tier states under dark skies; Kp 5 marks the start of
                  a G1 geomagnetic storm.
                </p>
              </div>
            </div>

            {/* 2 — G-scale reference */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-2">The G-scale and what it means for you</div>
              <div className="space-y-2.5">
                <div className="flex gap-3 text-[12px]">
                  <span className="font-semibold flex-shrink-0 w-[96px] tabular-nums text-[#eab308]">G1 · Kp 5</span>
                  <span className="text-[#64748b] leading-relaxed">
                    Aurora visible across the northern US — Minnesota, Michigan, Vermont under dark skies.
                  </span>
                </div>
                <div className="flex gap-3 text-[12px]">
                  <span className="font-semibold flex-shrink-0 w-[96px] tabular-nums text-[#f97316]">G2 · Kp 6</span>
                  <span className="text-[#64748b] leading-relaxed">
                    Aurora reaches Chicago, Detroit, Portland, Boston.
                  </span>
                </div>
                <div className="flex gap-3 text-[12px]">
                  <span className="font-semibold flex-shrink-0 w-[96px] tabular-nums text-[#a78bfa]">G3 · Kp 7</span>
                  <span className="text-[#64748b] leading-relaxed">
                    Aurora visible as far south as Denver, Indianapolis, New York.
                  </span>
                </div>
                <div className="flex gap-3 text-[12px]">
                  <span className="font-semibold flex-shrink-0 w-[96px] tabular-nums text-[#a78bfa]">G4/G5 · Kp 8–9</span>
                  <span className="text-[#64748b] leading-relaxed">
                    Rare major storm — visible across most of the US including southern states.
                  </span>
                </div>
              </div>
            </div>

            {/* 3 — Forecast vs observed */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">Forecast vs. observed — why they differ</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                <span className="font-semibold text-[#94a3b8]">Observed</span>{" "}
                entries are measured by ground magnetometer stations worldwide and are
                definitive — they reflect what actually happened.
              </p>
              <p className="text-[12px] text-[#64748b] leading-relaxed mt-2">
                <span className="font-semibold text-[#94a3b8]">Estimated</span>{" "}
                and{" "}
                <span className="font-semibold text-[#94a3b8]">predicted</span>{" "}
                entries are NOAA model output and can diverge significantly from reality —
                especially beyond 24 hours. A CME arrival or a sudden Bz shift can make
                the forecast wrong within minutes.
              </p>
              <p className="text-[12px] text-[#64748b] leading-relaxed mt-2">
                Always weight the live Kp and current conditions over the forecast
                when they conflict.
              </p>
            </div>

            {/* 4 — 3-day storm outlook cards */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">The 3-day storm outlook cards</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                The daily cards below the chart show the highest forecasted Kp for each upcoming
                day — a quick snapshot of peak activity expected. Badge colors follow the G-scale:{" "}
                <span className="font-semibold text-[#475569]">dark gray</span>{" "}
                = quiet,{" "}
                <span className="font-semibold text-[#94a3b8]">gray</span>{" "}
                = unsettled,{" "}
                <span className="font-semibold text-[#22c55e]">green</span>{" "}
                = active (Kp 4),{" "}
                <span className="font-semibold text-[#eab308]">yellow</span>{" "}
                = G1,{" "}
                <span className="font-semibold text-[#f97316]">orange</span>{" "}
                = G2,{" "}
                <span className="font-semibold text-[#a78bfa]">purple</span>{" "}
                = G3+.
              </p>
              <p className="text-[12px] text-[#64748b] leading-relaxed mt-2">
                These are model predictions. Confidence decreases beyond 24 hours — treat
                the second and third day as a rough indicator, not a definitive forecast.
              </p>
            </div>

            {/* 5 — Why Kp updates every 3 hours */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-1.5">Why Kp updates every 3 hours</div>
              <p className="text-[12px] text-[#64748b] leading-relaxed">
                Kp is a 3-hour averaged index — it smooths out short-lived spikes. A 30-minute
                Bz dip might produce a brief aurora display that never shows up in the Kp reading.
                This is why watching{" "}
                <span className="font-semibold text-[#94a3b8]">live Bz</span>{" "}
                and the{" "}
                <span className="font-semibold text-[#94a3b8]">OVATION model</span>{" "}
                alongside Kp gives a more complete picture of what&apos;s happening right now.
              </p>
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
