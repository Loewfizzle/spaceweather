"use client";

import { useState, useEffect } from "react";
import { Sun, TrendingUp, Zap, X, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSolarActivity } from "../lib/use-noaa-data";
import type { XrayFlare, CmeSummary } from "../lib/api/schemas";
import { assessEarthImpact } from "../lib/noaa";

// ── Constants ─────────────────────────────────────────────────────────────────

const SDO_SUNSPOT_URL = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg";
const SDO_CORONAL_URL = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0193.jpg";
const SDO_DATA_URL = "https://sdo.gsfc.nasa.gov/data/";
const GOES_FLUX_URL = "https://services.swpc.noaa.gov/images/goes-xray-flux-1-minute.png";
const SDO_MAX_AUTO_FAILS = 3;

// ── Flare helpers ─────────────────────────────────────────────────────────────

type FlareInfo = { color: string; tier: string; impact: string };

function flareClassInfo(cls: string | undefined): FlareInfo {
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
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }) + " UTC"
  );
}

function cmeImpactColor(impact: string | undefined): string {
  if (!impact) return "#64748b";
  const lc = impact.toLowerCase();
  if (lc.includes("expected") || lc.includes("direct hit")) return "#f97316";
  if (lc.includes("glancing")) return "#eab308";
  return "#64748b";
}

// ── SDO Image ─────────────────────────────────────────────────────────────────

