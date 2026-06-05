"use client";

import {
  Zap,
  Activity,
  RefreshCw,
} from "lucide-react";
import { Suspense } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  useCurrentConditions,
  useSolarActivity,
  useFireballs,
  getTonightOutlook,
} from "../lib/use-noaa-data";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { HeroOutlook } from "../components/HeroOutlook";
import { CurrentConditions } from "../components/CurrentConditions";
import { AuroraMapSection } from "../components/AuroraMapSection";
import { KpForecast } from "../components/KpForecast";
import { SolarActivity } from "../components/SolarActivity";
import { MeteorActivity } from "../components/MeteorActivity";
import { DataUnderstanding } from "../components/DataUnderstanding";
import { AlertsPanel } from "../components/AlertsPanel";
import { useGlobalFreshness } from "../lib/hooks/useGlobalFreshness";
import { logDataError } from "../lib/utils/retry";

// Lightweight Suspense fallbacks matching the app's premium dark skeleton style
const MapSectionSkeleton = () => <LoadingSkeleton variant="map" className="max-w-7xl mx-auto px-4 sm:px-6 pb-12" />;

const KpOutlookSkeleton = () => <LoadingSkeleton variant="chart" className="max-w-7xl mx-auto px-4 sm:px-6 pb-12" />;

const SolarActivitySkeleton = () => <LoadingSkeleton variant="metrics" count={4} className="max-w-7xl mx-auto px-4 sm:px-6 pb-10" />;

