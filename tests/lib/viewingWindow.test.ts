import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeLastNightPeak, computeViewingWindow } from '../../lib/utils/viewingWindow'
import type { KpEntry, KpForecastEntry } from '../../lib/api/schemas'

// Pin "now" to June 5, 2026 12:00 UTC (8 am EDT, daytime — outside aurora window).
//
// June is month 5 (0-indexed), so isDst = true → UTC-4 (EDT).
// EDT aurora window (local 8pm–6am) maps to UTC 00:00–09:59.
//
// Past aurora entries:  any day at UTC 00:00–09:59 BEFORE June 5 12:00 UTC.
// Future aurora entries: June 6 at UTC 00:00–09:59 (next night's window).
const NOW = new Date('2026-06-05T12:00:00Z')

function kpEntry(isoZ: string, kp: number): KpEntry {
  return { time_tag: isoZ, Kp: kp } as KpEntry
}

function forecastEntry(isoZ: string, kp: number): KpForecastEntry {
  return { time_tag: isoZ, kp } as KpForecastEntry
}

// ============================================
// computeLastNightPeak
// ============================================
describe('computeLastNightPeak', () => {
  beforeEach(() => vi.setSystemTime(NOW))
  afterEach(() => vi.useRealTimers())

  it('returns null for empty array', () => {
    expect(computeLastNightPeak([])).toBeNull()
  })

  it('returns null when all Kp values are null', () => {
    const entries = [{ time_tag: '2026-06-05T01:00:00Z', Kp: null } as unknown as KpEntry]
    expect(computeLastNightPeak(entries)).toBeNull()
  })

  it('returns null when all entries are in the future', () => {
    expect(computeLastNightPeak([kpEntry('2026-06-05T20:00:00Z', 4.5)])).toBeNull()
  })

  it('returns null when past entries are outside the aurora window (daytime)', () => {
    // UTC 11:30 = 7:30am EDT — past the 11h window boundary (nightEnd = T11:00Z)
    expect(computeLastNightPeak([kpEntry('2026-06-05T11:30:00Z', 5.0)])).toBeNull()
  })

  it('recognises 9pm EDT (UTC 01:00) as inside the aurora window', () => {
    // localHour = (1 - 4 + 24) % 24 = 21 → ≥20 ✓
    const result = computeLastNightPeak([kpEntry('2026-06-05T01:00:00Z', 3.5)])
    expect(result).not.toBeNull()
    expect(result?.peakKp).toBe(3.5)
  })

  it('recognises 2am EDT (UTC 06:00) as inside the aurora window', () => {
    // localHour = (6 - 4 + 24) % 24 = 2 → <6 ✓
    const result = computeLastNightPeak([kpEntry('2026-06-05T06:00:00Z', 4.0)])
    expect(result?.peakKp).toBe(4.0)
  })

  it('returns the highest Kp among multiple in-window entries', () => {
    const entries = [
      kpEntry('2026-06-05T01:00:00Z', 3.0),
      kpEntry('2026-06-05T04:00:00Z', 5.5),  // peak — midnight EDT
      kpEntry('2026-06-05T07:00:00Z', 2.5),  // 3am EDT
    ]
    const result = computeLastNightPeak(entries)
    expect(result?.peakKp).toBe(5.5)
    expect(result?.peakTime.toISOString()).toBe('2026-06-05T04:00:00.000Z')
  })

  it('excludes daytime entries even when they have higher Kp', () => {
    const entries = [
      kpEntry('2026-06-05T01:00:00Z', 3.0),   // 9pm EDT — IN window
      kpEntry('2026-06-05T11:30:00Z', 7.0),   // 7:30am EDT — past 11h boundary
    ]
    const result = computeLastNightPeak(entries)
    expect(result?.peakKp).toBe(3.0)
  })
})

