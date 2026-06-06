"use client";

import { useState, useEffect } from "react";
import { Sun, TrendingUp, Zap, Cloud } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSolarActivity } from "../lib/use-noaa-data";

// Live NASA SDO imagery — updates every ~15 minutes.
// Using plain <img> (not next/image) so the browser always fetches the
// freshest frame directly from NASA rather than a cached optimised copy.
const SDO_SUNSPOT_URL = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg";
const SDO_CORONAL_URL = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0193.jpg";
const SDO_DATA_URL = "https://sdo.gsfc.nasa.gov/data/";

// Stop auto-refreshing after this many consecutive failures to avoid an indefinite
// loading→failed loop during a NASA SDO outage. Manual retry resets the counter.
const SDO_MAX_AUTO_FAILS = 3;

function SdoImage({ src, alt }: { src: string; alt: string }) {
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [consecutiveFails, setConsecutiveFails] = useState(0);

  const autoRefreshPaused = consecutiveFails >= SDO_MAX_AUTO_FAILS;

  // NASA SDO updates every ~15 min. Pause auto-refresh once the image has failed
  // repeatedly so the failed state doesn't keep resetting during an outage.
  useEffect(() => {
    if (autoRefreshPaused) return;
    const id = setInterval(() => {
      setAttempt((n) => n + 1);
      setImgState('loading');
    }, 1000 * 60 * 15);
    return () => clearInterval(id);
  }, [autoRefreshPaused]);

  const onLoad = () => {
    setImgState('loaded');
    setConsecutiveFails(0);
  };

  const onError = () => {
    setImgState('failed');
    setConsecutiveFails((n) => n + 1);
    console.warn('[AuroraWatch] SDO image failed to load:', src);
  };

  const retry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Reset fail counter so auto-refresh resumes if retry succeeds
    setConsecutiveFails(0);
    setImgState('loading');
    setAttempt((n) => n + 1);
  };

  const openSdo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(SDO_DATA_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative w-full aspect-square overflow-hidden bg-black">
      {/* Pulse skeleton while image is in-flight */}
      {imgState === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-[#0f1425]" />
      )}

      {/* Error state — no nested <a> (card is already an <a>); use buttons instead */}
      {imgState === 'failed' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="text-[#475569] text-xs leading-relaxed">
            {autoRefreshPaused
              ? 'NASA SDO temporarily unreachable'
              : 'Image temporarily unavailable'}
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
            <span className="text-[9px] text-[#334155]">
              Auto-refresh paused
            </span>
          )}
        </div>
      )}

      {/* Image always in DOM so the browser can fetch it; fades in once loaded.
          key={attempt} forces a full remount (and re-fetch) on retry.
          Using <img> intentionally — Next.js <Image> caches aggressively and breaks live NASA SDO refreshes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={onLoad}
        onError={onError}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          imgState === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

export function SolarActivity() {
  const solarActivity = useSolarActivity();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
      <div className="section-title flex items-baseline justify-between">
        <span>SOLAR ACTIVITY</span>
        <span className="text-[10px] font-normal text-[#64748b] normal-case tracking-normal">
          Key drivers of geomagnetic activity · Michigan-relevant
        </span>
      </div>

      {/* Row 1: compact text-stat cards — skeleton while NOAA data loads */}
      {solarActivity.isLoading ? (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[0, 1].map((i) => (
            <div key={i} className="metric">
              <div className="h-3 w-16 rounded animate-pulse bg-[#1e2937] mb-3" />
              <div className="h-8 w-14 rounded animate-pulse bg-[#1e2937] mb-1" />
              <div className="h-3 w-20 rounded animate-pulse bg-[#1e2937]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="metric">
            <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
              <Zap className="w-4 h-4" /> LATEST FLARE
            </div>
            <div className="text-4xl font-semibold tracking-tighter tabular-nums">
              {solarActivity.latestFlare?.max_class ||
                solarActivity.latestFlare?.current_class ||
                "—"}
            </div>
            <div className="text-sm text-[#64748b] -mt-1">
              {solarActivity.latestFlare?.max_time
                ? formatDistanceToNow(new Date(solarActivity.latestFlare.max_time), {
                    addSuffix: true,
                  })
                : solarActivity.flareTime
                ? formatDistanceToNow(new Date(solarActivity.flareTime), { addSuffix: true })
                : "—"}
              {solarActivity.latestFlare?.region
                ? ` · Region ${solarActivity.latestFlare.region}`
                : ""}
            </div>
            <div className="text-[10px] text-[#475569] mt-1">
              Most recent X-ray flare. Earth-facing flares are most relevant for Michigan aurora.
            </div>
          </div>

          <div className="metric">
            <div className="flex items-center gap-2 text-[#64748b] text-xs mb-2.5">
              <Cloud className="w-4 h-4" /> RECENT CMEs
            </div>
            <div className="text-2xl font-semibold tracking-tighter tabular-nums leading-tight">
              {solarActivity.recentCmes.length > 0
                ? solarActivity.recentCmes
                    .map((c) => (c.speed ? `${c.speed} km/s` : "CME"))
                    .join(" / ")
                : "—"}
            </div>
            <div className="text-sm text-[#64748b] -mt-1">
              {solarActivity.recentCmes.length > 0
                ? solarActivity.recentCmes[0].earthImpact || "Analyzed"
                : "No recent Earth-directed CMEs"}
            </div>
            <div className="text-[10px] text-[#475569] mt-1">
              {solarActivity.recentCmes.length > 0 &&
                solarActivity.recentCmes[0].direction
                ? `${solarActivity.recentCmes[0].direction} · `
                : ""}
              Earth-directed CMEs can trigger geomagnetic storms and aurora in 1–3 days.
            </div>
          </div>
        </div>
      )}

      {/* Row 2: live SDO image cards — rendered immediately, images load independently of NOAA data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Sunspot image card */}
        <a
          href={SDO_DATA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#0c1222] border border-[#1e2937] rounded-xl overflow-hidden hover:border-[#334155] transition-colors block"
        >
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
              <span className="text-[#334155]">↗ NASA SDO</span>
            </div>
          </div>

          <SdoImage
            src={SDO_SUNSPOT_URL}
            alt="Live SDO HMI Continuum image of the solar disk showing sunspot regions"
          />

          <div className="px-4 py-3 text-[10px] text-[#475569] leading-relaxed">
            <span className="text-[#64748b] font-medium">HMI Continuum</span> — visible-light
            view of the solar disk. Dark regions are sunspots where strong magnetic fields
            suppress convection. More active regions means higher flare and CME potential.{" "}
            <span className="text-[#334155]">Updates every ~15 min.</span>
          </div>
        </a>

        {/* Coronal holes image card */}
        <a
          href={SDO_DATA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#0c1222] border border-[#1e2937] rounded-xl overflow-hidden hover:border-[#334155] transition-colors block"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2937]">
            <div className="flex items-center gap-2 text-[#64748b] text-xs">
              <TrendingUp className="w-4 h-4" /> CORONAL HOLES
            </div>
            <span className="text-[10px] text-[#334155]">↗ NASA SDO</span>
          </div>

          <SdoImage
            src={SDO_CORONAL_URL}
            alt="Live SDO AIA 193Å extreme ultraviolet image showing coronal holes as dark regions"
          />

          <div className="px-4 py-3 text-[10px] text-[#475569] leading-relaxed">
            <span className="text-[#64748b] font-medium">AIA 193Å</span> — extreme ultraviolet
            view. Dark areas are coronal holes where open magnetic field lines let high-speed
            solar wind escape. Streams typically reach Earth in 2–4 days and can enhance aurora
            even during otherwise quiet periods.{" "}
            <span className="text-[#334155]">Updates every ~15 min.</span>
          </div>
        </a>
      </div>

      {solarActivity.error && (
        <div className="mt-2 text-[10px] text-amber-400">
          NOAA data temporarily unavailable — showing last known values.
          {solarActivity.isFetching && " Retrying…"}
        </div>
      )}

      <div className="text-[10px] text-[#64748b] mt-3">
        NOAA SWPC data · NASA SDO imagery · Flares update frequently; CMEs when analyzed; sunspots
        daily.
        {solarActivity.flareTime && (
          <span className="ml-2">
            Last flare update:{" "}
            {formatDistanceToNow(new Date(solarActivity.flareTime), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  );
}