export default function AuroraWatch() {
  const conditions = useCurrentConditions();
  const {
    kp,
    kpTime,
    maxAuroraProbNA,
    solarWindSpeed,
    solarWindDensity,
    bz,
    michiganGuidance,
    riskLevel,
    isLoading,
    error,
    solarWindError,
    isFetching,
    refetchAll,
  } = conditions;

  // New solar activity data (flares, CMEs, sunspots, coronal holes)
  const solarActivity = useSolarActivity();

  const fireballsQuery = useFireballs();

  // Observability: structured logging (dev always, prod throttled for critical)
  if (fireballsQuery.error) {
    logDataError('Fireball tracker (NASA)', fireballsQuery.error, ['useFireballs'], false);
  }

  const tonightOutlook = getTonightOutlook(
    kp,
    bz,
    maxAuroraProbNA,
    solarActivity.recentCmes,
    solarActivity.latestFlare
  );

  // Global last updated timestamp across main data sources (via dedicated hook for separation)
  const latestGlobalUpdate = useGlobalFreshness(
    kpTime,
    solarActivity.flareTime,
    solarActivity.alertsTime,
    solarActivity.regionsTime
  );

  const kpClass = kp === null
    ? "kp-low"
    : kp >= 5
    ? "kp-high"
    : kp >= 4
    ? "kp-moderate"
    : "kp-low";

  const formatTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " UTC";
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Sticky Header */}
      <header className="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-400 via-cyan-400 to-violet-400 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#05070f]" />
            </div>
            <div>
              <div className="font-semibold tracking-tighter text-lg sm:text-xl">AuroraWatch</div>
              <div className="text-[9px] sm:text-[10px] text-[#64748b] -mt-0.5 leading-none">
                NOAA SWPC<span className="hidden sm:inline"> • Michigan Focus</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Live Kp status pill */}
            <div
              className={`kp-pill ${kpClass}`}
              title="Planetary K-index (live from NOAA)"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Kp {kp !== null ? kp.toFixed(1) : "—"}</span>
            </div>

            {/* Michigan risk level pill */}
            {riskLevel && (
              <div
                className={`risk-pill risk-${riskLevel.toLowerCase()}`}
                title="Current aurora visibility risk for Michigan (Kp + OVATION + Bz)"
              >
                MI {riskLevel}
              </div>
            )}

            {/* Consolidated freshness indicator — single source of truth (latestGlobalUpdate), calm, non-redundant.
               Mobile: compact dot + "LIVE". Desktop: live dot + precise relative time. */}
            {latestGlobalUpdate && (
              <div
                className="flex items-center gap-1 text-[10px] text-[#64748b] tabular-nums"
                title="Most recent data across all sources"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c55e]"></span>
                </span>
                <span className="hidden sm:inline">
                  {formatDistanceToNow(latestGlobalUpdate, { addSuffix: true })}
                </span>
                <span className="sm:hidden text-[#22c55e] font-medium">LIVE</span>
              </div>
            )}

            {/* Refresh button — icon-only on mobile for breathing room, full label + larger tap target on larger screens */}
            <button
              onClick={() => {
                refetchAll();
                solarActivity.refetchAll();
                fireballsQuery.refetch();
              }}
              disabled={isLoading || solarActivity.isLoading || fireballsQuery.isLoading}
              className="button flex items-center justify-center gap-1.5 text-xs px-2.5 sm:px-3 py-1 min-h-[38px] sm:min-h-0"
              title="Refresh live data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || solarActivity.isLoading || fireballsQuery.isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero + Tonight’s Michigan Outlook */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-4">
        <div className="max-w-3xl">
          <div className="uppercase tracking-[2.5px] text-[10px] text-[#64748b] mb-3">LIVE • NOAA SWPC DATA</div>
          <h1 className="text-6xl sm:text-7xl font-semibold tracking-tighter leading-[0.92] mb-5">
            Aurora &amp; space<br />weather for the<br />United States
          </h1>
          <p className="text-2xl text-[#94a3b8] tracking-tight max-w-2xl">
            Real-time OVATION aurora forecasts and planetary K-index.
            Special attention to Michigan and the Great Lakes.
          </p>
        </div>

        <HeroOutlook
          outlook={tonightOutlook}
          isLoading={isLoading || solarActivity.isLoading}
          error={error}
          isFetching={isFetching}
        />
      </div>

      <CurrentConditions
        solarWindSpeed={solarWindSpeed}
        solarWindDensity={solarWindDensity}
        bz={bz}
        kp={kp}
        maxAuroraProbNA={maxAuroraProbNA}
        isLoading={isLoading}
        latestGlobalUpdate={latestGlobalUpdate}
        kpTime={kpTime}
        solarWindError={solarWindError}
      />

      {/* Interactive Map Section — core interactive feature, placed prominently right after current conditions so users quickly reach the OVATION aurora map */}
      <Suspense fallback={<MapSectionSkeleton />}>
        <AuroraMapSection />
      </Suspense>

      {/* Forecast Timeline - live Chart.js Kp history */}
      <Suspense fallback={<KpOutlookSkeleton />}>
        <KpForecast michiganGuidance={michiganGuidance} />
      </Suspense>

      {/* SOLAR ACTIVITY — key solar drivers for aurora (positioned after Kp outlook to provide context for why conditions may change) */}
      <Suspense fallback={<SolarActivitySkeleton />}>
        <SolarActivity />
      </Suspense>

      {/* Meteor Activity — Next shower + recent fireballs (positioned after core space weather data; still useful for additional sky phenomena) */}
      <MeteorActivity />

      {/* Understanding the Data — educational section, collapsed by default (kept collapsed; position after Solar follows logical "see the data → understand it" flow) */}
      <DataUnderstanding />

      {/* Notifications v2 — persistent toggle, live MI risk badge, user threshold presets */}
      <AlertsPanel
        riskLevel={riskLevel}
        kp={kp}
        maxAuroraProbNA={maxAuroraProbNA}
        bz={bz}
        isLoading={isLoading}
      />

      {/* Footer */}
      <footer className="border-t border-[#1e2937] pt-8 pb-10 text-xs text-[#64748b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-y-2 justify-between">
            <div>
              Data provided by{" "}
              <a
                href="https://www.swpc.noaa.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                NOAA Space Weather Prediction Center (SWPC)
              </a>
              . OVATION, planetary K-index, and real-time solar wind.
            </div>
            <div className="text-[#475569]">Not for navigation • Updates every few minutes • Built for Michigan aurora chasers</div>
          </div>
          <div className="mt-4 text-[#475569] text-[10px]">
            Last data fetch: {formatTime(kpTime)} • AuroraWatch v0.1.0
          </div>
        </div>
      </footer>
    </div>
  );
}
