"use client";

import { Suspense, useMemo, useEffect, useState } from "react";
import {
  useCurrentConditions,
  useSolarActivity,
  useKpForecast,
  getTonightOutlook,
} from "../lib/use-noaa-data";
import { getLocationAuroraProb } from "../lib/aurora/outlook";
import { useGlobalFreshness } from "../lib/hooks/useGlobalFreshness";
import { useCloudCover } from "../lib/hooks/useCloudCover";
import { UserLocationProvider, useUserLocationContext } from "../lib/context/UserLocationContext";
import dynamic from "next/dynamic";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { HeroOutlook } from "./HeroOutlook";
import { CurrentConditions } from "./CurrentConditions";
import { AuroraMapSection } from "./AuroraMapSection";

// Chart.js is ~200 KB — load it only when the Kp chart section mounts
const KpForecast = dynamic(
  () => import("./KpForecast").then((m) => ({ default: m.KpForecast }))
);

import { SolarActivity } from "./SolarActivity";
import { MeteorActivity } from "./MeteorActivity";
import { DataUnderstanding } from "./DataUnderstanding";
import { AlertsPanel } from "./AlertsPanel";
import { ViewingWindow } from "./ViewingWindow";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";
import { SectionErrorBoundary } from "./SectionErrorBoundary";

// Replaced with null at build time — zero production footprint
const DevKpSimulator =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('./DevKpSimulator').then((m) => ({ default: m.DevKpSimulator })), { ssr: false })
    : null;

function getAuroraGlow(kp: number | null): { rgba: string; duration: string } | null {
  if (kp === null || kp < 4) return null;
  if (kp >= 7) return { rgba: 'rgba(167, 139, 250, 0.11)', duration: '0.8s'  };
  if (kp >= 6) return { rgba: 'rgba(249, 115, 22,  0.09)', duration: '1.5s'  };
  if (kp >= 5) return { rgba: 'rgba(234, 179, 8,   0.07)', duration: '2.5s'  };
  return             { rgba: 'rgba(34,  197, 94,  0.06)', duration: '4s'    };
}

const MapSectionSkeleton = () => (
  <LoadingSkeleton variant="map" className="max-w-7xl mx-auto px-4 sm:px-6 pb-12" />
);
const KpOutlookSkeleton = () => (
  <LoadingSkeleton variant="chart" className="max-w-7xl mx-auto px-4 sm:px-6 pb-12" />
);
const SolarActivitySkeleton = () => (
  <LoadingSkeleton variant="metrics" count={4} className="max-w-7xl mx-auto px-4 sm:px-6 pb-10" />
);

