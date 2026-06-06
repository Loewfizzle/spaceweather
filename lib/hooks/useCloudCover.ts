"use client";

import { useQuery } from "@tanstack/react-query";

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
    console.warn('[AuroraWatch] Cloud cover fetch failed (network/timeout):', e);
    throw e;
  }
  if (!res.ok) {
    console.warn(`[AuroraWatch] Cloud cover HTTP ${res.status}`);
    throw new Error(`Cloud cover fetch failed: ${res.status}`);
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
    const dayMs = 24 * 60 * 60 * 1000;
    // utc_offset_seconds: e.g. -14400 for EDT, -18000 for EST.
    // Treating the string as UTC then subtracting the offset gives true UTC ms.
    const utcOffsetMs = (typeof data.utc_offset_seconds === 'number' ? data.utc_offset_seconds : 0) * 1000;

    const tonightValues: number[] = [];
    for (let i = 0; i < times.length; i++) {
      // Parse as UTC then shift by location offset → correct UTC ms regardless of browser TZ
      const t = new Date(times[i] + 'Z').getTime() - utcOffsetMs;
      if (t <= nowMs || t > nowMs + dayMs) continue;
      // Extract local hour from "2026-06-05T22:00" — already in location's timezone
      const hourStr = (times[i].split('T')[1] ?? '').substring(0, 2);
      const hour = parseInt(hourStr, 10);
      if (hour >= 20 || hour < 6) {
        tonightValues.push(covers[i]);
      }
    }

    if (tonightValues.length > 0) {
      tonightAvg = Math.round(tonightValues.reduce((s, v) => s + v, 0) / tonightValues.length);
    }
  }

  const displayPct = tonightAvg ?? currentPct;
  if (displayPct === null) return { currentPct: null, tonightAvg: null, label: 'Unknown' };
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
