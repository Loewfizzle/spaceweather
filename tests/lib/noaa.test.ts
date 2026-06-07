import { describe, it, expect } from 'vitest'
import { latest } from '../../lib/noaa'
import { getAuroraRiskLevel, getAuroraGuidance, cloudCoverColor, getKpTier } from '../../lib/aurora/kp'
import {
  filterOvationCoordinates,
  maxOvationNorthAmerica,
  getAuroraColor,
  getAuroraMarkerRadius,
  getProbTier,
} from '../../lib/aurora/ovation'
import { getTonightOutlook, getCityAuroraProbabilities, getLocationAuroraProb } from '../../lib/aurora/outlook'
import { parseRecentCmes, assessEarthImpact, currentSunspotNumber } from '../../lib/aurora/solar'
import { approximateLocation, getNearestCityName } from '../../lib/aurora/location'
import {
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  MAJOR_METEOR_SHOWERS,
} from '../../lib/aurora/meteors'
import { formatFireballDate, formatFireballEnergy, formatFireballLocation } from '../../lib/aurora/fireballs'
import type { Alert, SolarRegion, CmeSummary, XrayFlare, OvationResponse, MeteorShower } from '../../lib/api/schemas'

// ============================================
// getAuroraRiskLevel
// ============================================
describe('getAuroraRiskLevel', () => {
  it('returns Quiet when kp is null', () => {
    expect(getAuroraRiskLevel(null, 10, -3)).toBe('Quiet')
  })

  it('returns High for strong conditions (kp >= 5 or high prob or strong negative Bz)', () => {
    expect(getAuroraRiskLevel(5, 5, -3)).toBe('High')
    expect(getAuroraRiskLevel(4, 30, -3)).toBe('High')
    expect(getAuroraRiskLevel(3, 5, -9)).toBe('High')
  })

  it('returns Moderate for medium conditions', () => {
    expect(getAuroraRiskLevel(4, 5, -3)).toBe('Moderate')
    expect(getAuroraRiskLevel(3, 20, -3)).toBe('Moderate')
    expect(getAuroraRiskLevel(3, 5, -6)).toBe('Moderate')
  })

  it('returns Quiet for weak conditions', () => {
    expect(getAuroraRiskLevel(2, 5, -2)).toBe('Quiet')
    expect(getAuroraRiskLevel(3, 5, -3)).toBe('Quiet')
  })

  it('returns Moderate when kp >= 3 and solar wind speed > 600 km/s', () => {
    expect(getAuroraRiskLevel(3, 5, -3, 650)).toBe('Moderate')
    expect(getAuroraRiskLevel(3, 5, -3, 601)).toBe('Moderate')
  })

  it('returns High when kp >= 4 and solar wind speed > 600 km/s', () => {
    expect(getAuroraRiskLevel(4, 5, -3, 650)).toBe('High')
  })

  it('does not elevate risk for speed <= 600 km/s', () => {
    expect(getAuroraRiskLevel(3, 5, -3, 600)).toBe('Quiet')
    expect(getAuroraRiskLevel(3, 5, -3, 500)).toBe('Quiet')
  })

  it('returns Quiet when solarWindSpeed is null (no elevation)', () => {
    expect(getAuroraRiskLevel(3, 5, -3, null)).toBe('Quiet')
    expect(getAuroraRiskLevel(3, 5, -3, undefined)).toBe('Quiet')
  })
})