function DashboardInner() {
  const conditions = useCurrentConditions();
  const solarActivity = useSolarActivity();
  const { state: locationState, userLat, userLon } = useUserLocationContext();

  const {
    kp,
    kpTime,
    kpHistory,
    maxAuroraProbNA,
    ovationPoints,
    ovationProcessed,
    viewingWindow,
    solarWindSpeed,
    solarWindDensity,
    bz,
    bzHistory,
    guidance,
    riskLevel,
    isLoading,
    error,
    solarWindError,
    isFetching,
    cityProbs,
    refetchAll,
  } = conditions;

  const latestGlobalUpdate = useGlobalFreshness(
    kpTime,
    solarActivity.flareTime,
    solarActivity.alertsTime,
    solarActivity.regionsTime
  );

  const tonightOutlook = useMemo(
    () => ({
      ...getTonightOutlook(
        kp,
        bz,
        maxAuroraProbNA,
        solarActivity.recentCmes,
        solarActivity.latestFlare,
        solarWindSpeed
      ),
      cityProbs,
    }),
    [kp, bz, maxAuroraProbNA, solarActivity.recentCmes, solarActivity.latestFlare, solarWindSpeed, cityProbs]
  );

  const userLocationProb = useMemo(() => {
    if (locationState.status !== "set") return null;
    return getLocationAuroraProb(locationState.lat, locationState.lon, ovationPoints, kp, bz);
  }, [locationState, ovationPoints, kp, bz]);

  const cloudCoverQuery = useCloudCover(userLat, userLon);
  const cloudCoverData = cloudCoverQuery.data;
  const cloudCoverPct = cloudCoverData?.tonightAvg ?? cloudCoverData?.currentPct ?? null;
  const cloudCoverLabel = cloudCoverData?.label ?? null;
  const kpForecastQuery = useKpForecast();

  // Dynamic page title — shows live Kp so users can see conditions in the tab bar
  useEffect(() => {
    if (kp === null) return;
    const prev = document.title;
    document.title = `AuroraWatch | Kp ${kp.toFixed(1)} — ${riskLevel ?? "Quiet"}`;
    return () => { document.title = prev; };
  }, [kp, riskLevel]);

  const [simKp, setSimKp] = useState<number | null>(null);
  const auroraGlow = getAuroraGlow(simKp ?? kp);
  // Dev only: boost opacity so the glow is clearly visible when testing locally.
  // process.env.NODE_ENV is statically replaced at build time — dead code in production.
  const isDev = process.env.NODE_ENV === 'development';
  const displayGlow = isDev && auroraGlow
    ? { ...auroraGlow, rgba: auroraGlow.rgba.replace(/[\d.]+\)$/, '0.65)') }
    : auroraGlow;

  return (
    <>
      {displayGlow && (
        <div
          className="aurora-bg-glow"
          style={{
            background: `radial-gradient(ellipse 80% 40% at 50% 0%, ${displayGlow.rgba} 0%, transparent 70%)`,
            animationDuration: displayGlow.duration,
            // Dev: z-index 0 loses to positioned content in the stacking order.
            // Raise to 5 so the glow renders above cards (pointer-events:none keeps it safe).
            ...(isDev && { zIndex: 5 }),
          }}
        />
      )}
      {/* Primary Answer Zone — HeroOutlook + ViewingWindow */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12">
        <div className="flex items-center gap-2 mb-3">
          <span className="block h-[5px] w-[5px] rounded-full bg-[#94a3b8] flex-shrink-0" />
          <span
            style={{ color: tonightOutlook.status === 'Loading' ? '#94a3b8' : tonightOutlook.accentColor }}
            className="text-[13px] font-semibold tracking-[0.08em] uppercase"
          >Aurora Outlook</span>
        </div>
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[3fr_2fr] lg:gap-6 lg:items-start">
          {/* className="" strips the default max-w wrapper — parent grid handles layout */}
          <SectionErrorBoundary message="Outlook unavailable — check back shortly." className="">
            <HeroOutlook
              outlook={tonightOutlook}
              error={error}
              isFetching={isFetching}
              userLocationProb={userLocationProb}
              cloudCoverPct={cloudCoverPct}
              cloudCoverLabel={cloudCoverLabel}
              kp={kp}
              bz={bz}
              solarWindSpeed={solarWindSpeed}
              maxAuroraProbNA={maxAuroraProbNA}
              ovationProcessed={ovationProcessed}
              latestUpdate={latestGlobalUpdate}
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary message="Forecast window unavailable.">
            <ViewingWindow
              kpForecast={kpForecastQuery.data ?? []}
              kpHistory={kpHistory}
              cloudCoverPct={cloudCoverPct}
              cloudCoverLabel={cloudCoverLabel}
              locationGranted={locationState.status === "set"}
              isLoading={isLoading || kpForecastQuery.isLoading}
              viewingWindow={viewingWindow}
              kp={kp}
            />
          </SectionErrorBoundary>
        </div>
      </section>

      <SectionErrorBoundary message="Aurora map unavailable." className="pt-10">
        <Suspense fallback={<MapSectionSkeleton />}>
          <AuroraMapSection userProb={userLocationProb} ovationPoints={ovationPoints} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary
        message="Current conditions data unavailable."
        className="max-w-7xl mx-auto px-4 sm:px-6 pb-10"
      >
        <CurrentConditions
          solarWindSpeed={solarWindSpeed}
          solarWindDensity={solarWindDensity}
          bz={bz}
          bzHistory={bzHistory}
          kp={kp}
          maxAuroraProbNA={maxAuroraProbNA}
          isLoading={isLoading}
          solarWindError={solarWindError}
          ovationProcessed={ovationProcessed}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary message="Kp forecast unavailable.">
        <Suspense fallback={<KpOutlookSkeleton />}>
          <KpForecast
            guidance={guidance}
            kpHistory={kpHistory}
            kpForecastData={kpForecastQuery.data ?? []}
            kpIsLoading={isLoading}
            kpError={error}
            forecastIsLoading={kpForecastQuery.isLoading}
            forecastError={kpForecastQuery.error}
            onRefetchKp={refetchAll}
            onRefetchForecast={kpForecastQuery.refetch}
          />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary
        message="Solar activity data unavailable."
        className="max-w-7xl mx-auto px-4 sm:px-6 pb-10"
      >
        <Suspense fallback={<SolarActivitySkeleton />}>
          <SolarActivity />
        </Suspense>
      </SectionErrorBoundary>

      <DataUnderstanding />

      <SectionErrorBoundary message="Meteor activity data unavailable.">
        <MeteorActivity />
      </SectionErrorBoundary>

      <SectionErrorBoundary message="Alerts unavailable.">
        <AlertsPanel
          riskLevel={riskLevel}
          isLoading={isLoading}
          alerts={solarActivity.alerts}
          alertsLoading={solarActivity.isLoading}
        />
      </SectionErrorBoundary>

      {DevKpSimulator && <DevKpSimulator simKp={simKp} onSimKp={setSimKp} />}
    </>
  );
}

export function DashboardClient() {
  return (
    <UserLocationProvider>
      <ErrorBoundary
        fallback={(reset) => (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
            <ErrorState
              message="The dashboard encountered an unexpected error. Please try again or refresh the page."
              onRetry={reset}
            />
          </div>
        )}
      >
        <DashboardInner />
      </ErrorBoundary>
    </UserLocationProvider>
  );
}