function SdoImage({ src, alt }: { src: string; alt: string }) {
  const [imgState, setImgState] = useState<"loading" | "loaded" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  const autoRefreshPaused = consecutiveFails >= SDO_MAX_AUTO_FAILS;

  // NASA SDO updates every ~15 min. Pause auto-refresh after repeated failures.
  useEffect(() => {
    if (autoRefreshPaused) return;
    const id = setInterval(() => {
      setAttempt((n) => n + 1);
      setImgState("loading");
    }, 1000 * 60 * 15);
    return () => clearInterval(id);
  }, [autoRefreshPaused]);

  const onLoad = () => {
    setImgState("loaded");
    setConsecutiveFails(0);
  };
  const onError = () => {
    setImgState("failed");
    setConsecutiveFails((n) => n + 1);
    console.warn("[AuroraWatch] SDO image failed to load:", src);
  };
  const retry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConsecutiveFails(0);
    setImgState("loading");
    setAttempt((n) => n + 1);
  };
  const openSdo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(SDO_DATA_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative w-full aspect-square overflow-hidden bg-black">
      {imgState === "loading" && (
        <div className="absolute inset-0 animate-pulse bg-[#0f1425]" />
      )}
      {imgState === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="text-[#475569] text-xs leading-relaxed">
            {autoRefreshPaused
              ? "NASA SDO temporarily unreachable"
              : "Image temporarily unavailable"}
          </span>
          <button
            onClick={openSdo}
            className="text-[10px] text-[#64748b] hover:text-white underline underline-offset-2 transition-colors"
          >
            View on NASA SDO ↗
          </button>
          <button
            onClick={retry}
            className="text-[10px] text-[#475569] hover:text-[#64748b] transition-colors"
          >
            Retry
          </button>
          {autoRefreshPaused && (
            <span className="text-[9px] text-[#334155]">Auto-refresh paused</span>
          )}
        </div>
      )}
      {/* Using <img> intentionally — Next.js <Image> caches aggressively and breaks live SDO refreshes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={onLoad}
        onError={onError}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          imgState === "loaded" ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

// ── Flare Modal ───────────────────────────────────────────────────────────────

function FlareModal({
  flare,
  recentCmes,
  onClose,
}: {
  flare: XrayFlare;
  recentCmes: CmeSummary[];
  onClose: () => void;
}) {
  const cls = flare.max_class || flare.current_class;
  const info = flareClassInfo(cls);
  const duration = flareDuration(flare.begin_time, flare.end_time);
  const peakTime = flare.max_time || flare.time_tag;
  const [goesState, setGoesState] = useState<"loading" | "loaded" | "failed">("loading");
  const impact = assessEarthImpact(recentCmes);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const timingRows = [
    { label: "Begin", time: flare.begin_time },
    { label: "Peak", time: flare.max_time },
    { label: "End", time: flare.end_time },
  ] as const;

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
            <span className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
              Latest X-ray Flare
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
                <span className="text-xs text-[#475569]">· Region {flare.region}</span>
              )}
            </div>
            {peakTime && (
              <div className="text-xs text-[#475569] mt-0.5">
                {formatDistanceToNow(new Date(peakTime), { addSuffix: true })}
              </div>
            )}
          </div>

          {/* Timing grid */}
          <div>
            <div className="text-xs font-medium text-[#64748b] mb-2">Timing</div>
            <div className="grid grid-cols-3 gap-2">
              {timingRows.map(({ label, time }) => (
                <div
                  key={label}
                  className="bg-[#0a0f1e] rounded-lg px-2 py-2.5 border border-[#1e2937] text-center"
                >
                  <div className="text-[9px] text-[#475569] uppercase tracking-wide mb-1">
                    {label}
                  </div>
                  <div className="text-[11px] text-[#94a3b8] tabular-nums leading-snug">
                    {formatUTC(time)}
                  </div>
                </div>
              ))}
            </div>
            {duration && (
              <div className="text-[11px] text-[#475569] mt-1.5 text-center">
                Duration: {duration}
              </div>
            )}
          </div>

          {/* Aurora impact explanation */}
          <div>
            <div className="text-xs font-medium text-[#94a3b8] mb-2">Aurora impact</div>
            <p className="text-[13px] text-[#64748b] leading-relaxed">{info.impact}</p>
          </div>

          {/* Earth impact assessment */}
          {(() => {
            const dotColor =
              impact.level === "likely"
                ? "#f97316"
                : impact.level === "possible"
                ? "#eab308"
                : "#475569";
            return (
              <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: dotColor }}
                  >
                    {impact.headline}
                  </span>
                </div>
                <p className="text-[12px] text-[#64748b] leading-relaxed">{impact.detail}</p>
                {impact.cme && (
                  <div className="mt-1.5 text-[10px] text-[#475569]">
                    Detected{" "}
                    {formatDistanceToNow(new Date(impact.cme.time), { addSuffix: true })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* GOES X-ray flux chart */}
          <div>
            <div className="text-xs font-medium text-[#94a3b8] mb-2">
              GOES X-ray flux · last 24 hours
            </div>
            {goesState !== "failed" ? (
              <div className="rounded-lg overflow-hidden border border-[#1e2937] bg-black">
                {goesState === "loading" && (
                  <div className="h-28 animate-pulse bg-[#0f1425]" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={GOES_FLUX_URL}
                  alt="GOES X-ray flux chart showing recent solar flare activity"
                  onLoad={() => setGoesState("loaded")}
                  onError={() => setGoesState("failed")}
                  className={goesState === "loaded" ? "w-full" : "hidden"}
                />
              </div>
            ) : (
              <div className="h-14 flex items-center justify-center text-[11px] text-[#334155] border border-[#1e2937] rounded-lg">
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
            className="flex items-center justify-between w-full text-xs text-[#475569] hover:text-[#64748b] transition-colors pt-3 border-t border-[#1e2937]"
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

// ── Main Component ────────────────────────────────────────────────────────────

export function SolarActivity() {
  const solarActivity = useSolarActivity();
  const [showFlareModal, setShowFlareModal] = useState(false);

  const latestFlare = solarActivity.latestFlare;
  const flareClass = latestFlare?.max_class || latestFlare?.current_class;
  const flareInfo = flareClassInfo(flareClass);
  const flareTime = latestFlare?.max_time || solarActivity.flareTime;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
      <div className="section-title">SOLAR ACTIVITY</div>

      {/* Metric cards: Latest Flare + Recent CMEs */}
      {solarActivity.isLoading ? (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[0, 1].map((i) => (
            <div key={i} className="metric">
              <div className="h-3 w-16 rounded animate-pulse bg-[#1e2937] mb-3" />
              <div className="h-8 w-14 rounded animate-pulse bg-[#1e2937] mb-2" />
              <div className="h-3 w-24 rounded animate-pulse bg-[#1e2937]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Latest Flare — clickable when data is available */}
          <button
            className="metric text-left w-full hover:border-[#293548] transition-colors group disabled:cursor-default"
            onClick={() => latestFlare && setShowFlareModal(true)}
            disabled={!latestFlare}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#64748b] text-xs">
                <Zap
                  className="w-4 h-4"
                  style={flareClass ? { color: flareInfo.color } : undefined}
                />
                LATEST FLARE
              </div>
              {latestFlare && (
                <span className="text-[10px] text-[#334155] group-hover:text-[#475569] transition-colors flex items-center gap-0.5">
                  Details <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </div>

            <div
              className="text-4xl font-semibold tracking-tighter tabular-nums leading-none"
              style={flareClass ? { color: flareInfo.color } : undefined}
            >
              {flareClass ?? "—"}
            </div>

            {flareClass && (
              <div className="text-xs mt-1.5" style={{ color: flareInfo.color }}>
                {flareInfo.tier} flare
              </div>
            )}

            <div className="text-xs text-[#64748b] mt-0.5">
              {flareTime
                ? formatDistanceToNow(new Date(flareTime), { addSuffix: true })
                : "—"}
              {latestFlare?.region != null && ` · Region ${latestFlare.region}`}
            </div>

            {!latestFlare && !solarActivity.error && (
              <div className="text-[10px] text-[#475569] mt-1">
                No flares detected recently.
              </div>
            )}
          </button>

          {/* Recent CMEs */}
          <div className="metric">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-[#64748b] text-xs">
                <TrendingUp className="w-4 h-4" /> RECENT CMEs
              </div>
              {solarActivity.recentCmes.length > 0 && (
                <span className="text-[10px] text-[#334155] tabular-nums">
                  {solarActivity.recentCmes.length} detected
                </span>
              )}
            </div>

            {solarActivity.recentCmes.length > 0 ? (
              <div className="space-y-2.5">
                {solarActivity.recentCmes.slice(0, 3).map((cme, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div
                      className="mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cmeImpactColor(cme.earthImpact) }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#cbd5e1] tabular-nums leading-tight">
                        {cme.speed ? `${cme.speed.toLocaleString()} km/s` : "CME"}
                      </div>
                      <div
                        className="text-[11px] leading-tight mt-0.5"
                        style={{ color: cmeImpactColor(cme.earthImpact) }}
                      >
                        {cme.earthImpact || "Analyzed"}
                      </div>
                      <div className="text-[10px] text-[#475569] mt-0.5">
                        {formatDistanceToNow(new Date(cme.time), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[#64748b]">—</div>
            )}

            <div className="text-[10px] text-[#475569] mt-3 pt-2.5 border-t border-[#0f1425]">
              {solarActivity.recentCmes.some((c) => {
                const lc = (c.earthImpact ?? "").toLowerCase();
                return lc.includes("expected") || lc.includes("direct");
              })
                ? "Earth-directed CMEs typically arrive in 1–3 days."
                : "Earth-directed CMEs can trigger aurora in 1–3 days."}
            </div>
          </div>
        </div>
      )}

      {/* Live SDO imagery */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#0c1222] border border-[#1e2937] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2937]">
            <div className="flex items-center gap-2 text-[#64748b] text-xs">
              <Sun className="w-4 h-4" /> SUNSPOTS
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              {solarActivity.sunspotNumber !== null ? (
                <span className="text-[#94a3b8]">
                  <span className="tabular-nums font-semibold text-[#cbd5e1]">
                    {solarActivity.sunspotNumber}
                  </span>
                  <span className="text-[#64748b] ml-1">today</span>
                </span>
              ) : solarActivity.regionsError ? (
                <span className="text-amber-400/70">data delayed</span>
              ) : null}
            </div>
          </div>

          <SdoImage
            src={SDO_SUNSPOT_URL}
            alt="Live SDO HMI Continuum image of the solar disk showing sunspot regions"
          />

          <div className="px-4 pt-3 pb-2 space-y-2.5">
            <p className="text-[10px] text-[#475569] leading-relaxed">
              <span className="text-[#64748b] font-medium">HMI Continuum</span> — visible-light
              view of the solar disk. Sunspots mark regions of intense magnetic activity. A higher
              count means more flare and CME potential — the primary drivers of aurora.
            </p>
            <div className="flex items-center justify-between pb-1">
              <span className="text-[9px] text-[#334155]">Updates every ~15 min</span>
              <a
                href={SDO_DATA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#475569] hover:text-[#64748b] transition-colors"
              >
                View full data on NASA SDO ↗
              </a>
            </div>
          </div>
        </div>

        <div className="bg-[#0c1222] border border-[#1e2937] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2937]">
            <div className="flex items-center gap-2 text-[#64748b] text-xs">
              <TrendingUp className="w-4 h-4" /> CORONAL HOLES
            </div>
          </div>

          <SdoImage
            src={SDO_CORONAL_URL}
            alt="Live SDO AIA 193Å extreme ultraviolet image showing coronal holes as dark regions"
          />

          <div className="px-4 pt-3 pb-2 space-y-2.5">
            <p className="text-[10px] text-[#475569] leading-relaxed">
              <span className="text-[#64748b] font-medium">AIA 193Å</span> — extreme ultraviolet
              view. Dark patches are coronal holes streaming high-speed solar wind into space. When
              a hole faces Earth, the arriving plasma can compress the magnetosphere and spark
              aurora — even without a flare or CME.
            </p>
            <div className="flex items-center justify-between pb-1">
              <span className="text-[9px] text-[#334155]">Updates every ~15 min</span>
              <a
                href={SDO_DATA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#475569] hover:text-[#64748b] transition-colors"
              >
                View full data on NASA SDO ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      {solarActivity.error && (
        <div className="mt-2 text-[10px] text-amber-400">
          NOAA data temporarily unavailable — showing last known values.
          {solarActivity.isFetching && " Retrying…"}
        </div>
      )}

      <div className="text-[10px] text-[#64748b] mt-3">
        NOAA SWPC data · NASA SDO imagery · Flares update frequently; CMEs when analyzed; sunspots daily.
        {solarActivity.flareTime && (
          <span className="ml-2">
            Flares last updated{" "}
            {formatDistanceToNow(new Date(solarActivity.flareTime), { addSuffix: true })}
          </span>
        )}
      </div>

      {showFlareModal && latestFlare && (
        <FlareModal
          flare={latestFlare}
          recentCmes={solarActivity.recentCmes}
          onClose={() => setShowFlareModal(false)}
        />
      )}
    </div>
  );
}
