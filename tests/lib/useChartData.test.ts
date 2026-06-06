import { describe, it, expect } from 'vitest'
import { buildChartData } from '../../lib/hooks/useChartData'
import type { KpEntry, KpForecastEntry } from '../../lib/api/schemas'

// All dates use January 2024 (EST = UTC-5).
// Michigan aurora window (8pm–6am ET) maps to UTC 01:00–10:59.
//
// In-window UTC times: 01:00–10:00 (8pm–5am EST)
// Out-of-window:       11:00+ (6am+ EST)
//
// Forecast entries must be strictly AFTER the last history entry's time.

function hist(isoZ: string, kp: number): KpEntry {
  return { time_tag: isoZ, Kp: kp } as KpEntry
}

function fc(isoZ: string, kp: number): KpForecastEntry {
  return { time_tag: isoZ, kp } as KpForecastEntry
}

// ── No-data cases ─────────────────────────────────────────────────────────────

describe('buildChartData — empty inputs', () => {
  it('returns empty labels and a single empty dataset', () => {
    const { chartData } = buildChartData([], [])
    expect(chartData.labels).toHaveLength(0)
    expect(chartData.datasets).toHaveLength(1)
    expect(chartData.datasets[0].data).toHaveLength(0)
  })

  it('hasForecast and hasTonight are both false', () => {
    const { hasForecast, hasTonight } = buildChartData([], [])
    expect(hasForecast).toBe(false)
    expect(hasTonight).toBe(false)
  })

  it('produces only the tonight-shade plugin (no boundary marker)', () => {
    const { chartPlugins } = buildChartData([], [])
    expect(chartPlugins).toHaveLength(1)
    expect(chartPlugins[0].id).toBe('tonightShade')
  })
})

// ── History-only ──────────────────────────────────────────────────────────────

describe('buildChartData — history only', () => {
  const history = [
    hist('2024-01-15T09:00:00Z', 2.0),
    hist('2024-01-15T12:00:00Z', 3.5),
    hist('2024-01-15T15:00:00Z', 4.0),
  ]

  it('produces one dataset labeled "Kp Index"', () => {
    const { chartData } = buildChartData(history)
    expect(chartData.datasets).toHaveLength(1)
    expect(chartData.datasets[0].label).toBe('Kp Index')
  })

  it('labels length equals history length', () => {
    const { chartData } = buildChartData(history)
    expect(chartData.labels).toHaveLength(3)
  })

  it('hasForecast is false', () => {
    expect(buildChartData(history).hasForecast).toBe(false)
  })
})

// ── Forecast filtering ────────────────────────────────────────────────────────

describe('buildChartData — forecast filtering', () => {
  const history = [hist('2024-01-15T12:00:00Z', 3.0)]

  it('includes forecast entries strictly after the last history entry', () => {
    const forecast = [fc('2024-01-15T15:00:00Z', 4.0), fc('2024-01-15T18:00:00Z', 5.0)]
    const { chartData, hasForecast } = buildChartData(history, forecast)
    expect(hasForecast).toBe(true)
    expect(chartData.datasets).toHaveLength(2)
    expect(chartData.datasets[1].label).toBe('Forecast')
  })

  it('excludes forecast entries at or before the last history time', () => {
    // All at or before 12:00 UTC (same or earlier than last history entry)
    const forecast = [
      fc('2024-01-15T09:00:00Z', 6.0),
      fc('2024-01-15T12:00:00Z', 7.0), // equal — should be excluded
    ]
    const { hasForecast } = buildChartData(history, forecast)
    expect(hasForecast).toBe(false)
  })

  it('caps history at the last 12 entries', () => {
    const longHistory = Array.from({ length: 15 }, (_, i) =>
      hist(`2024-01-15T${String(i).padStart(2, '0')}:00:00Z`, i * 0.5),
    )
    const { chartData } = buildChartData(longHistory)
    // labels = historicalLabels + forecastLabels; no forecast here → length = min(15,12) = 12
    expect(chartData.labels).toHaveLength(12)
  })

  it('caps forecast at the first 12 entries after the history cutoff', () => {
    const forecast = Array.from({ length: 15 }, (_, i) =>
      fc(`2024-01-15T${String(13 + i).padStart(2, '0')}:00:00Z`, 3.0),
    ).filter((e) => new Date(e.time_tag!).getUTCHours() < 24)
    const h = [hist('2024-01-15T12:00:00Z', 2.0)]
    const { chartData } = buildChartData(h, forecast)
    // 1 history + up to 12 forecast = at most 13 labels total
    expect(chartData.labels!.length).toBeLessThanOrEqual(13)
    expect(chartData.datasets[1]?.data.filter((v) => v !== null)).toHaveLength(
      Math.min(forecast.length, 12),
    )
  })
})

// ── Dataset padding ───────────────────────────────────────────────────────────

