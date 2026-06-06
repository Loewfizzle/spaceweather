"use client";

import { useQuery } from "@tanstack/react-query";
import { logDataError, recordDataSuccess } from "../utils/retry";

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

  // Compute tonight's average over hours 20–06 local time.
  // Open-Meteo returns timezone-local ISO strings without offset suffix (e.g. "2026-06-05T22:00").
  // We use utc_offset_seconds from the response to compute true UTC ms for date-range filtering,
  // then extract the local hour from the string for the 20:00–06:00 window check.
  let tonightAvg: number | null = null;
  if (
    Array.isArray(data?.hourly?.time) &&
    Array.isArray(data?.hourly?.cloud_cover)
  ) {
    const times = data.hourly.time as string[];
    const covers = data.hourly.cloud_cover as number[];
    const nowMs = Date.now();
    // utc_offset_seconds: e.g. -14400 for EDT, -18000 for EST.
    // Treating the string as UTC then subtracting the offset gives true UTC ms.
    const utcOffsetMs = (typeof data.utc_offset_seconds === 'number' ? data.utc_offset_seconds : 0) * 1000;

    // Collect only the *next* contiguous dark window (20:00–06:00 local).
    // A naive 24-hour scan can mix tonight's and tomorrow night's hours when
    // fetched in the early evening. Instead: scan forward, gather hours once
    // the first dark window starts, and stop as soon as it ends.
    const tonightValues: number[] = [];
    let inDarkWindow = false;
    let windowEnded = false;
    for (let i = 0; i < times.length; i++) {
      if (windowEnded) break;
      // Parse as UTC then shift by location offset → correct UTC ms regardless of browser TZ
      const t = new Date(times[i] + 'Z').getTime() - utcOffsetMs;
      if (t <= nowMs) continue;
      // Extract local hour from "2026-06-05T22:00" — already in location's timezone
      const hourStr = (times[i].split('T')[1] ?? '').substring(0, 2);
      const hour = parseInt(hourStr, 10);
      const isDark = hour >= 20 || hour < 6;
      if (isDark) {
        inDarkWindow = true;
        tonightValues.push(covers[i]);
      } else if (inDarkWindow) {
        windowEnded = true; // first daytime hour after entering the dark window — done
      }
    }

    if (tonightValues.length > 0) {
      tonightAvg = Math.round(tonightValues.reduce((s, v) => s + v, 0) / tonightValues.length);
    }
  }

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
