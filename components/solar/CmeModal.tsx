"use client";

import { TrendingUp, X, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { CmeSummary } from "../../lib/api/schemas";

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
              <TrendingUp className="h-4 w-4 text-[#64748b]" />
              <span className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
                Recent CME Activity
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
                        <div className="text-[11px] text-[#64748b] ml-4 mb-0.5">
                          Direction: {cme.direction}
                        </div>
                      )}
                      <div className="text-[11px] ml-4 mt-0.5" style={{ color }}>
                        {cme.earthImpact || "Analyzed — Earth impact uncertain"}
                      </div>
                      {cme.note && (
                        <div className="text-[11px] text-[#475569] ml-4 mt-1 leading-relaxed">
                          {cme.note}
                        </div>
                      )}
                      <div className="text-[10px] text-[#475569] ml-4 mt-1">
                        Alert issued {formatDistanceToNow(
                          new Date(Math.min(new Date(cme.time).getTime(), Date.now())),
                          { addSuffix: true }
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-[#64748b]">No CMEs detected recently.</p>
            )}

            {/* Color legend */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-2">Impact colors</div>
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
                      <span className="text-[12px] font-medium" style={{ color }}>{label}</span>
                      <span className="text-[11px] text-[#475569] ml-1.5">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Educational section */}
            <div>
              <div className="text-xs font-medium text-[#94a3b8] mb-2">Understanding CMEs</div>
              <div className="space-y-3 text-[12px] text-[#64748b] leading-relaxed">
                <p>
                  A coronal mass ejection is a large cloud of magnetized plasma expelled from the Sun. Unlike X-ray flares — which travel at light speed — CMEs travel at hundreds to thousands of kilometers per second and take 1–3 days to reach Earth.
                </p>
                <p>
                  <span className="text-[#94a3b8] font-medium">Speed and storm strength.</span>{" "}
                  Faster CMEs compress Earth&apos;s magnetosphere more forcefully, driving stronger geomagnetic storms. Very fast CMEs (2,000+ km/s) can arrive in under 24 hours; slower ones take 3 days or more.
                </p>
                <p>
                  <span className="text-[#94a3b8] font-medium">Direct vs. glancing.</span>{" "}
                  A direct hit means the CME core strikes Earth head-on. A glancing blow clips the outer magnetosphere — still capable of producing aurora, but typically weaker and shorter-lived.
                </p>
                <p>
                  <span className="text-[#94a3b8] font-medium">CMEs and Bz.</span>{" "}
                  Even a fast, Earth-directed CME won&apos;t produce strong aurora if its magnetic field arrives pointing northward (positive Bz). Aurora requires sustained southward Bz — this lets the CME&apos;s field connect to Earth&apos;s and drive a storm. Bz direction isn&apos;t known until the CME reaches the L1 monitoring point, roughly 15–60 minutes before impact.
                </p>
              </div>
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