// ============================================
// getTonightOutlook - most critical function
// ============================================
describe('getTonightOutlook', () => {
  const baseCme: CmeSummary[] = []
  const baseFlare: XrayFlare | null = null

  it('returns Loading state when kp is null', () => {
    const result = getTonightOutlook(null, -5, 15, baseCme, baseFlare)
    expect(result.status).toBe('Loading')
    expect(result.message).toContain('Loading current conditions')
  })

  it('returns Excellent for very high Kp or strong combination', () => {
    const result = getTonightOutlook(7, -8, 25, baseCme, baseFlare)
    expect(result.status).toBe('Excellent')
    expect(result.accentColor).toBe('#a78bfa')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('returns Good for solid Kp + favorable Bz or high prob', () => {
    const result = getTonightOutlook(5, -6, 15, baseCme, baseFlare)
    expect(result.status).toBe('Good')
  })

  it('returns Moderate when Kp >= 4 or moderate prob or Earth-directed CME', () => {
    const cmeWithImpact: CmeSummary[] = [{
      time: '2026-06-05T10:00:00Z',
      speed: 1200,
      direction: 'Earth-directed',
      earthImpact: 'Likely Earth impact',
      note: 'Halo CME expected to arrive...',
    }]
    const result = getTonightOutlook(4, -3, 8, cmeWithImpact, baseFlare)
    expect(result.status).toBe('Moderate')
    expect(result.reasons.some(r => r.includes('CME'))).toBe(true)
  })

  it('returns Low or Quiet for weak conditions', () => {
    const result = getTonightOutlook(2, -2, 5, baseCme, baseFlare)
    expect(['Low', 'Quiet']).toContain(result.status)
  })

  it('includes driver string with Kp, Bz, and speed when provided', () => {
    const result = getTonightOutlook(4.5, -7.2, 18, baseCme, baseFlare, 650)
    expect(result.drivers).toContain('Kp 4.5')
    expect(result.drivers).toContain('Bz -7.2')
    expect(result.drivers).toContain('650 km/s')
  })

  it('high solar wind speed alone pushes to at least Moderate', () => {
    const result = getTonightOutlook(2, -2, 5, baseCme, baseFlare, 650)
    expect(['Moderate', 'Good', 'Excellent']).toContain(result.status)
  })

  it('high speed + southward Bz at Kp3 reaches Good', () => {
    const result = getTonightOutlook(3, -6, 5, baseCme, baseFlare, 650)
    expect(result.status).toBe('Good')
  })

  it('very high speed + Bz + Kp5 reaches Excellent', () => {
    const result = getTonightOutlook(5, -6, 5, baseCme, baseFlare, 750)
    expect(result.status).toBe('Excellent')
  })
})

// ============================================
// currentSunspotNumber
// ============================================
describe('currentSunspotNumber', () => {
  it('returns null for empty or invalid regions', () => {
    expect(currentSunspotNumber([])).toBeNull()
    expect(currentSunspotNumber(undefined)).toBeNull()
  })

  it('calculates total sunspots for the latest observed date', () => {
    const regions: SolarRegion[] = [
      { observed_date: '2026-06-04', region: 1, number_spots: 12 },
      { observed_date: '2026-06-04', region: 2, number_spots: 8 },
      { observed_date: '2026-06-03', region: 3, number_spots: 25 },
    ]
    expect(currentSunspotNumber(regions)).toBe(20) // 12 + 8
  })

  it('ignores regions without observed_date or number_spots', () => {
    const regions: SolarRegion[] = [
      { observed_date: '2026-06-04', region: 1, number_spots: 10 },
      { observed_date: null as unknown as string, region: 2, number_spots: 99 },
      { observed_date: '2026-06-04', region: 3, number_spots: null as unknown as number | null },
    ]
    expect(currentSunspotNumber(regions)).toBe(10)
  })
})

// ============================================
// Meteor helpers
// ============================================
describe('Meteor helpers', () => {
  it('getNextMeteorShower returns a future shower', () => {
    const result = getNextMeteorShower(new Date('2026-06-05'))
    expect(result).not.toBeNull()
    expect(result!.shower.name).toBeDefined()
    expect(result!.peakDate.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns Perseids when called on July 1', () => {
    const result = getNextMeteorShower(new Date(2026, 6, 1)) // July 1
    expect(result?.shower.name).toBe('Perseids')
    expect(result?.peakDate.getFullYear()).toBe(2026)
  })

  it('wraps to Quadrantids of next year after Dec 14 (Geminids end)', () => {
    const result = getNextMeteorShower(new Date(2026, 11, 15)) // Dec 15
    expect(result?.shower.name).toBe('Quadrantids')
    expect(result?.peakDate.getFullYear()).toBe(2027)
  })

  it('includes a shower whose peak is exactly today at midnight (not yet past)', () => {
    // Candidate is midnight; now is also midnight → candidate is NOT less than now → included
    const result = getNextMeteorShower(new Date(2026, 7, 12, 0, 0, 0)) // Aug 12 00:00
    expect(result?.shower.name).toBe('Perseids')
  })

  it('skips a shower whose midnight peak has already passed (now is later that day)', () => {
    const result = getNextMeteorShower(new Date(2026, 7, 12, 12, 0, 0)) // Aug 12 noon
    expect(result?.shower.name).not.toBe('Perseids')
    expect(result?.shower.name).toBe('Orionids') // Oct 21 is next
  })

  it('formatMeteorPeak formats date range correctly', () => {
    // This is a simplified test - adjust if your MAJOR_METEOR_SHOWERS data changes
    const mockShower: MeteorShower = { name: 'Perseids', peakMonth: 8, peakDay: 12, peakEndDay: 13, activityLevel: 'High', description: 'One of the best annual meteor showers.' }
    const date = new Date(2026, 7, 12)
    const formatted = formatMeteorPeak(date, mockShower)
    expect(formatted).toContain('August 12')
  })

  it('formatMeteorPeak includes the year', () => {
    const shower: MeteorShower = { name: 'Geminids', peakMonth: 12, peakDay: 13, peakEndDay: 14, activityLevel: 'High', description: 'Best shower.' }
    expect(formatMeteorPeak(new Date(2026, 11, 13), shower)).toContain('2026')
  })

  it('formatMeteorPeak handles cross-month range', () => {
    // hypothetical shower Nov 29 – Dec 1
    const shower: MeteorShower = { name: 'Test', peakMonth: 11, peakDay: 29, peakEndDay: 1, peakEndMonth: 12, activityLevel: 'Low', description: 'Test.' }
    const result = formatMeteorPeak(new Date(2026, 10, 29), shower)
    expect(result).toContain('November')
    expect(result).toContain('December')
  })

  it('formatMeteorPeak renders same-month range with dash', () => {
    const shower: MeteorShower = { name: 'Perseids', peakMonth: 8, peakDay: 12, peakEndDay: 13, activityLevel: 'High', description: '.' }
    const result = formatMeteorPeak(new Date(2026, 7, 12), shower)
    expect(result).toContain('12')
    expect(result).toContain('13')
  })
})

// ============================================
// Utility functions
// ============================================
describe('latest()', () => {
  it('returns the last item in array', () => {
    expect(latest([{ time_tag: '1' }, { time_tag: '2' }])?.time_tag).toBe('2')
  })

  it('returns null for empty array', () => {
    expect(latest([])).toBeNull()
  })
})

describe('filterOvationCoordinates + maxOvationNorthAmerica', () => {
  // Real NOAA OVATION uses 0-360 longitude convention; normalizeLon converts to -180..180.
  // 260 = -100°, 280 = -80°, 240 = -120°, 300 = -60° — all within North America bounds.
  const mockOvation: OvationResponse = {
    coordinates: [
      [260, 45, 35],  // lon 260 → -100°, NA ✓
      [280, 50, 12],  // lon 280 → -80°,  NA ✓
      [240, 30, 8],   // lon 240 → -120°, NA ✓ but prob < 10 (filtered by minProb)
      [300, 70, 55],  // lon 300 → -60°,  NA ✓
    ],
  }

  it('normalizes 0-360 longitudes and filters to North America bounds and min probability', () => {
    const filtered = filterOvationCoordinates(mockOvation.coordinates, 10)
    expect(filtered.length).toBe(3)
    // Verify normalization produced correct -180..180 values
    expect(filtered.map(p => p.lon).sort((a, b) => a - b)).toEqual([-100, -80, -60])
  })

  it('computes max probability in North America using 0-360 coordinates', () => {
    const max = maxOvationNorthAmerica(filterOvationCoordinates(mockOvation.coordinates, 0))
    expect(max).toBe(55)
  })

  it('excludes coordinates outside North America bounds', () => {
    const outsideNA: OvationResponse = {
      coordinates: [
        [0, 50, 40],    // lon 0 → 0° (Europe), out of bounds
        [90, 45, 30],   // lon 90 → 90° (Asia), out of bounds
        [260, 45, 20],  // lon 260 → -100° (NA) ✓
      ],
    }
    const filtered = filterOvationCoordinates(outsideNA.coordinates, 0)
    expect(filtered.length).toBe(1)
    expect(filtered[0].lon).toBeCloseTo(-100)
  })

  it('includes points exactly at NA longitude boundaries (190→-170, 310→-50)', () => {
    const coords = [
      [190, 45, 10],  // 190 > 180 → 190 - 360 = -170 (exactly minLon, included)
      [310, 45, 10],  // 310 > 180 → 310 - 360 = -50  (exactly maxLon, included)
      [189, 45, 10],  // 189 ≤ 180 → stays 189 (outside NA), excluded
      [311, 45, 10],  // 311 > 180 → 311 - 360 = -49  (outside maxLon), excluded
    ]
    const filtered = filterOvationCoordinates(coords, 0)
    expect(filtered).toHaveLength(2)
    const lons = filtered.map((p) => p.lon).sort((a, b) => a - b)
    expect(lons).toEqual([-170, -50])
  })

  it('normalizes lon=360 to 0 (prime meridian, excluded from NA)', () => {
    // 360 > 180 → 360 - 360 = 0; lon 0 is outside NA bounds [-170, -50]
    const coords = [[360, 50, 20]]
    expect(filterOvationCoordinates(coords, 0)).toHaveLength(0)
  })
})

describe('getAuroraColor', () => {
  it('returns 4-tier probability palette (quiet/low/moderate/high)', () => {
    // quiet  (<15%)    → gray
    expect(getAuroraColor(0)).toBe('#64748b')
    expect(getAuroraColor(14)).toBe('#64748b')
    // low    (15–34%)  → amber
    expect(getAuroraColor(15)).toBe('#eab308')
    expect(getAuroraColor(34)).toBe('#eab308')
    // moderate (35–59%) → green
    expect(getAuroraColor(35)).toBe('#22c55e')
    expect(getAuroraColor(59)).toBe('#22c55e')
    // high   (≥60%)    → violet
    expect(getAuroraColor(60)).toBe('#a78bfa')
    expect(getAuroraColor(100)).toBe('#a78bfa')
  })
})

// ============================================
// getAuroraGuidance
// ============================================
describe('getAuroraGuidance', () => {
  it('returns loading text when kp is null', () => {
    expect(getAuroraGuidance(null, null, null)).toBe('Data loading...')
  })

  it('returns Excellent-tier text for kp >= 7', () => {
    const result = getAuroraGuidance(7, 10, -3)
    // Delegates to getTonightOutlook Excellent: "Strong chance across the northern tier..."
    expect(result).toContain('northern tier')
    expect(result).toContain('Great Lakes')
  })

  it('returns northern-tier text for kp 5-6', () => {
    const result = getAuroraGuidance(5, 10, -3)
    expect(result).toContain('northern-tier')
    expect(result).toContain('Great Lakes')
  })

  it('appends Bz boost note when bz <= -5', () => {
    const result = getAuroraGuidance(3, 5, -6)
    expect(result).toContain('southward Bz')
  })

  it('appends OVATION note when maxProb >= 20 and bz not favorable', () => {
    const result = getAuroraGuidance(3, 25, -2)
    expect(result).toContain('probabilities across North America')
  })

  it('Bz note takes priority over OVATION note', () => {
    const result = getAuroraGuidance(3, 25, -8)
    expect(result).toContain('southward Bz')
    expect(result).not.toContain('probabilities across North America')
  })

  it('shows Moderate-tier text with solar wind note when kp=3 and speed > 600', () => {
    // getTonightOutlook routes kp=3+speed to Moderate (not Good — requires favorable Bz too)
    const result = getAuroraGuidance(3, 5, -2, 650)
    expect(result).toContain('northern states')
    expect(result).toContain('solar wind speed')
  })

  it('appends solar wind note when speed > 600 and Bz not favorable', () => {
    const result = getAuroraGuidance(2, 5, -2, 650)
    expect(result).toContain('solar wind speed')
  })

  it('Bz note takes priority over solar wind note', () => {
    const result = getAuroraGuidance(2, 5, -6, 650)
    expect(result).toContain('southward Bz')
    expect(result).not.toContain('solar wind speed')
  })

  it('does not append solar wind note when speed <= 600', () => {
    const result = getAuroraGuidance(2, 5, -2, 600)
    expect(result).not.toContain('solar wind speed')
  })

  it('does not append solar wind note when solarWindSpeed is null', () => {
    const result = getAuroraGuidance(2, 5, -2, null)
    expect(result).not.toContain('solar wind speed')
  })
})

// ============================================
// getCityAuroraProbabilities
// ============================================
describe('getCityAuroraProbabilities', () => {
  it('returns 6 cities', () => {
    const result = getCityAuroraProbabilities([], null, null)
    expect(result).toHaveLength(6)
    expect(result[0].name).toBe('Fairbanks')
    expect(result[5].name).toBe('Presque Isle')
  })

  it('returns 0 for all cities when no data and no kp', () => {
    const result = getCityAuroraProbabilities([], null, null)
    result.forEach(c => expect(c.prob).toBe(0))
  })

  it('uses Kp-based fallback when points are empty', () => {
    // Kp 6 should give Fairbanks (65°N) a meaningful probability
    const result = getCityAuroraProbabilities([], 6, null)
    expect(result[0].state).toBe('AK')
    expect(result[0].prob).toBeGreaterThan(0)
    // All 6 cities are at high latitudes; verify all have non-negative probs
    result.forEach(c => expect(c.prob).toBeGreaterThanOrEqual(0))
  })

  it('picks the nearest OVATION grid point for each city', () => {
    // High-prob point near Fairbanks (~68°N, -148°W → rawLon 212): clearly closest
    // to result[0] (Fairbanks 65°N, -148°W); all mid-latitude cities are far away.
    // Mid-prob point near Duluth (~47°N, -92°W → rawLon 268): closest to result[1–5].
    const ovation: OvationResponse = {
      coordinates: [
        [212, 68, 80],   // near Fairbanks
        [268, 47, 70],   // near Duluth
      ],
    }
    const result = getCityAuroraProbabilities(filterOvationCoordinates(ovation.coordinates, 0), 5, null)
    expect(result[0].prob).toBe(80)   // Fairbanks → high-latitude point
    expect(result[2].prob).toBe(70)   // Duluth → mid-latitude point
  })

  it('applies Bz boost when bz <= -5', () => {
    const base = getCityAuroraProbabilities([], 5, null)
    const boosted = getCityAuroraProbabilities([], 5, -8)
    // bz=-8: abs(-8+5)*1.5 = 4.5 → round to 5, so boosted >= base
    boosted.forEach((c, i) => expect(c.prob).toBeGreaterThanOrEqual(base[i].prob))
  })

  it('clamps probability to 0–99', () => {
    // Very high Kp + very negative Bz should not exceed 99
    const result = getCityAuroraProbabilities([], 9, -30)
    result.forEach(c => {
      expect(c.prob).toBeGreaterThanOrEqual(0)
      expect(c.prob).toBeLessThanOrEqual(99)
    })
  })
})

describe('parseRecentCmes', () => {
  it('returns empty array for undefined', () => {
    expect(parseRecentCmes(undefined)).toEqual([])
  })

  it('returns empty array for empty alerts array', () => {
    expect(parseRecentCmes([])).toEqual([])
  })

  it('extracts CMEs from alerts', () => {
    const alerts: Alert[] = [
      { message: 'CME alert: 1200 km/s Earth-directed halo', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    const cmes = parseRecentCmes(alerts)
    expect(cmes.length).toBe(1)
    expect(cmes[0].speed).toBe(1200)
  })

  it('WATA storm watch IDs take priority and appear first', () => {
    const alerts: Alert[] = [
      { message: 'Body CME mention 750 km/s', issue_datetime: '2026-06-03T08:00Z', product_id: 'ALTXX' },
      { message: 'G2 watch issued', issue_datetime: '2026-06-04T08:00Z', product_id: 'WATA20' },
    ]
    const cmes = parseRecentCmes(alerts)
    expect(cmes.length).toBe(2)
    expect(cmes[0].time).toBe('2026-06-04T08:00Z') // WATA first
  })

  it('includes non-storm-watch body CME mention when no WATA exists', () => {
    const alerts: Alert[] = [
      { message: 'Coronal Mass Ejection detected at 900 km/s', issue_datetime: '2026-06-05T06:00Z', product_id: 'ALTXX' },
    ]
    const cmes = parseRecentCmes(alerts)
    expect(cmes.length).toBe(1)
    expect(cmes[0].speed).toBe(900)
  })

  it('excludes alerts that are neither WATA nor body CME mentions', () => {
    const alerts: Alert[] = [
      { message: 'Solar flare detected — no relevant events', issue_datetime: '2026-06-05T06:00Z', product_id: 'K05A' },
    ]
    expect(parseRecentCmes(alerts)).toHaveLength(0)
  })

  it('caps candidates at 2 even when more than 2 match', () => {
    const alerts: Alert[] = [
      { message: 'CME 1', issue_datetime: '2026-06-05T08:00Z', product_id: 'WATA30' },
      { message: 'CME 2', issue_datetime: '2026-06-05T07:00Z', product_id: 'WATA20' },
      { message: 'CME body mention', issue_datetime: '2026-06-05T06:00Z', product_id: 'ALTXX' },
    ]
    expect(parseRecentCmes(alerts)).toHaveLength(2)
  })

  it('sets earthImpact to "Likely Earth impact" for Earth-directed messages', () => {
    const alerts: Alert[] = [
      { message: 'Earth-directed CME at 1500 km/s detected', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    expect(parseRecentCmes(alerts)[0].earthImpact).toBe('Likely Earth impact')
  })

  it('sets earthImpact to "Monitor for effects" for non-Earth-directed messages', () => {
    const alerts: Alert[] = [
      { message: 'CME detected moving southward, 800 km/s', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    expect(parseRecentCmes(alerts)[0].earthImpact).toBe('Monitor for effects')
  })

  it('extracts "geomagnetic storm" as Likely Earth impact trigger', () => {
    const alerts: Alert[] = [
      { message: 'CME expected. Geomagnetic storm watch issued.', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    expect(parseRecentCmes(alerts)[0].earthImpact).toBe('Likely Earth impact')
  })

  it('extracts direction for "full halo CME"', () => {
    const alerts: Alert[] = [
      { message: 'Full halo CME detected, Earth-directed, 1200 km/s', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    const direction = parseRecentCmes(alerts)[0].direction
    expect(direction).toMatch(/halo/i)
  })

  it('extracts direction for "partial halo"', () => {
    const alerts: Alert[] = [
      { message: 'Partial halo CME at 600 km/s observed', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    expect(parseRecentCmes(alerts)[0].direction).toMatch(/halo/i)
  })

  it('leaves direction undefined when no direction pattern matches', () => {
    const alerts: Alert[] = [
      { message: 'CME detected, southward trajectory, 800 km/s', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    expect(parseRecentCmes(alerts)[0].direction).toBeUndefined()
  })

  it('leaves speed undefined when no speed pattern matches', () => {
    const alerts: Alert[] = [
      { message: 'CME detected, speed unknown', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    expect(parseRecentCmes(alerts)[0].speed).toBeUndefined()
  })

  it('does not match 2-digit "speeds" (word-boundary guard)', () => {
    const alerts: Alert[] = [
      { message: 'CME at 99 km/s observed', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    // \b(\d{3,4})\s*km\/s requires 3-4 digits
    expect(parseRecentCmes(alerts)[0].speed).toBeUndefined()
  })

  it('truncates note to 140 chars with ellipsis for long messages', () => {
    const line = 'CME detected. ' + 'A'.repeat(160) // must contain CME to pass body filter
    const alerts: Alert[] = [
      { message: line, issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    const note = parseRecentCmes(alerts)[0].note
    expect(note.endsWith('…')).toBe(true)
    expect(note.length).toBeLessThanOrEqual(143) // 140 chars + "…"
  })
})

// ============================================
// formatFireballDate
// ============================================
describe('formatFireballDate', () => {
  it('returns — for empty string', () => {
    expect(formatFireballDate('')).toBe('—')
  })

  it('parses NASA JPL space-separated format correctly (ISO 8601 via T-replacement)', () => {
    // "2024-01-15 21:30:45" must produce a valid, human-readable UTC string.
    // The old `dateStr + "Z"` form is non-standard and fails in Safari/JSC.
    const result = formatFireballDate('2024-01-15 21:30:45')
    expect(result).not.toBe('—')
    expect(result).not.toContain('Invalid Date')
    expect(result).toContain('2024')
    expect(result).toContain('UTC')
  })

  it('includes month, day, hour, minute, and UTC suffix', () => {
    const result = formatFireballDate('2024-08-12 03:45:00')
    expect(result).toContain('Aug')
    expect(result).toContain('12')
    expect(result).toContain('2024')
    expect(result).toContain('UTC')
  })

  it('returns the raw string for an unparseable date', () => {
    // isNaN(d.getTime()) guard ensures the raw input is returned rather than "Invalid Date UTC"
    const bad = 'not-a-date-at-all'
    expect(formatFireballDate(bad)).toBe(bad)
  })
})

// ============================================
// formatFireballEnergy
// ============================================
describe('formatFireballEnergy', () => {
  it('returns — for null', () => {
    expect(formatFireballEnergy(null)).toBe('—')
  })

  it('returns — for undefined', () => {
    expect(formatFireballEnergy(undefined)).toBe('—')
  })

  it('returns — for empty string', () => {
    expect(formatFireballEnergy('')).toBe('—')
  })

  it('returns — for non-numeric string', () => {
    expect(formatFireballEnergy('n/a')).toBe('—')
  })

  it('formats values >= 1 with one decimal place', () => {
    expect(formatFireballEnergy('1.0')).toBe('1.0 kt TNT')
    expect(formatFireballEnergy('15.7')).toBe('15.7 kt TNT')
    expect(formatFireballEnergy('100')).toBe('100.0 kt TNT')
  })

  it('formats values in [0.001, 1) with three decimal places', () => {
    expect(formatFireballEnergy('0.5')).toBe('0.500 kt TNT')
    expect(formatFireballEnergy('0.123')).toBe('0.123 kt TNT')
  })

  it('formats exact boundary 0.001 as three decimals (not < prefix)', () => {
    expect(formatFireballEnergy('0.001')).toBe('0.001 kt TNT')
  })

  it('formats values < 0.001 as "< 0.001 kt TNT"', () => {
    expect(formatFireballEnergy('0.0001')).toBe('< 0.001 kt TNT')
    expect(formatFireballEnergy('0.000001')).toBe('< 0.001 kt TNT')
  })
})

// ============================================
// formatFireballLocation
// ============================================
describe('formatFireballLocation', () => {
  it('returns "Location unavailable" when both lat and lon are null', () => {
    expect(formatFireballLocation({ lat: null, lon: null })).toBe('Location unavailable')
  })

  it('returns "Location unavailable" when lat is null', () => {
    expect(formatFireballLocation({ lat: null, lon: -80 })).toBe('Location unavailable')
  })

  it('returns "Location unavailable" when lon is null', () => {
    expect(formatFireballLocation({ lat: 42, lon: null })).toBe('Location unavailable')
  })

  it('formats positive lat and negative lon as N/W', () => {
    expect(formatFireballLocation({ lat: 42.5, lon: -83.1 })).toBe('42.5°N, 83.1°W')
  })

  it('formats negative lat and positive lon as S/E', () => {
    expect(formatFireballLocation({ lat: -33.9, lon: 151.2 })).toBe('33.9°S, 151.2°E')
  })

  it('formats positive lat and positive lon as N/E', () => {
    expect(formatFireballLocation({ lat: 51.5, lon: 0.1 })).toBe('51.5°N, 0.1°E')
  })

  it('formats negative lat and negative lon as S/W', () => {
    expect(formatFireballLocation({ lat: -23.5, lon: -46.6 })).toBe('23.5°S, 46.6°W')
  })
})

// ============================================
// getNearestCityName
// ============================================
describe('getNearestCityName', () => {
  it('returns a string in "City, ST" format', () => {
    const result = getNearestCityName(42.73, -84.55) // Lansing, MI
    expect(result).toMatch(/^.+, [A-Z]{2}$/)
  })

  it('returns Lansing for coordinates exactly at Lansing', () => {
    expect(getNearestCityName(42.73, -84.55)).toBe('Lansing, MI')
  })

  it('returns Marquette for coordinates in the Upper Peninsula', () => {
    // Marquette, MI lat: 46.54 lon: -87.40
    expect(getNearestCityName(46.54, -87.40)).toBe('Marquette, MI')
  })

  it('returns a city near the given coordinates (not an arbitrary default)', () => {
    // Grand Rapids area — should return a western Michigan city
    const result = getNearestCityName(42.96, -85.67)
    expect(result).toContain('MI')
  })
})

// ============================================
// getLocationAuroraProb
// ============================================
describe('getLocationAuroraProb', () => {
  it('returns 0 with no OVATION data and kp=null', () => {
    expect(getLocationAuroraProb(44.0, -85.0, [], null, null)).toBe(0)
  })

  it('uses Kp-based fallback when points are empty', () => {
    // High Kp should give a meaningful probability at a northern latitude
    const prob = getLocationAuroraProb(46.0, -87.0, [], 7, null)
    expect(prob).toBeGreaterThan(0)
    expect(prob).toBeLessThanOrEqual(99)
  })

  it('picks the nearest OVATION grid cell', () => {
    const ovation: OvationResponse = {
      coordinates: [
        [275, 44, 60],  // lon 275 → -85°, near query point
        [260, 46, 5],   // lon 260 → -100°, far from query point
      ],
    }
    const prob = getLocationAuroraProb(44.0, -85.0, filterOvationCoordinates(ovation.coordinates, 0), 5, null)
    expect(prob).toBe(60)
  })

  it('applies Bz boost for strongly southward Bz', () => {
    const base = getLocationAuroraProb(44.0, -85.0, [], 5, null)
    const boosted = getLocationAuroraProb(44.0, -85.0, [], 5, -8)
    expect(boosted).toBeGreaterThan(base)
  })

  it('clamps result to 0–99', () => {
    const prob = getLocationAuroraProb(60.0, -100.0, [], 9, -30)
    expect(prob).toBeGreaterThanOrEqual(0)
    expect(prob).toBeLessThanOrEqual(99)
  })
})

// ============================================
// getTonightOutlook — drivers string null cases
// ============================================
describe('getTonightOutlook drivers string', () => {
  const baseCme: CmeSummary[] = []
  const baseFlare: XrayFlare | null = null

  it('uses em-dash when bz is null', () => {
    const result = getTonightOutlook(3, null, 10, baseCme, baseFlare)
    expect(result.drivers).toContain('Bz —')
  })

  it('omits speed segment when solarWindSpeed is null', () => {
    const result = getTonightOutlook(3, -4, 10, baseCme, baseFlare)
    expect(result.drivers).not.toContain('km/s')
    expect(result.drivers).toMatch(/^Kp \d+\.\d+ • Bz/)
  })

  it('omits speed segment when solarWindSpeed is undefined', () => {
    const result = getTonightOutlook(3, -4, 10, baseCme, baseFlare, undefined)
    expect(result.drivers).not.toContain('km/s')
  })

  it('includes speed segment when solarWindSpeed is provided', () => {
    const result = getTonightOutlook(3, -4, 10, baseCme, baseFlare, 500)
    expect(result.drivers).toContain('500 km/s')
  })

  it('shows em-dash for bz and omits speed when both are null', () => {
    const result = getTonightOutlook(3, null, 10, baseCme, baseFlare)
    expect(result.drivers).toContain('Bz —')
    expect(result.drivers).not.toContain('km/s')
  })
})

// ============================================
// assessEarthImpact
// ============================================
describe('assessEarthImpact', () => {
  const fresh = (overrides: Partial<CmeSummary> = {}): CmeSummary => ({
    time: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    note: 'test CME',
    ...overrides,
  })
  const stale = (overrides: Partial<CmeSummary> = {}): CmeSummary => ({
    time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(), // 6 days ago
    note: 'old CME',
    ...overrides,
  })

  it('returns none for empty array', () => {
    expect(assessEarthImpact([])).toMatchObject({ level: 'none', cme: null })
  })

  it('returns none when all CMEs are older than 5 days', () => {
    expect(assessEarthImpact([stale(), stale()])).toMatchObject({ level: 'none' })
  })

  it('returns possible for a fresh CME with no earthImpact flag', () => {
    const result = assessEarthImpact([fresh()])
    expect(result.level).toBe('possible')
    expect(result.cme).not.toBeNull()
  })

  it('returns likely when a fresh CME has earthImpact = "Likely Earth impact"', () => {
    const result = assessEarthImpact([fresh({ earthImpact: 'Likely Earth impact' })])
    expect(result.level).toBe('likely')
    expect(result.headline).toContain('Earth-directed')
  })

  it('likely takes priority over possible even when possible comes first in the array', () => {
    const result = assessEarthImpact([
      fresh({ note: 'uncertain' }),
      fresh({ earthImpact: 'Likely Earth impact', note: 'confirmed' }),
    ])
    expect(result.level).toBe('likely')
  })

  it('stale likely CME does not trigger — returns possible for remaining fresh CME', () => {
    const result = assessEarthImpact([
      fresh({ note: 'generic' }),
      stale({ earthImpact: 'Likely Earth impact' }),
    ])
    expect(result.level).toBe('possible')
  })

  it('returns glancing when a fresh CME has earthImpact = "Glancing impact possible"', () => {
    const result = assessEarthImpact([fresh({ earthImpact: 'Glancing impact possible' })])
    expect(result.level).toBe('glancing')
    expect(result.headline).toContain('Glancing')
    expect(result.cme).not.toBeNull()
  })

  it('likely takes priority over glancing', () => {
    const result = assessEarthImpact([
      fresh({ earthImpact: 'Glancing impact possible' }),
      fresh({ earthImpact: 'Likely Earth impact' }),
    ])
    expect(result.level).toBe('likely')
  })

  it('glancing takes priority over possible', () => {
    const result = assessEarthImpact([
      fresh({ note: 'uncertain' }),
      fresh({ earthImpact: 'Glancing impact possible' }),
    ])
    expect(result.level).toBe('glancing')
  })

  it('includes speed in detail when provided', () => {
    const result = assessEarthImpact([fresh({ earthImpact: 'Likely Earth impact', speed: 1500 })])
    expect(result.detail).toContain('1,500')
  })

  it('omits speed phrase when speed is absent', () => {
    const result = assessEarthImpact([fresh({ earthImpact: 'Likely Earth impact', speed: undefined })])
    expect(result.detail).not.toContain('traveling at')
  })
})

// ============================================
// approximateLocation
// ============================================
describe('approximateLocation', () => {
  // Polar
  it('returns Arctic Ocean for lat > 67', () => {
    expect(approximateLocation(70, 0)).toBe('Arctic Ocean')
    expect(approximateLocation(68, 90)).toBe('Arctic Ocean')
  })

  it('returns Southern Ocean for lat < -60', () => {
    expect(approximateLocation(-61, 0)).toBe('Southern Ocean')
    expect(approximateLocation(-80, -60)).toBe('Southern Ocean')
  })

  // Enclosed seas
  it('returns Black Sea (must precede Mediterranean in evaluation order)', () => {
    // Black Sea bbox is entirely inside Mediterranean bbox — ordering bug would return "Mediterranean Sea"
    expect(approximateLocation(43, 34)).toBe('Black Sea')
    expect(approximateLocation(41, 30)).toBe('Black Sea')
  })

  it('returns Mediterranean Sea', () => {
    expect(approximateLocation(38, 15)).toBe('Mediterranean Sea')
  })

  it('returns Red Sea', () => {
    expect(approximateLocation(27, 35)).toBe('Red Sea')
    expect(approximateLocation(22, 38)).toBe('Red Sea')
  })

  it('returns Persian Gulf', () => {
    expect(approximateLocation(26, 52)).toBe('Persian Gulf')
  })

  it('returns Bering Sea (western half, Russia side)', () => {
    expect(approximateLocation(60, 170)).toBe('Bering Sea')
    expect(approximateLocation(55, 160)).toBe('Bering Sea')
  })

  it('returns Bering Sea (eastern half, Alaska side)', () => {
    expect(approximateLocation(60, -170)).toBe('Bering Sea')
    expect(approximateLocation(58, -168)).toBe('Bering Sea') // boundary
  })

  it('returns Gulf of Mexico', () => {
    expect(approximateLocation(25, -90)).toBe('Gulf of Mexico')
  })

  it('returns Caribbean Sea', () => {
    expect(approximateLocation(15, -75)).toBe('Caribbean Sea')
  })

  it('returns Gulf of Guinea', () => {
    expect(approximateLocation(3, 5)).toBe('Gulf of Guinea')
    expect(approximateLocation(-3, 2)).toBe('Gulf of Guinea')
  })

  // Greenland
  it('returns Greenland', () => {
    expect(approximateLocation(72, -40)).toBe('Greenland')
  })

  it('does not mis-classify western Greenland as ocean (lon >= -73 fix)', () => {
    expect(approximateLocation(65, -50)).toBe('Greenland')
  })

  // North America — land checks
  it('returns North America for contiguous US', () => {
    expect(approximateLocation(40, -100)).toBe('North America') // Kansas
    expect(approximateLocation(35, -80)).toBe('North America')  // Carolinas
  })

  it('returns North America for Alaska (separate band check)', () => {
    expect(approximateLocation(64, -150)).toBe('North America') // Interior Alaska — not Bering Sea
    expect(approximateLocation(55, -160)).toBe('North America') // SW Alaska
  })

  it('returns North America for northern Canada above lat 72 (cap fix)', () => {
    expect(approximateLocation(80, -90)).toBe('North America')  // Ellesmere Island
    expect(approximateLocation(78, -95)).toBe('North America')  // Nunavut
  })

  // The key regression: open Pacific must NOT be North America
  it('returns North Pacific Ocean for lat=35 lon=-140 (was incorrectly North America)', () => {
    expect(approximateLocation(35, -140)).toBe('North Pacific Ocean')
  })

  it('returns North Pacific Ocean for points west of -130 below Alaska latitude', () => {
    expect(approximateLocation(45, -145)).toBe('North Pacific Ocean')
  })

  // Other land masses
  it('returns Europe', () => {
    expect(approximateLocation(51, 0)).toBe('Europe')   // London
    expect(approximateLocation(48, 2)).toBe('Europe')   // Paris
  })

  it('returns Africa', () => {
    expect(approximateLocation(0, 20)).toBe('Africa')
  })

  it('returns Australia', () => {
    expect(approximateLocation(-25, 135)).toBe('Australia')
  })

  // Open ocean catch-alls
  it('returns South Pacific Ocean for southern latitudes west of -75', () => {
    expect(approximateLocation(-30, -100)).toBe('South Pacific Ocean')
  })

  it('returns North Atlantic Ocean', () => {
    expect(approximateLocation(40, -40)).toBe('North Atlantic Ocean')
  })

  it('returns Indian Ocean', () => {
    expect(approximateLocation(-10, 70)).toBe('Indian Ocean')
  })
})

// ============================================
// getAuroraColor + getAuroraMarkerRadius
// ============================================
describe('getAuroraColor', () => {
  it('returns quiet color (gray) for prob < 15', () => {
    expect(getAuroraColor(0)).toBe('#64748b')
    expect(getAuroraColor(14)).toBe('#64748b')
  })

  it('returns low color (amber) for prob 15–34', () => {
    expect(getAuroraColor(15)).toBe('#eab308')
    expect(getAuroraColor(34)).toBe('#eab308')
  })

  it('returns moderate color (green) for prob 35–59', () => {
    expect(getAuroraColor(35)).toBe('#22c55e')
    expect(getAuroraColor(59)).toBe('#22c55e')
  })

  it('returns high color (violet) for prob >= 60', () => {
    expect(getAuroraColor(60)).toBe('#a78bfa')
    expect(getAuroraColor(99)).toBe('#a78bfa')
  })
})

describe('getAuroraMarkerRadius', () => {
  it('returns 3 for prob < 15', () => {
    expect(getAuroraMarkerRadius(0)).toBe(3)
    expect(getAuroraMarkerRadius(14)).toBe(3)
  })

  it('returns 3.5 for prob 15–34', () => {
    expect(getAuroraMarkerRadius(15)).toBe(3.5)
    expect(getAuroraMarkerRadius(34)).toBe(3.5)
  })

  it('returns 4.5 for prob >= 35', () => {
    expect(getAuroraMarkerRadius(35)).toBe(4.5)
    expect(getAuroraMarkerRadius(99)).toBe(4.5)
  })
})

// ============================================
// getKpTier
// ============================================
describe('getKpTier', () => {
  it('returns quiet for kp < 4', () => {
    expect(getKpTier(0)).toBe('quiet')
    expect(getKpTier(3.9)).toBe('quiet')
  })

  it('returns moderate for kp 4–4.9', () => {
    expect(getKpTier(4)).toBe('moderate')
    expect(getKpTier(4.9)).toBe('moderate')
  })

  it('returns active for kp 5–5.9', () => {
    expect(getKpTier(5)).toBe('active')
    expect(getKpTier(5.9)).toBe('active')
  })

  it('returns storm for kp >= 6', () => {
    expect(getKpTier(6)).toBe('storm')
    expect(getKpTier(9)).toBe('storm')
  })
})

// ============================================
// getProbTier
// ============================================
describe('getProbTier', () => {
  it('returns quiet for prob < 15', () => {
    expect(getProbTier(0)).toBe('quiet')
    expect(getProbTier(14)).toBe('quiet')
  })

  it('returns low for prob 15–34', () => {
    expect(getProbTier(15)).toBe('low')
    expect(getProbTier(34)).toBe('low')
  })

  it('returns moderate for prob 35–59', () => {
    expect(getProbTier(35)).toBe('moderate')
    expect(getProbTier(59)).toBe('moderate')
  })

  it('returns high for prob >= 60', () => {
    expect(getProbTier(60)).toBe('high')
    expect(getProbTier(100)).toBe('high')
  })
})

// ============================================
// cloudCoverColor
// ============================================
describe('cloudCoverColor', () => {
  it('returns green for pct < 30', () => {
    expect(cloudCoverColor(0)).toBe('#22c55e')
    expect(cloudCoverColor(29)).toBe('#22c55e')
  })

  it('returns amber for pct 30–59', () => {
    expect(cloudCoverColor(30)).toBe('#eab308')
    expect(cloudCoverColor(59)).toBe('#eab308')
  })

  it('returns slate for pct >= 60', () => {
    expect(cloudCoverColor(60)).toBe('#94a3b8')
    expect(cloudCoverColor(100)).toBe('#94a3b8')
  })
})

// ============================================
// getTonightOutlook — additional tier paths
// ============================================
describe('getTonightOutlook — additional tier paths', () => {
  const noCmes: CmeSummary[] = []
  const noFlare: XrayFlare | null = null

  // Excellent — three distinct sub-conditions
  it('Excellent via kp=6 + strong southward Bz (bz <= -10)', () => {
    const result = getTonightOutlook(6, -11, 5, noCmes, noFlare)
    expect(result.status).toBe('Excellent')
  })

  it('Excellent via kp=6 + high OVATION prob (>= 20)', () => {
    const result = getTonightOutlook(6, -3, 22, noCmes, noFlare)
    expect(result.status).toBe('Excellent')
  })

  it('Excellent via kp=5 + very high speed (> 700) + southward Bz', () => {
    const result = getTonightOutlook(5, -6, 5, noCmes, noFlare, 750)
    expect(result.status).toBe('Excellent')
  })

  it('Good via kp=4 + southward Bz alone (no high speed, no high prob)', () => {
    const result = getTonightOutlook(4, -6, 5, noCmes, noFlare)
    expect(result.status).toBe('Good')
  })

  it('Good via high OVATION prob alone (kp=2, bz neutral)', () => {
    // highProb (>= 20) triggers Good even without elevated Kp
    const result = getTonightOutlook(2, -3, 22, noCmes, noFlare)
    expect(result.status).toBe('Good')
  })

  it('Low via significant M-class flare with no other activity', () => {
    const mFlare: XrayFlare = { max_class: 'M2.5', begin_time: '2026-06-05T08:00Z' } as XrayFlare
    const result = getTonightOutlook(2, -3, 5, noCmes, mFlare)
    expect(result.status).toBe('Low')
  })

  it('Quiet for truly calm conditions (kp=1, bz neutral, low prob)', () => {
    const result = getTonightOutlook(1, -2, 5, noCmes, noFlare)
    expect(result.status).toBe('Quiet')
    expect(result.accentColor).toBe('#64748b')
  })

  it('reasons array is always capped at 2 entries', () => {
    // Conditions that would produce 3+ reasons: strong Bz + high prob + high speed
    const result = getTonightOutlook(6, -12, 25, noCmes, noFlare, 750)
    expect(result.reasons.length).toBeLessThanOrEqual(2)
  })

  it('adds Kp reason when kp >= 4 and reasons has room', () => {
    // kp=4, no bz, no prob boost — only the Kp reason fires
    const result = getTonightOutlook(4, -3, 5, noCmes, noFlare)
    expect(result.reasons.some(r => r.includes('Kp'))).toBe(true)
  })

  it('adds flare reason when kp < 4 and conditions allow room', () => {
    const xFlare: XrayFlare = { max_class: 'X1.0', begin_time: '2026-06-05T08:00Z' } as XrayFlare
    // kp=2.5 → Low tier; flare should contribute a reason
    const result = getTonightOutlook(2.5, -2, 5, noCmes, xFlare)
    expect(result.status).toBe('Low')
    expect(result.reasons.some(r => r.toLowerCase().includes('flare'))).toBe(true)
  })
})

// ============================================
// getAuroraRiskLevel — boundary conditions
// ============================================
describe('getMichiganRiskLevel — boundary conditions', () => {
  it('returns High when prob >= 25 regardless of kp', () => {
    expect(getAuroraRiskLevel(3, 25, -3)).toBe('High')
    expect(getAuroraRiskLevel(2, 30, -2)).toBe('High')
  })

  it('returns High when bz is exactly -8 (b <= -8 boundary)', () => {
    expect(getAuroraRiskLevel(3, 5, -8)).toBe('High')
  })

  it('returns Moderate when bz is exactly -5 (b <= -5, not <= -8)', () => {
    expect(getAuroraRiskLevel(3, 5, -5)).toBe('Moderate')
  })

  it('returns Moderate when prob is exactly 15 (>= 15 threshold)', () => {
    expect(getAuroraRiskLevel(2, 15, -2)).toBe('Moderate')
  })

  it('returns Quiet when bz and prob are null and kp < 4', () => {
    expect(getAuroraRiskLevel(3, null, null)).toBe('Quiet')
    expect(getAuroraRiskLevel(2, null, null)).toBe('Quiet')
  })
})

// ============================================
// approximateLocation — additional regions
// ============================================
describe('approximateLocation — additional land masses', () => {
  it('returns South America', () => {
    expect(approximateLocation(-20, -60)).toBe('South America') // Brazil interior
    expect(approximateLocation(0, -55)).toBe('South America')  // Amazonia
  })

  it('returns Central America', () => {
    // Must use lon < -88 or lat < 10 to avoid the Caribbean Sea bbox (lat≥10, lon≥-88)
    expect(approximateLocation(13, -90)).toBe('Central America') // Guatemala
    expect(approximateLocation(8, -80)).toBe('Central America')  // Panama lat < 10
  })

  it('returns Russia / N. Asia', () => {
    expect(approximateLocation(60, 80)).toBe('Russia / N. Asia')  // W. Siberia
    expect(approximateLocation(55, 60)).toBe('Russia / N. Asia')  // Urals
  })

  it('returns East Asia', () => {
    expect(approximateLocation(35, 120)).toBe('East Asia') // Eastern China
    expect(approximateLocation(37, 140)).toBe('East Asia') // Japan area
  })

  it('returns SE Asia', () => {
    expect(approximateLocation(10, 110)).toBe('SE Asia') // Vietnam/Cambodia
    expect(approximateLocation(3, 103)).toBe('SE Asia')  // Singapore area
  })

  it('returns Middle East', () => {
    // lon must be > 52 to escape Africa's bbox (lon -18..52); also avoid Persian Gulf (lat 22-30, lon 47-57)
    expect(approximateLocation(35, 55)).toBe('Middle East') // Iran/central Arabia, lat > 30 avoids Persian Gulf
  })

  it('returns South Asia', () => {
    expect(approximateLocation(25, 75)).toBe('South Asia') // India
    expect(approximateLocation(12, 80)).toBe('South Asia') // SE India
  })

  it('returns South Atlantic Ocean', () => {
    // lon=-20 is between -75 and 25, lat < 0 → South Atlantic
    expect(approximateLocation(-15, -20)).toBe('South Atlantic Ocean')
  })

  it('returns empty string only for truly unmapped coordinates', () => {
    // The open-ocean catch-alls cover everything, so "" should never occur
    // in practice. Verify a few extreme points resolve to something.
    expect(approximateLocation(0, 180)).not.toBe('')
    expect(approximateLocation(-45, 0)).not.toBe('')
  })
})

// ============================================
// createGoogleCalendarLink
// ============================================
describe('createGoogleCalendarLink', () => {
  const quadrantids = MAJOR_METEOR_SHOWERS.find((s) => s.name === 'Quadrantids')!
  const perseids    = MAJOR_METEOR_SHOWERS.find((s) => s.name === 'Perseids')!

  it('returns a Google Calendar render URL', () => {
    const url = createGoogleCalendarLink(quadrantids, new Date(2026, 0, 3))
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render/)
  })

  it('text param contains the URL-encoded shower name', () => {
    const url = createGoogleCalendarLink(quadrantids, new Date(2026, 0, 3))
    // "Meteor Shower Peak: Quadrantids" URL-encoded
    expect(url).toContain('text=Meteor%20Shower%20Peak%3A%20Quadrantids')
  })

  it('start date is formatted as YYYYMMDD', () => {
    const url = createGoogleCalendarLink(quadrantids, new Date(2026, 0, 3)) // Jan 3
    expect(url).toContain('dates=20260103/')
  })

  it('single-day shower: end date is peak + 1 day', () => {
    // Quadrantids has no peakEndDay → span = 1 → end = Jan 4
    const url = createGoogleCalendarLink(quadrantids, new Date(2026, 0, 3))
    expect(url).toContain('/20260104')
  })

  it('multi-day shower: end date is peak + 2 days', () => {
    // Perseids has peakEndDay = 13 → span = 2 → end = Aug 14
    const url = createGoogleCalendarLink(perseids, new Date(2026, 7, 12))
    expect(url).toContain('dates=20260812/20260814')
  })
})

// ============================================
// getAuroraGuidance — delegates base message to getTonightOutlook
// ============================================
describe('getAuroraGuidance — delegates base message to getTonightOutlook', () => {
  it('Excellent conditions: guidance starts with getTonightOutlook message', () => {
    const kp = 7, bz = -8, prob = 25
    const guidance = getAuroraGuidance(kp, prob, bz)
    const outlook = getTonightOutlook(kp, bz, prob, [], null)
    expect(outlook.status).toBe('Excellent')
    expect(guidance.startsWith(outlook.message)).toBe(true)
  })

  it('Good conditions: guidance starts with getTonightOutlook message', () => {
    const kp = 5, bz = -3, prob = 10
    const guidance = getAuroraGuidance(kp, prob, bz)
    const outlook = getTonightOutlook(kp, bz, prob, [], null)
    expect(outlook.status).toBe('Good')
    expect(guidance.startsWith(outlook.message)).toBe(true)
  })

  it('Moderate conditions: guidance starts with getTonightOutlook message', () => {
    const kp = 4, bz = -2, prob = 5
    const guidance = getAuroraGuidance(kp, prob, bz)
    const outlook = getTonightOutlook(kp, bz, prob, [], null)
    expect(outlook.status).toBe('Moderate')
    expect(guidance.startsWith(outlook.message)).toBe(true)
  })

  it('Low conditions: guidance starts with getTonightOutlook message', () => {
    const kp = 3, bz = -2, prob = 5
    const guidance = getAuroraGuidance(kp, prob, bz)
    const outlook = getTonightOutlook(kp, bz, prob, [], null)
    expect(outlook.status).toBe('Low')
    expect(guidance.startsWith(outlook.message)).toBe(true)
  })

  it('Quiet conditions: guidance starts with getTonightOutlook message', () => {
    const kp = 1, bz = -2, prob = 5
    const guidance = getAuroraGuidance(kp, prob, bz)
    const outlook = getTonightOutlook(kp, bz, prob, [], null)
    expect(outlook.status).toBe('Quiet')
    expect(guidance.startsWith(outlook.message)).toBe(true)
  })

  it('forecastPeakKp elevates effectiveKp passed to getTonightOutlook', () => {
    // kp=3 alone → Low; forecastPeakKp=7 → effectiveKp=7 → Excellent (kp>=7 unconditional)
    const guidance = getAuroraGuidance(3, 5, -2, null, 7)
    const elevated = getTonightOutlook(7, -2, 5, [], null)
    expect(elevated.status).toBe('Excellent')
    expect(guidance.startsWith(elevated.message)).toBe(true)
    expect(guidance).toContain('Kp 7.0 forecast as tonight')
  })
})
