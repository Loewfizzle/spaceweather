"use client";

import { Suspense, useMemo, useEffect } from "react";
import {
  useCurrentConditions,
  useSolarActivity,
  useOvationData,
  useKpForecast,
  getTonightOutlook,
} from "../lib/use-noaa-data";
import { getLocationAuroraProb } from "../lib/noaa";
import { useGlobalFreshness } from "../lib/hooks/useGlobalFreshness";
import { useUserLocation } from "../lib/hooks/useUserLocation";
import { useCloudCover } from "../lib/hooks/useCloudCover";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { HeroOutlook } from "./HeroOutlook";
import { CurrentConditions } from "./CurrentConditions";
import { AuroraMapSection } from "./AuroraMapSection";
import { KpForecast } from "./KpForecast";
import { SolarActivity } from "./SolarActivity";
import { MeteorActivity } from "./MeteorActivity";
import { DataUnderstanding } from "./DataUnderstanding";
import { AlertsPanel } from "./AlertsPanel";
import { ViewingWindow } from "./ViewingWindow";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";

const MapSectionSkeleton = () => (
  <LoadingSkeleton variant="map" className="max-w-7xl mx-auto px-4 sm:px-6 pb-12" />
);
const KpOutlookSkeleton = () => (
  <LoadingSkeleton variant="chart" className="max-w-7xl mx-auto px-4 sm:px-6 pb-12" />
);
const SolarActivitySkeleton = () => (
  <LoadingSkeleton variant="metrics" count={4} className="max-w-7xl mx-auto px-4 sm:px-6 pb-10" />
);

export function DashboardClient() {
  const conditions = useCurrentConditions();
  const solarActivity = useSolarActivity();
  const { data: ovationData } = useOvationData();
  const { state: locationState, requestGpsLocation, setManualLocation, clearLocation } = useUserLocation();

  const {
    kp,
    kpTime,
    kpHistory,
    maxAuroraProbNA,
    ovationProcessed,
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

  const userLat = locationState.status === "set" ? locationState.lat : null;
  const userLon = locationState.status === "set" ? locationState.lon : null;

  const userLocationProb = useMemo(() => {
    if (locationState.status !== "set") return null;
    return getLocationAuroraProb(locationState.lat, locationState.lon, ovationData ?? null, kp, bz);
  }, [locationState, ovationData, kp, bz]);

  const userLocationLabel = locationState.status === "set" ? locationState.label : null;
  const locationSource = locationState.status === "set" ? locationState.source : null;

  const cloudCoverQuery = useCloudCover(userLat, userLon);
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
      {/* Hero outlook card — lives below the server-rendered h1 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
        <ErrorBoundary fallback={(reset) => <ErrorState message="Outlook unavailable — check back shortly." onRetry={reset} />}>
          <HeroOutlook
            outlook={tonightOutlook}
            error={error}
            isFetching={isFetching}
            userLocationProb={userLocationProb}
            userLocationLabel={userLocationLabel}
            locationSource={locationSource}
            onRequestLocation={
              locationState.status === "idle" ||
              locationState.status === "gps-timeout" ||
              locationState.status === "gps-unavailable"
                ? requestGpsLocation
                : undefined
            }
            isLocating={locationState.status === "gps-loading"}
            locationTimedOut={locationState.status === "gps-timeout"}
            onSetManualLocation={setManualLocation}
            onClearLocation={clearLocation}
            cloudCoverPct={cloudCoverQuery.data?.tonightAvg ?? cloudCoverQuery.data?.currentPct ?? null}
            cloudCoverLabel={cloudCoverQuery.data?.label ?? null}
            kp={kp}
            latestUpdate={latestGlobalUpdate}
          />
        </ErrorBoundary>
      </div>

      <ErrorBoundary fallback={(reset) => (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
          <ErrorState message="Forecast window unavailable." onRetry={reset} />
        </div>
      )}>
        <ViewingWindow
          kpForecast={kpForecastQuery.data ?? []}
          kpHistory={kpHistory}
          cloudCoverPct={cloudCoverQuery.data?.tonightAvg ?? cloudCoverQuery.data?.currentPct ?? null}
          cloudCoverLabel={cloudCoverQuery.data?.label ?? null}
          locationGranted={locationState.status === "set"}
          isLoading={isLoading || kpForecastQuery.isLoading}
        />
      </ErrorBoundary>

      <ErrorBoundary fallback={(reset) => (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <ErrorState message="Current conditions data unavailable." onRetry={reset} />
        </div>
      )}>
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
          ovationProcessed={ovationProcessed}
        />
      </ErrorBoundary>

      <ErrorBoundary
        fallback={(reset) => (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
            <ErrorState message="Aurora map unavailable." onRetry={reset} />
          </div>
        )}
      >
        <Suspense fallback={<MapSectionSkeleton />}>
          {/* Pass pre-computed geo state so AuroraMap can render the user pin
              without duplicating the geolocation hook or permission flow. */}
          <AuroraMapSection
            userLat={userLat}
            userLon={userLon}
            userProb={userLocationProb}
          />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary
        fallback={(reset) => (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
            <ErrorState message="Kp forecast unavailable." onRetry={reset} />
          </div>
        )}
      >
        <Suspense fallback={<KpOutlookSkeleton />}>
          <KpForecast guidance={guidance} />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary
        fallback={(reset) => (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
            <ErrorState message="Solar activity data unavailable." onRetry={reset} />
          </div>
        )}
      >
        <Suspense fallback={<SolarActivitySkeleton />}>
          <SolarActivity />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary
        fallback={(reset) => (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
            <ErrorState message="Meteor activity data unavailable." onRetry={reset} />
          </div>
        )}
      >
        <MeteorActivity />
      </ErrorBoundary>

      <DataUnderstanding />

      <ErrorBoundary
        fallback={(reset) => (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
            <ErrorState message="Alerts unavailable." onRetry={reset} />
          </div>
        )}
      >
        <AlertsPanel
          riskLevel={riskLevel}
          kp={kp}
          maxAuroraProbNA={maxAuroraProbNA}
          bz={bz}
          isLoading={isLoading}
          alerts={solarActivity.alerts}
          alertsLoading={solarActivity.isLoading}
        />
      </ErrorBoundary>
    </>
  );
}
