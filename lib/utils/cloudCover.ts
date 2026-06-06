/**
 * nextDarkWindowAverage
 *
 * Scans an Open-Meteo hourly forecast (local-timezone strings, e.g. "2026-06-05T22:00")
 * and returns the average cloud cover percentage for the *next* contiguous dark window
 * (20:00–05:59 local), rounded to the nearest integer.
 *
 * Returns null if no future dark hours are found.
 *
 * utcOffsetMs = utc_offset_seconds * 1000 from the Open-Meteo response
 * (e.g. -14_400_000 for EDT, -18_000_000 for EST).
 * Treating the local-time string as UTC then subtracting the offset gives true UTC ms
 * for date-range filtering, while the hour is extracted directly from the string for
 * the night-window check — both are correct because Open-Meteo returns local-time strings.
 *
 * Collects only the first contiguous dark block after nowMs; stops at the first
 * daytime hour that follows it so tonight and tomorrow night are never averaged together.
 */
export function nextDarkWindowAverage(
  times: string[],
  covers: number[],
  nowMs: number,
  utcOffsetMs: number,
): number | null {
  const values: number[] = [];
  let inDarkWindow = false;
  let windowEnded = false;

  for (let i = 0; i < times.length; i++) {
    if (windowEnded) break;
    const t = new Date(times[i] + 'Z').getTime() - utcOffsetMs;
    if (t <= nowMs) continue;
    const hourStr = (times[i].split('T')[1] ?? '').substring(0, 2);
    const hour = parseInt(hourStr, 10);
    const isDark = hour >= 20 || hour < 6;
    if (isDark) {
      inDarkWindow = true;
      values.push(covers[i]);
    } else if (inDarkWindow) {
      windowEnded = true;
    }
  }

  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}
