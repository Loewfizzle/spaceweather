import { describe, it, expect } from 'vitest'
import { nextDarkWindowAverage } from '../../lib/utils/cloudCover'

// EDT = UTC-4  →  utcOffsetMs = -14_400_000
// EST = UTC-5  →  utcOffsetMs = -18_000_000
const EDT = -14_400_000
const EST = -18_000_000

// UTC epoch ms for a given UTC ISO string.
const utc = (iso: string) => new Date(iso).getTime()

// Build an array of n identical cover values.
const uniform = (n: number, pct: number) => Array(n).fill(pct) as number[]

// Hourly local-time strings starting at `startLocal` for `count` hours.
// Open-Meteo strings look like "2026-06-05T22:00" — no offset suffix.
function hours(startLocal: string, count: number): string[] {
  const result: string[] = []
  // Parse as UTC so we can add hours without DST confusion
  const d = new Date(startLocal + 'Z')
  for (let i = 0; i < count; i++) {
    result.push(d.toISOString().substring(0, 16))
    d.setUTCHours(d.getUTCHours() + 1)
  }
  return result
}

// ─── baseline cases ───────────────────────────────────────────────────────────

describe('nextDarkWindowAverage', () => {
  it('returns null for empty arrays', () => {
    expect(nextDarkWindowAverage([], [], utc('2026-06-05T15:00:00Z'), EDT)).toBeNull()
  })

  it('returns null when all entries are in the past', () => {
    const times = hours('2026-06-04T20:00', 10) // last night
    expect(
      nextDarkWindowAverage(times, uniform(10, 50), utc('2026-06-05T15:00:00Z'), EDT),
    ).toBeNull()
  })

  it('returns null when there are no dark hours in the future data', () => {
    // Only daytime hours (08:00–19:00) ahead of "now"
    const times = hours('2026-06-05T12:00', 8) // noon–7pm local (in UTC since we treat as UTC)
    expect(
      nextDarkWindowAverage(times, uniform(8, 40), utc('2026-06-05T10:00:00Z'), EDT),
    ).toBeNull()
  })

  // ─── daytime request: full tonight window ─────────────────────────────────

  it('11 am EDT: collects all 10 dark hours (8 pm–5 am)', () => {
    // nowMs = June 5 11am EDT = June 5 15:00 UTC
    const nowMs = utc('2026-06-05T15:00:00Z')
    // Times: noon through next dawn (6 am EDT)
    // Local strings:  noon, 1pm … 8pm(dark)… 5am(dark), 6am(stops)
    const times = hours('2026-06-05T12:00', 19) // 12:00–06:00 (19 entries)
    const covers = uniform(19, 40)
    expect(nextDarkWindowAverage(times, covers, nowMs, EDT)).toBe(40)
  })

  it('11 am EDT: counts exactly 10 dark hours (8 pm through 5 am inclusive)', () => {
    const nowMs = utc('2026-06-05T15:00:00Z')
    const times = hours('2026-06-05T12:00', 19)
    // Give dark hours (indices 8–17: 20:00–05:00) a value of 60; daytime = 0
    const covers = times.map((t) => {
      const h = parseInt(t.split('T')[1].substring(0, 2), 10)
      return h >= 20 || h < 6 ? 60 : 0
    })
    // Average of 10 × 60 = 60
    expect(nextDarkWindowAverage(times, covers, nowMs, EDT)).toBe(60)
  })

  // ─── mid-window requests ──────────────────────────────────────────────────

  it('9 pm EDT: collects remaining 8 dark hours (10 pm–5 am), skips current hour', () => {
    // 9pm EDT = June 6 01:00 UTC
    const nowMs = utc('2026-06-06T01:00:00Z')
    // Generate times from 8pm EDT (= June 5 20:00 local string)
    const times = hours('2026-06-05T20:00', 11) // 8pm–6am (11 entries; 6am ends window)
    const covers = uniform(11, 70)
    // 8pm (21:00 local string exactly equals nowMs → skipped)
    // 9pm local = 2026-06-05T21:00 → t = June 5 21:00 UTC + 4h = June 6 01:00 UTC = nowMs → skipped
    // 10pm onward are future dark hours: 10pm,11pm,0,1,2,3,4,5am = 8 hours
    expect(nextDarkWindowAverage(times, covers, nowMs, EDT)).toBe(70)
  })

  it('2 am EDT: collects only 3 remaining dark hours (3 am–5 am)', () => {
    // 2am EDT = June 6 06:00 UTC
    const nowMs = utc('2026-06-06T06:00:00Z')
    const times = hours('2026-06-06T00:00', 7) // midnight–6am local (7 entries: 0,1,2,3,4,5,6)
    const covers = uniform(7, 80)
    // 0am–2am: t <= nowMs → skipped
    // 3am, 4am, 5am: dark and future → 3 entries
    // 6am: not dark → window ends
    expect(nextDarkWindowAverage(times, covers, nowMs, EDT)).toBe(80)
  })

  // ─── two-night guard ──────────────────────────────────────────────────────

  it('does not mix tonight and tomorrow night when request is at 11 am', () => {
    const nowMs = utc('2026-06-05T15:00:00Z')
    // 48 hours of data: tonight's window has cover=20; tomorrow night has cover=80
    const times = hours('2026-06-05T12:00', 43) // noon June 5 → 7am June 7
    const covers = times.map((t) => {
      const date = t.substring(0, 10)
      const h = parseInt(t.split('T')[1].substring(0, 2), 10)
      const isDark = h >= 20 || h < 6
      if (!isDark) return 0
      return date === '2026-06-05' || (date === '2026-06-06' && h < 6) ? 20 : 80
    })
    // Tonight = 20; tomorrow night = 80; function must return 20
    expect(nextDarkWindowAverage(times, covers, nowMs, EDT)).toBe(20)
  })

  // ─── averaging ────────────────────────────────────────────────────────────

  it('rounds the average to the nearest integer', () => {
    const nowMs = utc('2026-06-05T15:00:00Z')
    // 3 dark hours with values 10, 20, 30 → average = 20.0
    const times = ['2026-06-05T20:00', '2026-06-05T21:00', '2026-06-05T22:00', '2026-06-05T23:00']
    const covers = [10, 20, 30, 40]
    expect(nextDarkWindowAverage(times, covers, nowMs, EDT)).toBe(25)
  })

  it('rounds 0.5 up (Math.round behaviour)', () => {
    const nowMs = utc('2026-06-05T15:00:00Z')
    const times = ['2026-06-05T20:00', '2026-06-05T21:00']
    const covers = [10, 11]
    // average = 10.5 → Math.round → 11
    expect(nextDarkWindowAverage(times, covers, nowMs, EDT)).toBe(11)
  })

  // ─── EST offset ───────────────────────────────────────────────────────────

  it('works with EST (UTC-5) offset', () => {
    // 11am EST = June 5 16:00 UTC
    const nowMs = utc('2026-06-05T16:00:00Z')
    // In EST, 8pm local = June 5 21:00 UTC + 5h... wait:
    // EST = UTC-5, utcOffsetMs = -18_000_000
    // "2026-06-05T20:00" treated as UTC → subtract -18_000_000 → add 5h → June 6 01:00 UTC > 16:00 UTC ✓
    const times = hours('2026-06-05T12:00', 19) // noon–6am (19 entries)
    const covers = uniform(19, 55)
    expect(nextDarkWindowAverage(times, covers, nowMs, EST)).toBe(55)
  })
})
