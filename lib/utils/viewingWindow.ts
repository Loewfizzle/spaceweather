import type { KpEntry, KpForecastEntry } from '../api/schemas';

// Returns true when America/New_York is in daylight saving time (UTC-4 / EDT).
// Avoids Intl hour12:false which can return 24 for midnight instead of 0.
function isDST(date: Date): boolean {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(date).includes('EDT');
}

// NOAA time_tag strings ("2026-06-07 03:00:00") have a space separator and no
// timezone suffix. Browsers parse them as LOCAL time rather than UTC, which
// shifts every entry by the user's UTC offset. Append 'Z' to force UTC
// interpretation — identical to the fix applied in computeLastNightPeak.
function normalizeTimeTag(tag: string): string {
  const iso = tag.trim().replace(' ', 'T');
  return iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z';
}

// Return true if `date` falls within the northern US aurora viewing window (8 pm–6 am ET).
function inAuroraViewingWindow(date: Date): boolean {
  const ET_OFFSET_MS = isDST(date) ? -4 * 3600000 : -5 * 3600000;
  const etMs = date.getTime() + ET_OFFSET_MS;
  const etHour = Math.floor((etMs % 86400000) / 3600000 + 24) % 24;
  return etHour >= 20 || etHour < 6;
}

export interface ViewingWindowData {
  hasData: boolean;
  peakKp: number;
  windowStart: Date | null;
  windowEnd: Date | null;
  allBlocks: { time: Date; kp: number }[];
}

/**
 * From the Kp history array, find the peak Kp that occurred in the most
 * recently *completed* northern US darkness window (8 pm–6 am ET).
 *
 * Always targets the previous completed night — i.e. the 8 PM ET that has
 * already passed and whose 6 AM close is in the past. "Last night" is
 * constant from 6 AM ET until the following midnight; during the ongoing
 * window (8 PM–6 AM ET) it still shows yesterday's completed result.
 */
export function computeLastNightPeak(
  kpHistory: KpEntry[]
): { peakKp: number; peakTime: Date } | null {
  const now = new Date();
  const msPerHour = 60 * 60 * 1000;

  const ET_OFFSET_MS = isDST(now) ? -4 * 3600000 : -5 * 3600000;
  const nowEtMs = now.getTime() + ET_OFFSET_MS;
  // Snap to midnight of the current ET calendar day (ET-epoch → UTC).
  // e.g. EDT midnight = 04:00 UTC, EST midnight = 05:00 UTC.
  const etMidnightUTC = Math.floor(nowEtMs / 86400000) * 86400000 - ET_OFFSET_MS;
  // 8 PM ET tonight as an exact UTC timestamp — always a clean hour boundary,
  // no sub-minute drift from seconds in `now`.
  const tonight8pmUTC = etMidnightUTC + 20 * msPerHour;
  // Always target the previous completed night — 24 h before tonight's 8 PM.
  // During the ongoing window (8 PM–6 AM ET) this still shows last night's result.
  const nightStartMs = tonight8pmUTC - 24 * msPerHour;

  const nightStart = new Date(nightStartMs);
  // 8pm–6am is always 10 clock-hours; DST transitions at 2am don't change the boundary times
  const nightEnd   = new Date(nightStartMs + 10 * msPerHour);
  // Cap at now so an ongoing night doesn't try to include future entries
  const windowEnd  = nightEnd < now ? nightEnd : now;

  const entries = kpHistory
    .filter((e) => e.time_tag && e.Kp != null)
    .map((e) => ({ time: new Date(normalizeTimeTag(e.time_tag!)), kp: e.Kp! }))
    .filter((e) => e.time >= nightStart && e.time <= windowEnd);

  // Development-only boundary diagnostic — helps identify boundary mismatches.
  /* v8 ignore start */
  if (process.env.NODE_ENV === 'development') {
    console.log('[AuroraWatch] computeLastNightPeak', {
      nowUTC: now.toISOString(),
      nightStart: nightStart.toISOString(),
      nightEnd: nightEnd.toISOString(),
      windowEndCap: windowEnd.toISOString(),
      historyCount: kpHistory.length,
      matchingCount: entries.length,
      firstEntry: kpHistory[0]?.time_tag,
      lastEntry: kpHistory[kpHistory.length - 1]?.time_tag,
    });
  }
  /* v8 ignore stop */

  if (entries.length === 0) return null;
  const peak = entries.reduce((best, e) => (e.kp > best.kp ? e : best), entries[0]);
  return { peakKp: peak.kp, peakTime: peak.time };
}

/**
 * From a 3-day Kp forecast array, find tonight's best aurora viewing window for northern US viewers.
 * Returns the start/end of the contiguous "high Kp" block and the peak value within it.
 * Returns hasData=false when no forecast entries fall in tonight's darkness window.
 */
export function computeViewingWindow(kpForecast: KpForecastEntry[]): ViewingWindowData {
  const now = new Date();

  const tonightBlocks = kpForecast
    .filter((e) => {
      if (!e.time_tag) return false;
      if (e.kp == null) return false;
      if (e.observed === 'observed') return false;
      const t = new Date(normalizeTimeTag(e.time_tag));
      return t > now && inAuroraViewingWindow(t);
    })
    .map((e) => ({ time: new Date(normalizeTimeTag(e.time_tag!)), kp: e.kp! }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  if (tonightBlocks.length === 0) {
    return { hasData: false, peakKp: 0, windowStart: null, windowEnd: null, allBlocks: [] };
  }

  // Trim to the first contiguous dark window. The NOAA 3-day feed contains
  // in-window blocks across all three nights; consecutive blocks within the
  // same night are exactly 3 h apart, while the gap to the next night is
  // always ≥ 14 h. Stop collecting at the first gap wider than 3 hours.
  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
  let firstNightEnd = 1;
  while (
    firstNightEnd < tonightBlocks.length &&
    tonightBlocks[firstNightEnd].time.getTime() - tonightBlocks[firstNightEnd - 1].time.getTime() <= THREE_HOURS_MS
  ) {
    firstNightEnd++;
  }
  const firstNight = tonightBlocks.slice(0, firstNightEnd);

  const peakBlock = firstNight.reduce(
    (best, b) => (b.kp > best.kp ? b : best),
    firstNight[0]
  );

  // Contiguous "good" window: blocks within 1 Kp of the peak, floored at 2.5
  const threshold = Math.max(peakBlock.kp - 1, 2.5);
  const goodBlocks = firstNight.filter((b) => b.kp >= threshold);

  const windowStart = goodBlocks.length > 0 ? goodBlocks[0].time : peakBlock.time;
  const lastGood    = goodBlocks[goodBlocks.length - 1] ?? peakBlock;
  // Each NOAA forecast block is 3 hours wide. Use Math.max so windowEnd is always
  // at least windowStart + 3 h — guards against any edge case where lastGood precedes
  // windowStart.
  const windowEnd = new Date(
    Math.max(lastGood.time.getTime(), windowStart.getTime()) + 3 * 60 * 60 * 1000
  );

  /* v8 ignore start */
  if (process.env.NODE_ENV === 'development') {
    console.log('[AuroraWatch] computeViewingWindow', {
      tonightBlocksCount: firstNight.length,
      peakKp: peakBlock.kp,
      threshold,
      goodBlocksCount: goodBlocks.length,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });
  }
  /* v8 ignore stop */

  return {
    hasData: true,
    peakKp: peakBlock.kp,
    windowStart,
    windowEnd,
    allBlocks: firstNight,
  };
}