// ============================================
// computeViewingWindow
// ============================================
describe('computeViewingWindow', () => {
  beforeEach(() => vi.setSystemTime(NOW))
  afterEach(() => vi.useRealTimers())

  it('returns hasData: false for empty array', () => {
    const result = computeViewingWindow([])
    expect(result.hasData).toBe(false)
    expect(result.windowStart).toBeNull()
    expect(result.windowEnd).toBeNull()
    expect(result.allBlocks).toHaveLength(0)
  })

  it('returns hasData: false when all entries are past', () => {
    // June 5 01:00 UTC < June 5 12:00 UTC (now) → filtered out
    const result = computeViewingWindow([forecastEntry('2026-06-05T01:00:00Z', 4.0)])
    expect(result.hasData).toBe(false)
  })

  it('returns hasData: false when future entries fall outside the aurora window', () => {
    // June 5 15:00 UTC = 11am EDT → localHour = 11 → NOT in window
    const result = computeViewingWindow([forecastEntry('2026-06-05T15:00:00Z', 4.0)])
    expect(result.hasData).toBe(false)
  })

  it('returns hasData: true and correct peakKp for in-window forecast entries', () => {
    // June 6 00:00 UTC = June 5 8pm EDT → in window ✓
    // June 6 03:00 UTC = June 5 11pm EDT → in window ✓
    const result = computeViewingWindow([
      forecastEntry('2026-06-06T00:00:00Z', 3.5),
      forecastEntry('2026-06-06T03:00:00Z', 5.0),
      forecastEntry('2026-06-06T06:00:00Z', 2.5),
    ])
    expect(result.hasData).toBe(true)
    expect(result.peakKp).toBe(5.0)
  })

  it('sets windowEnd 3 hours after the last good block', () => {
    // Peak = 5.0 at 03:00. threshold = max(5.0 - 1, 2.5) = 4.0.
    // goodBlocks: 3.5 (filtered) and 5.0 ✓ → last good = 03:00 UTC.
    // windowEnd = 03:00 + 3h = 06:00 UTC.
    const result = computeViewingWindow([
      forecastEntry('2026-06-06T00:00:00Z', 3.5),
      forecastEntry('2026-06-06T03:00:00Z', 5.0),
    ])
    expect(result.windowEnd?.toISOString()).toBe('2026-06-06T06:00:00.000Z')
  })

  it('sets windowStart to the first good block, not the first block', () => {
    // threshold = max(5.0 - 1, 2.5) = 4.0
    // blocks: 2.0 (bad), 4.5 (good), 5.0 (good)
    const result = computeViewingWindow([
      forecastEntry('2026-06-06T00:00:00Z', 2.0),
      forecastEntry('2026-06-06T03:00:00Z', 4.5),
      forecastEntry('2026-06-06T06:00:00Z', 5.0),
    ])
    expect(result.windowStart?.toISOString()).toBe('2026-06-06T03:00:00.000Z')
  })

  it('returns allBlocks sorted chronologically', () => {
    const result = computeViewingWindow([
      forecastEntry('2026-06-06T06:00:00Z', 2.0),
      forecastEntry('2026-06-06T00:00:00Z', 4.0),
      forecastEntry('2026-06-06T03:00:00Z', 5.0),
    ])
    const times = result.allBlocks.map((b) => b.time.toISOString())
    expect(times).toEqual([...times].sort())
  })

  it('excludes entries at the 6am ET cutoff (UTC 10:00 in EDT)', () => {
    // June 6 10:00 UTC = June 6 6am EDT → localHour = 6 → NOT in window
    const result = computeViewingWindow([
      forecastEntry('2026-06-06T00:00:00Z', 4.0),  // 8pm EDT — IN
      forecastEntry('2026-06-06T10:00:00Z', 8.0),  // 6am EDT — NOT IN
    ])
    expect(result.allBlocks).toHaveLength(1)
    expect(result.peakKp).toBe(4.0)
  })

  it('uses peak block time as windowStart when no blocks meet the good threshold', () => {
    // All blocks are low Kp: threshold = max(2.5 - 1, 2.5) = 2.5; only block >= 2.5 is the peak itself
    const result = computeViewingWindow([
      forecastEntry('2026-06-06T00:00:00Z', 1.0),
      forecastEntry('2026-06-06T03:00:00Z', 2.5),
    ])
    // threshold = max(2.5-1, 2.5) = 2.5; goodBlocks = [2.5]; windowStart = 03:00
    expect(result.hasData).toBe(true)
    expect(result.windowStart?.toISOString()).toBe('2026-06-06T03:00:00.000Z')
  })

  // ── Branch-coverage gap tests ──────────────────────────────────────────────
  // The three cases below cover the branches flagged as uncovered in the
  // v8 report: lines 89, 93, and 109-110.

  it('skips forecast entries that have no time_tag (line 89)', () => {
    // !e.time_tag → return false; the null-time_tag entry must be ignored
    const result = computeViewingWindow([
      { kp: 5.0 } as unknown as KpForecastEntry,  // no time_tag — filtered out
      forecastEntry('2026-06-06T00:00:00Z', 4.0),
    ])
    expect(result.allBlocks).toHaveLength(1)
    expect(result.peakKp).toBe(4.0)
  })

  it('treats null kp as 0 via nullish coalescing (line 93)', () => {
    // e.kp ?? 0 fires when kp is null; entry should be included with kp=0
    const result = computeViewingWindow([
      { time_tag: '2026-06-06T00:00:00Z', kp: null } as unknown as KpForecastEntry,
    ])
    expect(result.hasData).toBe(true)
    expect(result.peakKp).toBe(0)
  })

  it('windowEnd is exactly 3 h after windowStart for a single in-window block', () => {
    // Regression: a single block produced "12 AM – 12 AM" due to start === end.
    // June 6 00:00 UTC = 8pm EDT — only one block in tonight's window.
    const result = computeViewingWindow([
      forecastEntry('2026-06-06T00:00:00Z', 3.5),
    ])
    expect(result.hasData).toBe(true)
    const diffMs = result.windowEnd!.getTime() - result.windowStart!.getTime()
    expect(diffMs).toBe(3 * 60 * 60 * 1000)
  })

  it('falls back to peakBlock when goodBlocks is empty — kp below 2.5 floor (lines 109-110)', () => {
    // threshold = max(0 - 1, 2.5) = 2.5; kp=0 < 2.5 → goodBlocks = []
    // line 109: windowStart = peakBlock.time (false branch)
    // line 110: lastGood = goodBlocks[…] ?? peakBlock (nullish fallback)
    const result = computeViewingWindow([
      forecastEntry('2026-06-06T00:00:00Z', 0),
    ])
    expect(result.windowStart?.toISOString()).toBe('2026-06-06T00:00:00.000Z')
    expect(result.windowEnd?.toISOString()).toBe('2026-06-06T03:00:00.000Z')
  })
})

// ── computeLastNightPeak — overnight "now" case ────────────────────────────────
// Separate describe so we can override NOW without interfering with the pinned
// daytime fixture used by the tests above.
describe('computeLastNightPeak — windowEnd cap (line 67)', () => {
  afterEach(() => vi.useRealTimers())

  it('caps windowEnd at now when we are still inside the overnight aurora window', () => {
    // NOW = 2026-06-05T05:00:00Z = 1am EDT (inside aurora window).
    // nightStart = T00:00Z, nightEnd = T11:00Z, but nightEnd > now → windowEnd = now = T05:00Z.
    // The entry at T01:00Z (9pm EDT) is within [nightStart, windowEnd] and should be returned.
    vi.setSystemTime(new Date('2026-06-05T05:00:00Z'))
    const result = computeLastNightPeak([kpEntry('2026-06-05T01:00:00Z', 4.0)])
    expect(result?.peakKp).toBe(4.0)
  })
})
