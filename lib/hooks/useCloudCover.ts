"use client";

import { useQuery } from "@tanstack/react-query";
import { logDataError, recordDataSuccess } from "../utils/retry";
import { nextDarkWindowAverage } from "../utils/cloudCover";

export interface CloudCoverResult {
  currentPct: number | null;
  tonightAvg: number | null;
  label: string;
}

function cloudLabel(pct: number): string {
  if (pct < 20) return 'Clear';
  if (pct < 40) return 'Mostly clear';
  if (pct < 60) return 'Partly cloudy';
  if (pct < 80) return 'Mostly cloudy';
  return 'Overcast';
}

async function fetchCloudCover(lat: number, lon: number): Promise<CloudCoverResult> {
  let res: Response;
  try {
    res = await fetch(`/api/cloud-cover?lat=${lat}&lon=${lon}`, {
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    logDataError('Cloud cover fetch', e, undefined, false, 'cloud-cover');
    throw e;
  }
  if (!res.ok) {
    const err = new Error(`Cloud cover fetch failed: ${res.status}`);
    logDataError(`Cloud cover HTTP ${res.status}`, err, undefined, false, 'cloud-cover');
    throw err;
  }
  const data = await res.json();

  const currentPct: number | null = typeof data?.current?.cloud_cover === 'number'
    ? data.current.cloud_cover
    : null;

  // Average cloud cover over the next contiguous dark window (20:00–06:00 local).
  // Open-Meteo returns local-timezone strings (e.g. "2026-06-05T22:00") with timezone=auto.
  // If utc_offset_seconds is missing or invalid, skip the tonight average entirely rather
  // than defaulting to UTC=0, which would compute the wrong dark window for non-UTC users.
  const utcOffsetMs = typeof data.utc_offset_seconds === 'number' && isFinite(data.utc_offset_seconds)
    ? data.utc_offset_seconds * 1000
    : null;

  const tonightAvg: number | null =
    utcOffsetMs !== null && Array.isArray(data?.hourly?.time) && Array.isArray(data?.hourly?.cloud_cover)
      ? nextDarkWindowAverage(
          data.hourly.time as string[],
          data.hourly.cloud_cover as number[],
          Date.now(),
          utcOffsetMs,
        )
      : null;

  const displayPct = tonightAvg ?? currentPct;
  if (displayPct === null) return { currentPct: null, tonightAvg: null, label: 'Unknown' };
  recordDataSuccess('cloud-cover');
  return { currentPct, tonightAvg, label: cloudLabel(displayPct) };
}

export function useCloudCover(lat: number | null, lon: number | null) {
  return useQuery<CloudCoverResult>({
    queryKey: ['cloud-cover', lat, lon],
    queryFn: () => fetchCloudCover(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 15,
    retry: 1,
    retryDelay: 5000,
  });
}
