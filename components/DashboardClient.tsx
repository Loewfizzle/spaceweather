"use client";

import { Suspense, useMemo, useEffect, useState } from "react";
import {
  useCurrentConditions,
  useSolarActivity,
  useKpForecast,
  getTonightOutlook,
} from "../lib/use-noaa-data";
import { getLocationAuroraProb, getPersonalizedOutlook } from "../lib/aurora/outlook";
import { useGlobalFreshness } from "../lib/hooks/useGlobalFreshness";
import { useCloudCover } from "../lib/hooks/useCloudCover";
import { UserLocationProvider, useUserLocationContext } from "../lib/context/UserLocationContext";
import dynamic from "next/dynamic";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { HeroOutlook } from "./HeroOutlook";
import { CurrentConditions } from "./CurrentConditions";
import { AuroraMapSection } from "./AuroraMapSection";
import { SolarActivity } from "./SolarActivity";
import { MeteorActivity } from "./MeteorActivity";
import { DataUnderstanding } from "./DataUnderstanding";
import { AlertsPanel } from "./AlertsPanel";
import { ViewingWindow } from "./ViewingWindow";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";
import { SectionErrorBoundary } from "./SectionErrorBoundary";

// Chart.js is ~200 KB — load it only when the Kp chart section mounts
const KpForecast = dynamic(
  () => import("./KpForecast").then((m) => ({ default: m.KpForecast }))
);

// Replaced with null at build time — zero production footprint
const DevKpSimulator =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('./DevKpSimulator').then((m) => ({ default: m.DevKpSimulator })), { ssr: false })
    : null;

function getAuroraGlow(kp: number | null): { rgba: string; duration: string } | null {
  if (kp === null || kp < 4) return null;
  if (kp >= 7) return { rgba: 'rgba(167, 139, 250, 0.25)', duration: '4s' };
  if (kp >= 6) return { rgba: 'rgba(249, 115, 22,  0.19)', duration: '4s' };
  if (kp >= 5) return { rgba: 'rgba(234, 179, 8,   0.14)', duration: '4s' };
  return             { rgba: 'rgba(34,  197, 94,  0.11)', duration: '4s' };
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

  const forecastPeakKp = viewingWindow?.hasData ? viewingWindow.peakKp : null;

  const displayOutlook = useMemo(() => {
    if (locationState.status !== "set" || userLocationProb == null || userLat == null) return tonightOutlook;
    return getPersonalizedOutlook(
      tonightOutlook,
      userLocationProb,
      userLat,
      locationState.label ?? null,
      forecastPeakKp,
      cloudCoverPct ?? null,
    );
  }, [locationState, userLocationProb, userLat, tonightOutlook, forecastPeakKp, cloudCoverPct]);

  const cloudCoverQuery = useCloudCover(userLat, userLon);
  const cloudCoverData = cloudCoverQuery.data;
  const cloudCoverPct = cloudCoverData?.tonightAvg ?? cloudCoverData?.currentPct ?? null;
  const cloudCoverLabel = cloudCoverData?.label ?? null;
  const kpForecastQuery = useKpForecast();

  const [simKp, setSimKp] = useState<number | null>(null);

  // Dynamic page title — shows live Kp so users can see conditions in the tab bar.
  // In dev, also reflects simKp so the simulator gives immediate visual feedback.
  useEffect(() => {
    const effectiveKp = simKp ?? kp;
    if (effectiveKp === null) return;
    const prev = document.title;
    const simTag = simKp !== null ? ' [sim]' : '';
    document.title = `AuroraWatch | Kp ${effectiveKp.toFixed(1)}${simTag} — ${riskLevel ?? "Quiet"}`;
    return () => { document.title = prev; };
  }, [simKp, kp, riskLevel]);
  const auroraGlow = getAuroraGlow(simKp ?? kp);

  return (
    <>
      {auroraGlow && (
        <div
          className="aurora-bg-glow"
          style={{
            background: `radial-gradient(ellipse 90% 55% at 50% 0%, ${auroraGlow.rgba} 0%, ${auroraGlow.rgba.replace(/[\d.]+\)$/, '0)')} 75%)`,
            animationDuration: auroraGlow.duration,
          }}
        />
      )}
      {/* Primary Answer Zone — HeroOutlook + ViewingWindow */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12">
        <div className="flex items-center gap-2 mb-3">
          <span className="block h-[5px] w-[5px] rounded-full bg-[#94a3b8] flex-shrink-0" />
          <span
            style={{ color: displayOutlook.status === 'Loading' ? '#94a3b8' : displayOutlook.accentColor }}
            className="text-[13px] font-semibold tracking-[0.08em] uppercase"
          >Aurora Outlook</span>
        </div>
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[3fr_2fr] lg:gap-6 lg:items-start">
          {/* className="" strips the default max-w wrapper — parent grid handles layout */}
          <SectionErrorBoundary message="Outlook unavailable — check back shortly." className="">
            <HeroOutlook
              outlook={displayOutlook}
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
