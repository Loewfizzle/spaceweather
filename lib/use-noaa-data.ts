"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchOvation,
  fetchKpIndex,
  fetchPlasma,
  fetchMag,
  latest,
  maxOvationNorthAmerica,
  OvationResponse,
  KpEntry,
  PlasmaEntry,
  MagEntry,
} from "./noaa";

export function useOvationData() {
  return useQuery<OvationResponse>({
    queryKey: ["ovation"],
    queryFn: fetchOvation,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useKpData() {
  return useQuery<KpEntry[]>({
    queryKey: ["kp"],
    queryFn: fetchKpIndex,
    staleTime: 1000 * 60 * 3,
  });
}

export function useSolarWindData() {
  const plasmaQuery = useQuery<PlasmaEntry[]>({
    queryKey: ["plasma"],
    queryFn: fetchPlasma,
    staleTime: 1000 * 60 * 1,
  });

  const magQuery = useQuery<MagEntry[]>({
    queryKey: ["mag"],
    queryFn: fetchMag,
    staleTime: 1000 * 60 * 1,
  });

  const currentPlasma = plasmaQuery.data ? latest(plasmaQuery.data) : null;
  const currentMag = magQuery.data ? latest(magQuery.data) : null;

  return {
    plasma: plasmaQuery,
    mag: magQuery,
    current: {
      speed: currentPlasma?.speed ?? null,
      density: currentPlasma?.density ?? null,
      bz: currentMag?.bz_gsm ?? null,
      bt: currentMag?.bt ?? null,
    },
    isLoading: plasmaQuery.isLoading || magQuery.isLoading,
    error: plasmaQuery.error || magQuery.error,
  };
}

// Michigan-specific risk level for visibility (used by alerts UI + header badge)
export function getMichiganRiskLevel(
  kp: number | null,
  maxAuroraProbNA: number | null,
  bz: number | null
): "Quiet" | "Moderate" | "High" {
  if (kp === null) return "Quiet";
  const prob = maxAuroraProbNA ?? 0;
  const b = bz ?? 0;
  if (kp >= 5 || prob >= 25 || b <= -8) {
    return "High";
  }
  if (kp >= 4 || prob >= 15 || b <= -5) {
    return "Moderate";
  }
  return "Quiet";
}

// Combined hook for current conditions + Michigan guidance
export function useCurrentConditions() {
  const kpQuery = useKpData();
  const ovationQuery = useOvationData();
  const solarWind = useSolarWindData();

  const latestKp = kpQuery.data ? latest(kpQuery.data) : null;
  const maxProbNA = ovationQuery.data
    ? maxOvationNorthAmerica(ovationQuery.data)
    : null;

  // Simple Michigan guidance logic based on latest Kp
  const getMichiganGuidance = (kp: number | null) => {
    if (kp === null) return "Data loading...";
    if (kp >= 7) {
      return "High probability of aurora visible across much of Michigan, including Lower Peninsula under dark skies.";
    }
    if (kp >= 5) {
      return "Good chance in the Upper Peninsula; possible in northern Lower Peninsula with clear dark skies.";
    }
    if (kp >= 4) {
      return "Possible in the Upper Peninsula. Lower Peninsula unlikely unless skies are very dark and clear.";
    }
    return "Low probability across Michigan. Best chances remain in the far northern Upper Peninsula.";
  };

  return {
    kp: latestKp?.Kp ?? null,
    kpTime: latestKp?.time_tag ?? null,
    maxAuroraProbNA: maxProbNA,
    solarWindSpeed: solarWind.current.speed,
    solarWindDensity: solarWind.current.density,
    bz: solarWind.current.bz,
    michiganGuidance: getMichiganGuidance(latestKp?.Kp ?? null),
    riskLevel: getMichiganRiskLevel(latestKp?.Kp ?? null, maxProbNA, solarWind.current.bz),
    isLoading:
      kpQuery.isLoading ||
      ovationQuery.isLoading ||
      solarWind.isLoading,
    error: kpQuery.error || ovationQuery.error || solarWind.error,
    refetchAll: () => {
      kpQuery.refetch();
      ovationQuery.refetch();
      solarWind.plasma.refetch();
      solarWind.mag.refetch();
    },
  };
}
