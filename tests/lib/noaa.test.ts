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
  getCityAuroraProbabilities,
  getLocationAuroraProb,
  getNearestCityName,
  formatFireballDate,
  approximateLocation,
  assessEarthImpact,
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

  it('returns Moderate when kp >= 3 and solar wind speed > 600 km/s', () => {
    expect(getMichiganRiskLevel(3, 5, -3, 650)).toBe('Moderate')
    expect(getMichiganRiskLevel(3, 5, -3, 601)).toBe('Moderate')
  })

  it('returns High when kp >= 4 and solar wind speed > 600 km/s', () => {
    expect(getMichiganRiskLevel(4, 5, -3, 650)).toBe('High')
  })

  it('does not elevate risk for speed <= 600 km/s', () => {
    expect(getMichiganRiskLevel(3, 5, -3, 600)).toBe('Quiet')
    expect(getMichiganRiskLevel(3, 5, -3, 500)).toBe('Quiet')
  })

  it('returns Quiet when solarWindSpeed is null (no elevation)', () => {
    expect(getMichiganRiskLevel(3, 5, -3, null)).toBe('Quiet')
    expect(getMichiganRiskLevel(3, 5, -3, undefined)).toBe('Quiet')
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

  it('formatMeteorPeak formats date range correctly', () => {
    // This is a simplified test - adjust if your MAJOR_METEOR_SHOWERS data changes
    const mockShower: MeteorShower = { name: 'Perseids', peakMonth: 8, peakDay: 12, peakEndDay: 13, activityLevel: 'High', description: 'One of the best annual meteor showers.' }
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
  it('returns unified 4-tier palette (quiet/moderate/active/storm)', () => {
    // quiet  (<10%)    → green
    expect(getAuroraColor(3)).toBe('#22c55e')
    expect(getAuroraColor(9)).toBe('#22c55e')
    // moderate (10–29%) → amber
    expect(getAuroraColor(10)).toBe('#eab308')
    expect(getAuroraColor(20)).toBe('#eab308')
    // active (30–59%)  → orange
    expect(getAuroraColor(30)).toBe('#f97316')
    expect(getAuroraColor(50)).toBe('#f97316')
    // storm  (≥60%)    → violet
    expect(getAuroraColor(60)).toBe('#a78bfa')
    expect(getAuroraColor(100)).toBe('#a78bfa')
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
    expect(result).toContain('northern United States')
  })

  it('returns northern-tier text for kp 5-6', () => {
    const result = getMichiganGuidance(5, 10, -3)
    expect(result).toContain('northern-tier')
    expect(result).toContain('Great Lakes')
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

  it('elevates to northern-tier text when kp >= 3 and speed > 600', () => {
    const result = getMichiganGuidance(3, 5, -2, 650)
    expect(result).toContain('northern-tier')
  })

  it('appends solar wind note when speed > 600 and Bz not favorable', () => {
    const result = getMichiganGuidance(2, 5, -2, 650)
    expect(result).toContain('solar wind speed')
  })

  it('Bz note takes priority over solar wind note', () => {
    const result = getMichiganGuidance(2, 5, -6, 650)
    expect(result).toContain('southward Bz')
    expect(result).not.toContain('solar wind speed')
  })

  it('does not append solar wind note when speed <= 600', () => {
    const result = getMichiganGuidance(2, 5, -2, 600)
    expect(result).not.toContain('solar wind speed')
  })

  it('does not append solar wind note when solarWindSpeed is null', () => {
    const result = getMichiganGuidance(2, 5, -2, null)
    expect(result).not.toContain('solar wind speed')
  })
})

// ============================================
// getCityAuroraProbabilities
// ============================================
describe('getCityAuroraProbabilities', () => {
  it('returns 5 cities', () => {
    const result = getCityAuroraProbabilities(null, null, null)
    expect(result).toHaveLength(5)
    expect(result[0].name).toBe('Duluth')
    expect(result[4].name).toBe('Presque Isle')
  })

  it('returns 0 for all cities when no data and no kp', () => {
    const result = getCityAuroraProbabilities(null, null, null)
    result.forEach(c => expect(c.prob).toBe(0))
  })

  it('uses Kp-based fallback when ovation is null', () => {
    // Kp 6 should give Duluth (47°N) a meaningful probability
    const result = getCityAuroraProbabilities(null, 6, null)
    expect(result[0].state).toBe('MN')
    expect(result[0].prob).toBeGreaterThan(0)
    // All 5 cities are at similar high latitudes; just verify all have non-negative probs
    result.forEach(c => expect(c.prob).toBeGreaterThanOrEqual(0))
  })

  it('picks the nearest OVATION grid point for each city', () => {
    // Place a high-probability point near Duluth (~47°N, -92°W → rawLon 268)
    // and a lower point near Billings (~46°N, -109°W → rawLon 251)
    const ovation: OvationResponse = {
      coordinates: [
        [268, 47, 70],   // near Duluth
        [251, 46, 20],   // near Billings
      ],
    }
    const result = getCityAuroraProbabilities(ovation, 5, null)
    expect(result[0].prob).toBe(70)   // Duluth
    expect(result[3].prob).toBe(20)   // Billings
  })

  it('applies Bz boost when bz <= -5', () => {
    const base = getCityAuroraProbabilities(null, 5, null)
    const boosted = getCityAuroraProbabilities(null, 5, -8)
    // bz=-8: abs(-8+5)*1.5 = 4.5 → round to 5, so boosted >= base
    boosted.forEach((c, i) => expect(c.prob).toBeGreaterThanOrEqual(base[i].prob))
  })

  it('clamps probability to 0–99', () => {
    // Very high Kp + very negative Bz should not exceed 99
    const result = getCityAuroraProbabilities(null, 9, -30)
    result.forEach(c => {
      expect(c.prob).toBeGreaterThanOrEqual(0)
      expect(c.prob).toBeLessThanOrEqual(99)
    })
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
    expect(getLocationAuroraProb(44.0, -85.0, null, null, null)).toBe(0)
  })

  it('uses Kp-based fallback when OVATION is null', () => {
    // High Kp should give a meaningful probability at a northern latitude
    const prob = getLocationAuroraProb(46.0, -87.0, null, 7, null)
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
    const prob = getLocationAuroraProb(44.0, -85.0, ovation, 5, null)
    expect(prob).toBe(60)
  })

  it('applies Bz boost for strongly southward Bz', () => {
    const base = getLocationAuroraProb(44.0, -85.0, null, 5, null)
    const boosted = getLocationAuroraProb(44.0, -85.0, null, 5, -8)
    expect(boosted).toBeGreaterThan(base)
  })

  it('clamps result to 0–99', () => {
    const prob = getLocationAuroraProb(60.0, -100.0, null, 9, -30)
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
  it('returns Mediterranean Sea', () => {
    expect(approximateLocation(38, 15)).toBe('Mediterranean Sea')
  })

  it('returns Gulf of Mexico', () => {
    expect(approximateLocation(25, -90)).toBe('Gulf of Mexico')
  })

  it('returns Caribbean Sea', () => {
    expect(approximateLocation(15, -75)).toBe('Caribbean Sea')
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
    expect(approximateLocation(64, -150)).toBe('North America') // Interior Alaska
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
