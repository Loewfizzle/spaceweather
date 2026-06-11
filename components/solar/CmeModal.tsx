"use client";

import { useState } from "react";
import { TrendingUp, X, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { CmeSummary } from "../../lib/api/schemas";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import { normalizeTimeTag } from "../../lib/utils/viewingWindow";
import { useDonkiCmes } from "../../lib/hooks/useNoaaQueries";
import { getVisibleCities } from "../../lib/aurora/visibleCities";

function formatCmeAge(isoTime: string): string {
  const t = new Date(normalizeTimeTag(isoTime)).getTime();
  if (!isFinite(t)) return '';
  return t > Date.now()
    ? 'just now'
    : formatDistanceToNow(new Date(t), { addSuffix: true });
}

// G-scale colors: green(G1) → yellow(G2) → orange(G3) → red(G4) → purple(G5)
const G_SCALE_COLORS: Record<string, string> = {
  G1: '#22c55e',
  G2: '#eab308',
  G3: '#f97316',
  G4: '#ef4444',
  G5: '#a78bfa',
};

function kpToGScale(kp: number | null): { scale: string; color: string } | null {
  if (kp === null || kp < 5) return null;
  if (kp >= 9) return { scale: 'G5', color: G_SCALE_COLORS.G5 };
  if (kp >= 8) return { scale: 'G4', color: G_SCALE_COLORS.G4 };
  if (kp >= 7) return { scale: 'G3', color: G_SCALE_COLORS.G3 };
  if (kp >= 6) return { scale: 'G2', color: G_SCALE_COLORS.G2 };
  return { scale: 'G1', color: G_SCALE_COLORS.G1 };
}

function formatArrivalDatetime(iso: string): string {
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

export function cmeImpactColor(impact: string | undefined): string {
  if (!impact) return "#eab308";
  const lc = impact.toLowerCase();
  if (lc.includes("likely")) return "#a78bfa";
  if (lc.includes("glancing")) return "#f97316";
  return "#eab308";
}

export function CmeModal({
  recentCmes,
  onClose,
}: {
  recentCmes: CmeSummary[];
  onClose: () => void;
}) {
  useBodyScrollLock();
  const [nowMs] = useState(Date.now);

  const { data: donkiData, isLoading: donkiLoading } = useDonkiCmes();

  // Most relevant CME: prefer the earliest future arrival; fall back to most recent past.
  const donkiCme = donkiData && donkiData.length > 0
    ? donkiData.reduce((best, curr) => {
        const bTime = new Date(best.arrivalTime).getTime();
        const cTime = new Date(curr.arrivalTime).getTime();
        const bFuture = bTime > nowMs;
        const cFuture = cTime > nowMs;
        if (bFuture && cFuture) return bTime < cTime ? best : curr;
        if (bFuture) return best;
        if (cFuture) return curr;
        return bTime > cTime ? best : curr;
      })
    : null;

  const gScale = donkiCme ? kpToGScale(donkiCme.kpIndex) : null;
  const { cities } = donkiCme?.kpIndex != null
    ? getVisibleCities(donkiCme.kpIndex)
    : { cities: [] };
  const cityExamples = cities.slice(0, 2).map((c) => `${c.name}, ${c.state}`).join(' and ');
  const visibilityText = cityExamples
    ? `Aurora may be visible as far south as ${cityExamples} under dark skies.`
    : donkiCme?.kpIndex != null
      ? 'Aurora may be visible at high latitudes under dark skies.'
      : '';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="CME activity details"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#94a3b8]" />
              <span className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
                Recent CME Activity
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
            {/* DONKI impact forecast — shown only when data is available, fails silently */}
            {donkiLoading ? (
              <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3 space-y-2">
                <div className="h-3.5 w-28 rounded animate-pulse bg-[#1e2937]" />
                <div className="h-3 w-full rounded animate-pulse bg-[#1e2937]" />
                <div className="h-3 w-4/5 rounded animate-pulse bg-[#1e2937]" />
              </div>
            ) : donkiCme ? (
              <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
                <div className="text-xs font-semibold text-[#cbd5e1] uppercase tracking-wide mb-3">
                  Impact Forecast
                </div>

                {/* Predicted arrival */}
                <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                  <span className="text-xs text-[#64748b] shrink-0">Predicted arrival:</span>
                  <span className="text-sm font-semibold text-white">
                    {formatDistanceToNow(new Date(donkiCme.arrivalTime), { addSuffix: true })}
                  </span>
                  <span className="text-xs text-[#64748b]">
                    ({formatArrivalDatetime(donkiCme.arrivalTime)})
                  </span>
                </div>

                {/* G-scale badge */}
                {gScale && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-[#64748b]">Expected storm:</span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded border"
                      style={{ color: gScale.color, borderColor: gScale.color, backgroundColor: gScale.color + '1a' }}
                    >
                      {gScale.scale} Storm
                    </span>
                  </div>
                )}

                {/* Aurora visibility */}
                {visibilityText && (
                  <p className="text-sm text-[#94a3b8] leading-relaxed">{visibilityText}</p>
                )}
              </div>
            ) : null}

            {/* CME list */}
            {recentCmes.length > 0 ? (
              <div className="space-y-3">
                {recentCmes.map((cme, i) => {
                  const color = cmeImpactColor(cme.earthImpact);
                  return (
                    <div key={i} className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-semibold text-[#cbd5e1] tabular-nums">
                            {cme.speed ? `${cme.speed.toLocaleString()} km/s` : "CME"}
                          </span>
                        </div>
                      </div>
                      {cme.direction && (
                        <div className="text-sm text-[#94a3b8] ml-4 mb-0.5">
                          Direction: {cme.direction}
                        </div>
                      )}
                      <div className="text-sm ml-4 mt-0.5" style={{ color }}>
                        {cme.earthImpact || "Analyzed — Earth impact uncertain"}
                      </div>
                      {cme.note && (
                        <div className="text-sm text-[#94a3b8] ml-4 mt-1 leading-relaxed">
                          {cme.note}
                        </div>
                      )}
                      <div className="text-[10px] text-[#64748b] ml-4 mt-1">
                        Alert issued {formatCmeAge(cme.time)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8]">No CMEs detected recently.</p>
            )}

            {/* Color legend */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">Impact colors</div>
              <div className="space-y-1.5">
                {[
                  { color: "#eab308", label: "Analyzed / uncertain", desc: "Earth impact not yet determined or unlikely" },
                  { color: "#f97316", label: "Glancing blow",         desc: "Partial impact possible — moderate storm chance" },
                  { color: "#a78bfa", label: "Expected / direct hit", desc: "Earth-directed — strong storm and aurora possible" },
                ].map(({ color, label, desc }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: color }}
                    />
                    <div>
                      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
                      <span className="text-sm text-[#94a3b8] ml-1.5">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Educational section */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">Understanding CMEs</div>
              <div className="space-y-3 text-sm text-[#94a3b8] leading-relaxed">
                <p>
                  A coronal mass ejection is a large cloud of magnetized plasma expelled from the Sun. Unlike X-ray flares — which travel at light speed — CMEs travel at hundreds to thousands of kilometers per second and take 1–3 days to reach Earth.
                </p>
                <p>
                  <span className="text-white font-semibold">Speed and storm strength.</span>{" "}
                  Faster CMEs compress Earth&apos;s magnetosphere more forcefully, driving stronger geomagnetic storms. Very fast CMEs (2,000+ km/s) can arrive in under 24 hours; slower ones take 3 days or more.
                </p>
                <p>
                  <span className="text-white font-semibold">Direct vs. glancing.</span>{" "}
                  A direct hit means the CME core strikes Earth head-on. A glancing blow clips the outer magnetosphere — still capable of producing aurora, but typically weaker and shorter-lived.
                </p>
                <p>
                  <span className="text-white font-semibold">CMEs and Bz.</span>{" "}
                  Even a fast, Earth-directed CME won&apos;t produce strong aurora if its magnetic field arrives pointing northward (positive Bz). Aurora requires sustained southward Bz — this lets the CME&apos;s field connect to Earth&apos;s and drive a storm. Bz direction isn&apos;t known until the CME reaches the L1 monitoring point, roughly 15–60 minutes before impact.
                </p>
              </div>
            </div>

            {/* NOAA link */}
            <a
              href="https://www.swpc.noaa.gov/products/real-time-solar-wind"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors pt-3 border-t border-[#1e2937]"
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
