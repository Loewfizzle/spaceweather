import { describe, it, expect } from 'vitest'
import {
  getMichiganRiskLevel,
  getMichiganGuidance,
  getTonightOutlook,
  currentSunspotNumber,
  getNextMeteorShower,
  formatMeteorPeak,
  latest,
  filterOvationCoordinates,
  maxOvationNorthAmerica,
  getAuroraColor,
  parseRecentCmes,
} from '../../lib/noaa'
import type { Alert, SolarRegion, CmeSummary, XrayFlare, OvationResponse, MeteorShower } from '../../lib/api/schemas'

// ============================================
// getMichiganRiskLevel
// ============================================
describe('getMichiganRiskLevel', () => {
  it('returns Quiet when kp is null', () => {
    expect(getMichiganRiskLevel(null, 10, -3)).toBe('Quiet')
  })

  it('returns High for strong conditions (kp >= 5 or high prob or strong negative Bz)', () => {
    expect(getMichiganRiskLevel(5, 5, -3)).toBe('High')
    expect(getMichiganRiskLevel(4, 30, -3)).toBe('High')
    expect(getMichiganRiskLevel(3, 5, -9)).toBe('High')
  })

  it('returns Moderate for medium conditions', () => {
    expect(getMichiganRiskLevel(4, 5, -3)).toBe('Moderate')
    expect(getMichiganRiskLevel(3, 20, -3)).toBe('Moderate')
    expect(getMichiganRiskLevel(3, 5, -6)).toBe('Moderate')
  })

  it('returns Quiet for weak conditions', () => {
    expect(getMichiganRiskLevel(2, 5, -2)).toBe('Quiet')
    expect(getMichiganRiskLevel(3, 5, -3)).toBe('Quiet')
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
    expect(result.accentColor).toBe('#22c55e')
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

  it('formatMeteorPeak formats date range correctly', () => {
    // This is a simplified test - adjust if your MAJOR_METEOR_SHOWERS data changes
    const mockShower: MeteorShower = { name: 'Perseids', peakMonth: 8, peakDay: 12, peakEndDay: 13, activityLevel: 'High' }
    const date = new Date(2026, 7, 12)
    const formatted = formatMeteorPeak(date, mockShower)
    expect(formatted).toContain('August 12')
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
    const max = maxOvationNorthAmerica(mockOvation)
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
})

describe('getAuroraColor', () => {
  it('returns correct color scale', () => {
    expect(getAuroraColor(3)).toBe('#166534')
    expect(getAuroraColor(20)).toBe('#eab308')
    expect(getAuroraColor(60)).toBe('#a78bfa')
  })
})

// ============================================
// getMichiganGuidance
// ============================================
describe('getMichiganGuidance', () => {
  it('returns loading text when kp is null', () => {
    expect(getMichiganGuidance(null, null, null)).toBe('Data loading...')
  })

  it('returns high-confidence text for kp >= 7', () => {
    const result = getMichiganGuidance(7, 10, -3)
    expect(result).toContain('Lower Peninsula')
  })

  it('returns UP-focused text for kp 5-6', () => {
    const result = getMichiganGuidance(5, 10, -3)
    expect(result).toContain('Upper Peninsula')
    expect(result).toContain('northern Lower')
  })

  it('appends Bz boost note when bz <= -5', () => {
    const result = getMichiganGuidance(3, 5, -6)
    expect(result).toContain('southward Bz')
  })

  it('appends OVATION note when maxProb >= 20 and bz not favorable', () => {
    const result = getMichiganGuidance(3, 25, -2)
    expect(result).toContain('probabilities across North America')
  })

  it('Bz note takes priority over OVATION note', () => {
    const result = getMichiganGuidance(3, 25, -8)
    expect(result).toContain('southward Bz')
    expect(result).not.toContain('probabilities across North America')
  })
})

describe('parseRecentCmes', () => {
  it('extracts CMEs from alerts', () => {
    const alerts: Alert[] = [
      { message: 'CME alert: 1200 km/s Earth-directed halo', issue_datetime: '2026-06-05T08:00Z' } as Alert,
    ]
    const cmes = parseRecentCmes(alerts)
    expect(cmes.length).toBe(1)
    expect(cmes[0].speed).toBe(1200)
  })
})