describe('buildChartData — dataset padding', () => {
  it('both datasets span the full label array', () => {
    const history  = [hist('2024-01-15T09:00:00Z', 2.0), hist('2024-01-15T12:00:00Z', 3.0)]
    const forecast = [fc('2024-01-15T15:00:00Z', 4.0), fc('2024-01-15T18:00:00Z', 5.0)]
    const { chartData } = buildChartData(history, forecast)
    const totalLabels = chartData.labels!.length // 4
    expect(chartData.datasets[0].data).toHaveLength(totalLabels)
    expect(chartData.datasets[1].data).toHaveLength(totalLabels)
  })

  it('history dataset has nulls in the forecast slots', () => {
    const history  = [hist('2024-01-15T09:00:00Z', 3.0)]
    const forecast = [fc('2024-01-15T12:00:00Z', 4.0), fc('2024-01-15T15:00:00Z', 5.0)]
    const { chartData } = buildChartData(history, forecast)
    // hist data: [3.0, null, null]
    expect(chartData.datasets[0].data[1]).toBeNull()
    expect(chartData.datasets[0].data[2]).toBeNull()
  })

  it('forecast dataset has nulls in the history slots', () => {
    const history  = [hist('2024-01-15T09:00:00Z', 3.0), hist('2024-01-15T12:00:00Z', 2.0)]
    const forecast = [fc('2024-01-15T15:00:00Z', 4.0)]
    const { chartData } = buildChartData(history, forecast)
    // fcst data: [null, null, 4.0]
    expect(chartData.datasets[1].data[0]).toBeNull()
    expect(chartData.datasets[1].data[1]).toBeNull()
    expect(chartData.datasets[1].data[2]).toBe(4.0)
  })
})

// ── Tonight shading ───────────────────────────────────────────────────────────

describe('buildChartData — hasTonight / tonight mask', () => {
  // 2024-01-15T03:00:00Z = 10pm EST (in window: etHour=22, >=20 ✓)
  it('hasTonight is true when history includes an in-window entry', () => {
    const { hasTonight } = buildChartData([hist('2024-01-15T03:00:00Z', 4.0)])
    expect(hasTonight).toBe(true)
  })

  // 2024-01-15T08:00:00Z = 3am EST (in window: etHour=3, <6 ✓)
  it('hasTonight is true when forecast includes an in-window entry', () => {
    const history  = [hist('2024-01-15T01:00:00Z', 2.0)] // 8pm EST → in window
    const forecast = [fc('2024-01-15T08:00:00Z', 3.0)]   // 3am EST → in window
    const { hasTonight } = buildChartData(history, forecast)
    expect(hasTonight).toBe(true)
  })

  // 2024-01-15T14:00:00Z = 9am EST (etHour=9, not >=20, not <6 → out of window)
  it('hasTonight is false when all entries are daytime EST', () => {
    const history  = [hist('2024-01-15T14:00:00Z', 3.0)]
    const forecast = [fc('2024-01-15T17:00:00Z', 4.0)]
    const { hasTonight } = buildChartData(history, forecast)
    expect(hasTonight).toBe(false)
  })
})

// ── Plugins ───────────────────────────────────────────────────────────────────

describe('buildChartData — chartPlugins', () => {
  it('includes forecastBoundary plugin when forecast entries are present', () => {
    const history  = [hist('2024-01-15T09:00:00Z', 3.0)]
    const forecast = [fc('2024-01-15T12:00:00Z', 4.0)]
    const { chartPlugins } = buildChartData(history, forecast)
    expect(chartPlugins).toHaveLength(2)
    const ids = chartPlugins.map((p) => p.id)
    expect(ids).toContain('tonightShade')
    expect(ids).toContain('forecastBoundary')
  })

  it('omits forecastBoundary when there is no forecast data', () => {
    const { chartPlugins } = buildChartData([hist('2024-01-15T09:00:00Z', 2.0)])
    expect(chartPlugins).toHaveLength(1)
    expect(chartPlugins[0].id).toBe('tonightShade')
  })
})

// ── Cross-date labels ─────────────────────────────────────────────────────────

describe('buildChartData — cross-date label format', () => {
  it('adds a weekday prefix when an entry is on a different UTC date than the last', () => {
    // Last history entry is on 2024-01-15. Earlier entry is on 2024-01-14 (Sunday).
    const history = [
      hist('2024-01-14T21:00:00Z', 3.0), // Jan 14 (Sunday)
      hist('2024-01-15T03:00:00Z', 4.0), // Jan 15 (Monday) — becomes todayUtc
    ]
    const { chartData } = buildChartData(history)
    const [sundayLabel] = chartData.labels as string[]
    // Label for the cross-date entry should start with "Sun"
    expect(sundayLabel).toMatch(/^Sun\s/)
  })

  it('omits the weekday prefix when all entries share the same UTC date', () => {
    const history = [
      hist('2024-01-15T09:00:00Z', 2.0),
      hist('2024-01-15T12:00:00Z', 3.0),
    ]
    const { chartData } = buildChartData(history)
    for (const label of chartData.labels as string[]) {
      expect(label).not.toMatch(/^[A-Z][a-z]{2}\s/)
    }
  })
})
