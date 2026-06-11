"use client";

import { useState } from "react";
import { Zap, X, ChevronRight } from "lucide-react";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import { formatDistanceToNow } from "date-fns";
import type { XrayFlare } from "../../lib/api/schemas";
import { normalizeTimeTag } from "../../lib/utils/viewingWindow";

type FlareInfo = { color: string; tier: string; impact: string };

export function flareClassInfo(cls: string | null | undefined): FlareInfo {
  const letter = cls?.[0]?.toUpperCase() ?? "";
  if (letter === "X") return {
    color: "#a78bfa",
    tier: "Extreme",
    impact:
      "X-class flares are the most powerful solar eruptions. They can cause major radio blackouts on the sunlit side of Earth. Earth-directed X-flares frequently launch large CMEs that trigger significant geomagnetic storms — and potentially wide-latitude aurora — within 1–3 days.",
  };
  if (letter === "M") return {
    color: "#f97316",
    tier: "Moderate",
    impact:
      "M-class flares are moderate events that can cause brief radio blackouts at high latitudes. Earth-directed M-flares sometimes produce CMEs that enhance aurora chances in 1–3 days, especially when the associated magnetic field has a southward orientation (negative Bz).",
  };
  if (letter === "C") return {
    color: "#eab308",
    tier: "Minor",
    impact:
      "C-class flares are minor events with minimal direct aurora impact, representing routine solar activity. Occasional associated CMEs can provide a small geomagnetic boost, but C-flares rarely produce visible aurora at mid-latitudes on their own.",
  };
  return {
    color: "#64748b",
    tier: letter === "B" ? "Weak" : "Background",
    impact:
      "A/B-class flares are background X-ray noise from normal solar activity. They produce no radio blackouts and have no meaningful aurora impact.",
  };
}

function flareDuration(begin?: string, end?: string): string | null {
  if (!begin || !end) return null;
  const mins = Math.round(
    (new Date(end).getTime() - new Date(begin).getTime()) / 60000
  );
  if (mins < 1) return null;
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatUTC(iso: string | undefined): string {
  if (!iso) return "—";
  return (
    new Date(normalizeTimeTag(iso)).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }) + " UTC"
  );
}

export function FlareModal({
  flare,
  recentFlares = [],
  onClose,
}: {
  flare: XrayFlare;
  recentFlares?: XrayFlare[];
  onClose: () => void;
}) {
  useBodyScrollLock();
  const cls = flare.max_class || flare.current_class;
  const info = flareClassInfo(cls);
  const duration = flareDuration(flare.begin_time, flare.end_time);
  const peakTime = flare.max_time || flare.time_tag;
  const [goesState, setGoesState] = useState<"loading" | "loaded" | "failed">("loading");
  const [goesUrl] = useState(
    () => `https://services.swpc.noaa.gov/images/goes-xray-flux-1-minute.png?t=${Date.now()}`
  );

  const timingRows = [
    { label: "Begin", time: flare.begin_time },
    { label: "Peak", time: flare.max_time },
    { label: "End", time: flare.end_time },
  ] as const;

  const priorFlares = recentFlares.slice(1, 5);

  return (
    // Overlay is the scroll container — avoids the mobile-Safari 100vh chrome bug
    // where max-h-[90vh] overflows the visible area. Body scroll is locked via useEffect.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Flare details"
    >
      <div className="flex min-h-full items-center justify-center p-4">
      <div
        className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: info.color }} />
            <span className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
              Latest X-ray Flare
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
          {/* Class hero */}
          <div>
            <span
              className="text-5xl font-bold tracking-tighter tabular-nums leading-none"
              style={{ color: info.color }}
            >
              {cls ?? "—"}
            </span>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <span className="text-sm text-[#94a3b8]">{info.tier} flare</span>
              {flare.region != null && (
                <span className="text-xs text-[#64748b]">· Region {flare.region}</span>
              )}
            </div>
            {peakTime && (
              <div className="text-xs text-[#64748b] mt-0.5">
                {formatDistanceToNow(new Date(normalizeTimeTag(peakTime)), { addSuffix: true })}
              </div>
            )}
          </div>

          {/* Timing grid */}
          <div>
            <div className="text-sm font-semibold text-[#cbd5e1] mb-2">Timing</div>
            <div className="grid grid-cols-3 gap-2">
              {timingRows.map(({ label, time }) => (
                <div
                  key={label}
                  className="bg-[#0a0f1e] rounded-lg px-2 py-2.5 border border-[#1e2937] text-center"
                >
                  <div className="text-[9px] text-[#64748b] uppercase tracking-wide mb-1">
                    {label}
                  </div>
                  <div className="text-sm text-[#94a3b8] tabular-nums leading-snug">
                    {formatUTC(time)}
                  </div>
                </div>
              ))}
            </div>
            {duration && (
              <div className="text-xs text-[#64748b] mt-1.5 text-center">
                Duration: {duration}
              </div>
            )}
          </div>

          {/* Aurora impact explanation */}
          <div>
            <div className="text-sm font-semibold text-[#cbd5e1] mb-2">Aurora impact</div>
            <p className="text-sm text-[#94a3b8] leading-relaxed">{info.impact}</p>
          </div>

          {/* Recent flares */}
          {priorFlares.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">Recent flares</div>
              <div className="space-y-2">
                {priorFlares.map((f, i) => {
                  const fCls = f.max_class || f.current_class;
                  const { color } = flareClassInfo(fCls);
                  const t = f.max_time || f.time_tag;
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="font-mono font-semibold w-10 shrink-0" style={{ color }}>
                        {fCls ?? "—"}
                      </span>
                      <span className="text-[#64748b] flex-1">
                        {t ? formatDistanceToNow(new Date(normalizeTimeTag(t)), { addSuffix: true }) : "—"}
                      </span>
                      {f.region != null && (
                        <span className="text-[#475569]">R{f.region}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GOES X-ray flux chart */}
          <div>
            <div className="text-sm font-semibold text-[#cbd5e1] mb-2">
              GOES X-ray flux · last 24 hours
            </div>
            {goesState !== "failed" ? (
              <div className="rounded-lg overflow-hidden border border-[#1e2937] bg-black">
                {goesState === "loading" && (
                  <div className="h-28 animate-pulse bg-[#0f1425]" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={goesUrl}
                  alt="GOES X-ray flux chart showing recent solar flare activity"
                  onLoad={() => setGoesState("loaded")}
                  onError={() => setGoesState("failed")}
                  className={goesState === "loaded" ? "w-full" : "hidden"}
                />
              </div>
            ) : (
              <div className="h-14 flex items-center justify-center text-xs text-[#334155] border border-[#1e2937] rounded-lg">
                Chart temporarily unavailable
              </div>
            )}
            {goesState !== "failed" && (
              <div className="mt-1 text-[9px] text-[#334155]">
                Updates every minute · Source: NOAA GOES satellite
              </div>
            )}
          </div>

          {/* External link */}
          <a
            href="https://www.swpc.noaa.gov/products/goes-x-ray-flux"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors pt-3 border-t border-[#1e2937]"
          >
            <span>View full GOES X-ray data on NOAA</span>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          </a>
        </div>
      </div>
      </div>
    </div>
  );
}
