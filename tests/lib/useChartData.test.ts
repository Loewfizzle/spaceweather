import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { buildChartData, useChartData } from '../../lib/hooks/useChartData'
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

// ── CHART_OPTIONS callbacks ───────────────────────────────────────────────────

describe('CHART_OPTIONS — ticks.callback', () => {
  const { chartOptions } = buildChartData([], [])
  const tickCb = chartOptions.scales.y.ticks.callback

  it('returns the string value for threshold labels: 0, 2, 4, 5, 7', () => {
    for (const v of [0, 2, 4, 5, 7]) {
      expect(tickCb(v)).toBe(String(v))
    }
  })

  it('returns empty string for non-threshold values: 1, 3, 6, 8, 9', () => {
    for (const v of [1, 3, 6, 8, 9]) {
      expect(tickCb(v)).toBe('')
    }
  })
})

describe('CHART_OPTIONS — grid.color', () => {
  const { chartOptions } = buildChartData([], [])
  const gridColor = chartOptions.scales.y.grid.color

  it('returns orange tint at Kp 5 (active onset threshold)', () => {
    expect(gridColor({ tick: { value: 5 } })).toBe('rgba(249, 115, 22, 0.22)')
  })

  it('returns yellow tint at Kp 4 (moderate onset threshold)', () => {
    expect(gridColor({ tick: { value: 4 } })).toBe('rgba(234, 179, 8, 0.18)')
  })

  it('returns default dark color for all other values', () => {
    for (const v of [0, 1, 2, 3, 6, 7, 8, 9]) {
      expect(gridColor({ tick: { value: v } })).toBe('#171f2e')
    }
  })
})

describe('CHART_OPTIONS — tooltip.callbacks.label (kpTierLabel)', () => {
  const { chartOptions } = buildChartData([], [])
  const labelCb = chartOptions.plugins.tooltip.callbacks.label

  it('returns empty string when parsed.y is null', () => {
    expect(labelCb({ parsed: { y: null }, dataset: { label: 'Kp Index' } })).toBe('')
  })

  it('returns empty string when parsed.y is undefined', () => {
    expect(labelCb({ parsed: {}, dataset: { label: 'Kp Index' } })).toBe('')
  })

  it('uses "● Kp" prefix for the Kp Index dataset', () => {
    const result = labelCb({ parsed: { y: 5 }, dataset: { label: 'Kp Index' } })
    expect(result).toContain('● Kp')
    expect(result).not.toContain('◌ Forecast')
  })

  it('uses "◌ Forecast" prefix for the Forecast dataset', () => {
    const result = labelCb({ parsed: { y: 5 }, dataset: { label: 'Forecast' } })
    expect(result).toContain('◌ Forecast')
  })

  it('labels Storm tier for kp >= 7', () => {
    expect(labelCb({ parsed: { y: 7 }, dataset: { label: 'Kp Index' } })).toContain('Storm')
    expect(labelCb({ parsed: { y: 9 }, dataset: { label: 'Kp Index' } })).toContain('Storm')
  })

  it('labels Active tier for 5 <= kp < 7', () => {
    expect(labelCb({ parsed: { y: 5 }, dataset: { label: 'Kp Index' } })).toContain('Active')
    expect(labelCb({ parsed: { y: 6 }, dataset: { label: 'Kp Index' } })).toContain('Active')
  })

  it('labels Moderate tier for 4 <= kp < 5', () => {
    expect(labelCb({ parsed: { y: 4 }, dataset: { label: 'Kp Index' } })).toContain('Moderate')
  })

  it('labels Unsettled tier for 3 <= kp < 4', () => {
    expect(labelCb({ parsed: { y: 3 }, dataset: { label: 'Kp Index' } })).toContain('Unsettled')
  })

  it('labels Quiet tier for kp < 3', () => {
    expect(labelCb({ parsed: { y: 2 }, dataset: { label: 'Kp Index' } })).toContain('Quiet')
    expect(labelCb({ parsed: { y: 0 }, dataset: { label: 'Kp Index' } })).toContain('Quiet')
  })
})

// ── Plugin callbacks ──────────────────────────────────────────────────────────

