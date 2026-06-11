"use client";

import { Sun, X, ChevronRight } from "lucide-react";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";

const SUNSPOT_SCALE = [
  { min: 0,   label: "Quiet",         range: "0–29",    color: "#64748b" },
  { min: 30,  label: "Below average", range: "30–59",   color: "#94a3b8" },
  { min: 60,  label: "Moderate",      range: "60–99",   color: "#eab308" },
  { min: 100, label: "High",          range: "100–199", color: "#f97316" },
  { min: 200, label: "Very high",     range: "200+",    color: "#a78bfa" },
];

export function sunspotContext(n: number): { label: string; color: string } {
  if (n >= 200) return { label: "very high", color: "#a78bfa" };
  if (n >= 150) return { label: "high", color: "#f97316" };
  if (n >= 100) return { label: "moderately elevated", color: "#f97316" };
  if (n >= 60)  return { label: "moderate", color: "#eab308" };
  if (n >= 30)  return { label: "below average", color: "#94a3b8" };
  return { label: "quiet", color: "#64748b" };
}

export function SunspotModal({
  sunspotNumber,
  onClose,
}: {
  sunspotNumber: number;
  onClose: () => void;
}) {
  useBodyScrollLock();
  const ctx = sunspotContext(sunspotNumber);
  const activeTierIdx = SUNSPOT_SCALE.reduce(
    (active, t, i) => (sunspotNumber >= t.min ? i : active),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sunspot details"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" style={{ color: ctx.color }} />
              <span className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
                Sunspot Number
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
            {/* Number hero */}
            <div>
              <span
                className="text-5xl font-bold tracking-tighter tabular-nums leading-none"
                style={{ color: ctx.color }}
              >
                {sunspotNumber}
              </span>
              <div className="mt-1.5">
                <span className="text-sm text-[#94a3b8]">{ctx.label}</span>
              </div>
            </div>

            {/* Solar Cycle 25 context */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">Solar Cycle 25</div>
              <p className="text-[13px] text-[#94a3b8] leading-relaxed">
                We are currently near the peak of Solar Cycle 25, which was predicted to reach
                maximum activity around 2025. Solar maxima bring higher sunspot counts, more
                frequent flares, and more CMEs — making aurora more common and potentially intense.
              </p>
            </div>

            {/* Activity scale */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">Activity scale</div>
              <div className="space-y-1">
                {SUNSPOT_SCALE.map((tier, i) => (
                  <div
                    key={tier.label}
                    className={`flex items-center justify-between rounded-lg px-3 py-1.5 border text-[12px] ${
                      i === activeTierIdx
                        ? "bg-[#0a0f1e] border-[#293548]"
                        : "border-transparent"
                    }`}
                  >
                    <span className="font-medium" style={{ color: tier.color }}>
                      {tier.label}
                    </span>
                    <span className="tabular-nums text-[#64748b]">{tier.range}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Aurora connection */}
            <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                Higher sunspot numbers mean more active magnetic regions on the solar surface.
                These are the source of X-ray flares and coronal mass ejections (CMEs) — the
                events that drive geomagnetic storms and aurora here on Earth.
              </p>
            </div>

            {/* NOAA link */}
            <a
              href="https://www.swpc.noaa.gov/products/solar-cycle-progression"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors pt-3 border-t border-[#1e2937]"
            >
              <span>Solar Cycle Progression on NOAA SWPC</span>
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
