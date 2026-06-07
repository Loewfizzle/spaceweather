"use client";

import { useMemo } from "react";
import { filterOvationCoordinates, maxOvationNorthAmerica } from "../aurora/ovation";
import { getCityAuroraProbabilities } from "../aurora/outlook";
import type { CityAuroraProb } from "../aurora/outlook";
import { getAuroraGuidance, getAuroraRiskLevel } from "../aurora/kp";
import { computeViewingWindow, type ViewingWindowData } from "../utils/viewingWindow";
import type { KpEntry, OvationResponse, KpForecastEntry } from "../api/schemas";

interface DerivedInput {
  latestKp: KpEntry | null;
  ovationData: OvationResponse | undefined;
  ovationIsSuccess: boolean;
  bz: number | null;
  speed: number | null;
  forecastData: KpForecastEntry[] | undefined;
}

export interface DerivedConditions {
  ovationPoints: ReturnType<typeof filterOvationCoordinates>;
  maxAuroraProbNA: number | null;
  ovationProcessed: boolean;
  cityProbs: CityAuroraProb[];
  viewingWindow: ViewingWindowData | null;
  guidance: string;
  riskLevel: "Quiet" | "Moderate" | "High";
}

export function useDerivedConditions({
  latestKp,
  ovationData,
  ovationIsSuccess,
  bz,
  speed,
  forecastData,
}: DerivedInput): DerivedConditions {
  // filterOvationCoordinates walks the full OVATION grid (~65k entries); memoize once so
  // maxOvationNorthAmerica, getCityAuroraProbabilities, and getLocationAuroraProb all share
  // the same filtered array rather than each paying the full scan cost independently.
  const ovationPoints = useMemo(
    () => (ovationData ? filterOvationCoordinates(ovationData.coordinates, 0) : []),
    [ovationData]
  );

  const maxAuroraProbNA = useMemo(
    () => (ovationData ? maxOvationNorthAmerica(ovationPoints) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ovationData gates nullability only; exclude to avoid rescanning on every poll tick
    [ovationPoints]
  );

  // True when the NOAA fetch itself succeeded — even if the aurora oval happened
  // to have no coordinates (legitimate quiet-sun result, not a data failure).
  const ovationProcessed = ovationIsSuccess && !!ovationData;

  // Phase 1: O(n) nearest-cell scan — skips Bz so Bz fluctuations don't retrigger the scan
  const cityBaseProbs = useMemo(
    () => getCityAuroraProbabilities(ovationPoints, latestKp?.Kp ?? null, null),
    [ovationPoints, latestKp?.Kp]
  );

  // Phase 2: apply Bz boost — lightweight remap, only re-runs when Bz crosses the −5 threshold
  const cityProbs = useMemo(() => {
    if (bz === null || bz > -5) return cityBaseProbs;
    const boost = Math.round(Math.min(8, Math.abs(bz + 5) * 1.5));
    return cityBaseProbs.map(c => ({ ...c, prob: Math.min(99, c.prob + boost) }));
  }, [cityBaseProbs, bz]);

  // Tonight's viewing window — computed once and shared with both getAuroraGuidance (for forecast
  // peak Kp) and the ViewingWindow component, so both see the same snapshot and new Date() is
  // called only once per render cycle rather than independently in two places.
  const viewingWindow = useMemo<ViewingWindowData | null>(
    () => (forecastData && forecastData.length > 0 ? computeViewingWindow(forecastData) : null),
    [forecastData]
  );

  const guidance = useMemo(
    () => getAuroraGuidance(latestKp?.Kp ?? null, maxAuroraProbNA, bz, speed, viewingWindow?.hasData ? viewingWindow.peakKp : null),
    [latestKp?.Kp, maxAuroraProbNA, bz, speed, viewingWindow]
  );

  const riskLevel = useMemo(
    () => getAuroraRiskLevel(latestKp?.Kp ?? null, maxAuroraProbNA, bz, speed),
    [latestKp?.Kp, maxAuroraProbNA, bz, speed]
  );

  return { ovationPoints, maxAuroraProbNA, ovationProcessed, cityProbs, viewingWindow, guidance, riskLevel };
}