describe('tonightShade.beforeDraw', () => {
  // 2024-01-15T03:00:00Z = 10pm EST (etHour=22 ≥ 20 → tonight)
  // 2024-01-15T06:00:00Z = 1am EST  (etHour=1 < 6 → tonight)
  const tonightHistory = [
    hist('2024-01-15T03:00:00Z', 3.0),
    hist('2024-01-15T06:00:00Z', 4.0),
  ]

  it('calls fillRect for contiguous tonight blocks', () => {
    const { chartPlugins } = buildChartData(tonightHistory)
    const plugin = chartPlugins.find((p) => p.id === 'tonightShade')!
    const fillRect = vi.fn()
    plugin.beforeDraw({
      ctx: { save: vi.fn(), fillStyle: '', fillRect, restore: vi.fn() },
      chartArea: { top: 0, bottom: 100, height: 100 },
      scales: { x: { getPixelForValue: (i: number) => i * 50 } },
    })
    expect(fillRect).toHaveBeenCalledOnce()
  })

  it('returns early (no save) when all entries are daytime', () => {
    // 2024-01-15T14:00:00Z = 9am EST → not tonight
    const daytimeHistory = [
      hist('2024-01-15T14:00:00Z', 2.0),
      hist('2024-01-15T17:00:00Z', 3.0),
    ]
    const { chartPlugins } = buildChartData(daytimeHistory)
    const plugin = chartPlugins.find((p) => p.id === 'tonightShade')!
    const save = vi.fn()
    plugin.beforeDraw({
      ctx: { save, fillRect: vi.fn(), restore: vi.fn() },
      chartArea: { top: 0, bottom: 100, height: 100 },
      scales: { x: { getPixelForValue: vi.fn() } },
    })
    expect(save).not.toHaveBeenCalled()
  })

  it('returns early (no save) when chartArea is absent', () => {
    const { chartPlugins } = buildChartData(tonightHistory)
    const plugin = chartPlugins.find((p) => p.id === 'tonightShade')!
    const save = vi.fn()
    plugin.beforeDraw({
      ctx: { save },
      chartArea: null,
      scales: { x: { getPixelForValue: vi.fn() } },
    })
    expect(save).not.toHaveBeenCalled()
  })
})

describe('forecastBoundary.afterDraw', () => {
  it('draws the FORECAST → label when splitIdx > 0', () => {
    const history  = [hist('2024-01-15T09:00:00Z', 3.0)]
    const forecast = [fc('2024-01-15T12:00:00Z', 4.0)]
    const { chartPlugins } = buildChartData(history, forecast)
    const plugin = chartPlugins.find((p) => p.id === 'forecastBoundary')!

    const fillText = vi.fn()
    const ctx = {
      save: vi.fn(), restore: vi.fn(),
      strokeStyle: '', lineWidth: 0,
      setLineDash: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      font: '', fillStyle: '', textAlign: '',
      fillText,
    }
    plugin.afterDraw({
      ctx,
      chartArea: { top: 0, bottom: 100 },
      scales: { x: { getPixelForValue: (i: number) => i * 100 } },
    })
    expect(fillText).toHaveBeenCalledWith('FORECAST →', expect.any(Number), expect.any(Number))
  })

  it('returns early (no draw) when splitIdx is 0 (empty history)', () => {
    // No history → splitIdx = recent.length = 0 → afterDraw returns immediately
    const forecast = [fc('2024-01-15T12:00:00Z', 4.0)]
    const { chartPlugins } = buildChartData([], forecast)
    const plugin = chartPlugins.find((p) => p.id === 'forecastBoundary')!
    expect(plugin).toBeDefined() // plugin is created but does nothing

    const fillText = vi.fn()
    plugin.afterDraw({ ctx: { fillText }, chartArea: {}, scales: { x: {} } })
    expect(fillText).not.toHaveBeenCalled()
  })
})

// ── useChartData hook ─────────────────────────────────────────────────────────

describe('useChartData hook', () => {
  it('returns the same shape as buildChartData for a given input', () => {
    // 14:00 UTC = 9am EST → daytime; 17:00 UTC = 12pm EST → daytime; neither in aurora window
    const history  = [hist('2024-01-15T14:00:00Z', 3.0)]
    const forecast = [fc('2024-01-15T17:00:00Z', 4.0)]
    const { result } = renderHook(() => useChartData(history, forecast))
    expect(result.current.hasForecast).toBe(true)
    expect(result.current.hasTonight).toBe(false)
    expect(result.current.chartData.datasets).toHaveLength(2)
    expect(result.current.chartPlugins).toHaveLength(2) // tonightShade + forecastBoundary
  })

  it('reflects empty inputs correctly', () => {
    const { result } = renderHook(() => useChartData([]))
    expect(result.current.hasForecast).toBe(false)
    expect(result.current.chartData.labels).toHaveLength(0)
  })
})
