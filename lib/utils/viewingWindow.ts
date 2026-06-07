import type { KpEntry, KpForecastEntry } from '../api/schemas';

// Determine the UTC offset for America/New_York at a given date.
// Returns -4 (EDT, summer) or -5 (EST, winter).
// Uses Intl rather than a month-range approximation so the two annual DST
// transitions (second Sunday of March, first Sunday of November) are exact.
function etOffsetHours(date: Date): number {
  const utcH = date.getUTCHours();
  const etH =
    parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        hour12: false,
      }).format(date),
      10
    ) % 24;
  const diff = ((etH - utcH) % 24 + 24) % 24;
  return diff > 12 ? diff - 24 : diff; // -4 or -5
}

// Return true if `date` falls within the northern US aurora viewing window (8 pm–6 am ET).
function inAuroraViewingWindow(date: Date): boolean {
  const offset = etOffsetHours(date);
  const etHour = ((date.getUTCHours() + offset) % 24 + 24) % 24;
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
 * From the Kp history array, find the peak Kp that occurred in last night's
 * northern US darkness window (8 pm–6 am ET).
 *
 * The window is bounded to exactly that 10-hour period so that a multi-day
 * storm can't make a peak from two nights ago appear as "last night."
 *
 * Math: the most recent 8 pm ET always started (nowEtH + 4) hours ago, where
 * nowEtH is the current fractional ET hour. This identity holds for all three
 * time-of-day cases:
 *   overnight  (0–6 ET):   3 am  →  7 h ago = yesterday  8 pm ✓
 *   daytime   (6–20 ET):   3 pm  → 19 h ago = yesterday  8 pm ✓
 *   evening   (20–24 ET): 10 pm  → 26 h ago = yesterday  8 pm ✓
 */
export function computeLastNightPeak(
  kpHistory: KpEntry[]
): { peakKp: number; peakTime: Date } | null {
  const now = new Date();
  const msPerHour = 60 * 60 * 1000;

  const offset = etOffsetHours(now);
  const nowEtH =
    ((now.getUTCHours() + now.getUTCMinutes() / 60 + offset) % 24 + 24) % 24;

  const nightStart = new Date(now.getTime() - (nowEtH + 4) * msPerHour);
  const nightEnd   = new Date(nightStart.getTime() + 10 * msPerHour); // 8 pm → 6 am
  // Cap at now so an ongoing night doesn't try to include future entries
  const windowEnd  = nightEnd < now ? nightEnd : now;

  const entries = kpHistory
    .filter((e) => e.time_tag && e.Kp != null)
    .map((e) => ({ time: new Date(e.time_tag!), kp: e.Kp! }))
    .filter((e) => e.time >= nightStart && e.time <= windowEnd);

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
      const t = new Date(e.time_tag);
      return t > now && inAuroraViewingWindow(t);
    })
    .map((e) => ({ time: new Date(e.time_tag!), kp: e.kp ?? 0 }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  if (tonightBlocks.length === 0) {
    return { hasData: false, peakKp: 0, windowStart: null, windowEnd: null, allBlocks: [] };
  }

  const peakBlock = tonightBlocks.reduce(
    (best, b) => (b.kp > best.kp ? b : best),
    tonightBlocks[0]
  );

  // Contiguous "good" window: blocks within 1 Kp of the peak, floored at 2.5
  const threshold = Math.max(peakBlock.kp - 1, 2.5);
  const goodBlocks = tonightBlocks.filter((b) => b.kp >= threshold);

  const windowStart = goodBlocks.length > 0 ? goodBlocks[0].time : peakBlock.time;
  const lastGood    = goodBlocks[goodBlocks.length - 1] ?? peakBlock;
  // Each NOAA forecast block is 3 hours; window ends at the close of the last good block
  const windowEnd   = new Date(lastGood.time.getTime() + 3 * 60 * 60 * 1000);

  return {
    hasData: true,
    peakKp: peakBlock.kp,
    windowStart,
    windowEnd,
    allBlocks: tonightBlocks,
  };
}
