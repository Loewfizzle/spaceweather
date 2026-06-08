"use client";

import { Suspense, useMemo, useEffect } from "react";
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

  return (
    <>
      {/* Hero — outer div provides padding for both the normal and error paths */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="section-title">AURORA OUTLOOK</div>
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
      </div>

      <SectionErrorBoundary
        message="Forecast window unavailable."
        className="max-w-7xl mx-auto px-4 sm:px-6 pb-4"
      >
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

      <SectionErrorBoundary message="Aurora map unavailable.">
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
          kp={kp}
          maxAuroraProbNA={maxAuroraProbNA}
          isLoading={isLoading}
          kpTime={kpTime}
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
          kp={kp}
          maxAuroraProbNA={maxAuroraProbNA}
          bz={bz}
          isLoading={isLoading}
          alerts={solarActivity.alerts}
          alertsLoading={solarActivity.isLoading}
        />
      </SectionErrorBoundary>
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
