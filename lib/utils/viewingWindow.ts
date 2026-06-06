import type { KpForecastEntry } from '../api/schemas';

// Michigan Eastern Time: UTC-4 (EDT, Mar–Nov) / UTC-5 (EST, Nov–Mar).
// Aurora viewing window = local 8 pm (20:00) through 5:59 am.
function inMichiganAuroraWindow(utcDate: Date): boolean {
  const month = utcDate.getUTCMonth(); // 0 = Jan
  const isDst = month >= 2 && month <= 10;
  const localHour = (utcDate.getUTCHours() - (isDst ? 4 : 5) + 24) % 24;
  return localHour >= 20 || localHour < 6;
}

export interface ViewingWindowData {
  hasData: boolean;
  peakKp: number;
  windowStart: Date | null;
  windowEnd: Date | null;
  allBlocks: { time: Date; kp: number }[];
}

/**
 * From a 3-day Kp forecast array, find tonight's best aurora viewing window in Michigan.
 * Returns the start/end of the contiguous "high Kp" block and the peak value within it.
 * Returns hasData=false when no forecast entries fall in tonight's darkness window.
 */
export function computeViewingWindow(kpForecast: KpForecastEntry[]): ViewingWindowData {
  const now = new Date();

  const tonightBlocks = kpForecast
    .filter((e) => {
      if (!e.time_tag) return false;
      const t = new Date(e.time_tag);
      return t > now && inMichiganAuroraWindow(t);
    })
    .map((e) => ({ time: new Date(e.time_tag!), kp: e.kp ?? 0 }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  if (tonightBlocks.length === 0) {
    return { hasData: false, peakKp: 0, windowStart: null, windowEnd: null, allBlocks: [] };
  }

  const peakBlock = tonightBlocks.reduce((best, b) => (b.kp > best.kp ? b : best), tonightBlocks[0]);

  // Build the "good" window: contiguous blocks within 1 Kp of the peak (floor at 2.5).
  const threshold = Math.max(peakBlock.kp - 1, 2.5);
  const goodBlocks = tonightBlocks.filter((b) => b.kp >= threshold);

  const windowStart = goodBlocks.length > 0 ? goodBlocks[0].time : peakBlock.time;
  const lastGood = goodBlocks[goodBlocks.length - 1] ?? peakBlock;
  // Each block is 3 hours, so the window ends 3h after the last good block starts.
  const windowEnd = new Date(lastGood.time.getTime() + 3 * 60 * 60 * 1000);

  return { hasData: true, peakKp: peakBlock.kp, windowStart, windowEnd, allBlocks: tonightBlocks };
}
