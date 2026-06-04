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

  // Enhanced Michigan guidance that incorporates Kp + OVATION max prob + Bz for more accurate plain-English advice.
  // (Previously Kp-only; now aligns better with riskLevel logic while staying concise.)
  const getMichiganGuidance = (kp: number | null, maxProb: number | null, bz: number | null) => {
    if (kp === null) return "Data loading...";
    let text: string;
    if (kp >= 7) {
      text = "High probability of aurora visible across much of Michigan, including Lower Peninsula under dark skies.";
    } else if (kp >= 5) {
      text = "Good chance in the Upper Peninsula; possible in northern Lower Peninsula with clear dark skies.";
    } else if (kp >= 4) {
      text = "Possible in the Upper Peninsula. Lower Peninsula unlikely unless skies are very dark and clear.";
    } else {
      text = "Low probability across Michigan. Best chances remain in the far northern Upper Peninsula.";
    }
    if (bz !== null && bz <= -5) {
      text += " Strong southward Bz currently boosting chances.";
    } else if (maxProb !== null && maxProb >= 20) {
      text += " Elevated probabilities across North America increase the odds.";
    }
    return text;
  };

  return {
    kp: latestKp?.Kp ?? null,
    kpTime: latestKp?.time_tag ?? null,
    maxAuroraProbNA: maxProbNA,
    solarWindSpeed: solarWind.current.speed,
    solarWindDensity: solarWind.current.density,
    bz: solarWind.current.bz,
    michiganGuidance: getMichiganGuidance(latestKp?.Kp ?? null, maxProbNA, solarWind.current.bz),
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
