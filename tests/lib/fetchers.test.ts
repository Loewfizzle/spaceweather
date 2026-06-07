import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  parseStringArrayRows,
  fetchFireballs,
  fetchOvation,
  fetchKpIndex,
  fetchKpForecast,
  fetchPlasma,
  fetchMag,
  fetchXrayFlaresLatest,
  fetchAlerts,
  fetchSolarRegions,
} from '../../lib/api/fetchers'

vi.mock('@/lib/utils/retry', () => ({
  logDataError: vi.fn(),
  recordDataSuccess: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

// ============================================
// parseStringArrayRows
// ============================================
describe('parseStringArrayRows', () => {
  const HEADERS = ['time_tag', 'speed', 'density', 'temperature']

  it('converts header + data rows to typed objects', () => {
    const raw = [
      HEADERS,
      ['2024-01-15 21:30:45', '450.2', '5.3', '100000'],
    ]
    const result = parseStringArrayRows(raw)
    expect(result).toHaveLength(1)
    expect(result[0].time_tag).toBe('2024-01-15 21:30:45')
    expect(result[0].speed).toBe(450.2)
    expect(result[0].density).toBe(5.3)
    expect(result[0].temperature).toBe(100000)
  })

  it('returns null for malformed numeric cells (NaN, empty string)', () => {
    const raw = [
      HEADERS,
      ['2024-01-15 21:29:45', 'bad', '3.1', ''],
    ]
    const result = parseStringArrayRows(raw)
    expect(result[0].speed).toBeNull()       // 'bad' → NaN → null
    expect(result[0].temperature).toBeNull() // '' → NaN → null
    expect(result[0].density).toBe(3.1)      // valid numeric string
  })

  it('preserves time_tag as string and does not coerce it to a number', () => {
    const raw = [HEADERS, ['2024-06-01 00:00:00', '400', '4', '80000']]
    const result = parseStringArrayRows(raw)
    expect(typeof result[0].time_tag).toBe('string')
  })

  it('returns empty array when input has fewer than 2 rows (no data)', () => {
    expect(parseStringArrayRows([HEADERS])).toEqual([])
    expect(parseStringArrayRows([])).toEqual([])
  })
})

// ============================================
// fetchFireballs — tabular normalization
// ============================================

const NASA_FIELDS = ['date', 'energy', 'impact-e', 'lat', 'lat-dir', 'lon', 'lon-dir', 'alt', 'vel']

const NASA_FIXTURE = {
  signature: { source: 'NASA/JPL Fireball Data API', version: '1.0' },
  count: '4',
  fields: NASA_FIELDS,
  data: [
    // Normal row: N lat, W lon → signed coordinates
    ['2024-01-15 21:30:45', '1.2e+00', '4.5e-01', '36.1', 'N', '86.8', 'W', '45.2', '12.3'],
    // E longitude → positive lon
    ['2024-01-10 15:20:00', null, '2.1e-02', '51.2', 'N', '10.5', 'E', null, '8.7'],
    // No location data
    ['2024-01-08 03:15:00', null, null, null, null, null, null, null, null],
    // Empty date — should be filtered out
    ['', null, null, null, null, null, null, null, null],
  ],
}

function stubFetch(data: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  }))
}

describe('fetchFireballs', () => {
  it('drops rows with an empty date', async () => {
    stubFetch(NASA_FIXTURE)
    const result = await fetchFireballs(4)
    expect(result).toHaveLength(3) // 4 rows minus the one with empty date
  })

  it('applies W direction as negative longitude', async () => {
    stubFetch(NASA_FIXTURE)
    const result = await fetchFireballs(4)
    expect(result[0].lat).toBeCloseTo(36.1)
    expect(result[0].lon).toBeCloseTo(-86.8) // W → negative
  })

  it('applies E direction as positive longitude', async () => {
    stubFetch(NASA_FIXTURE)
    const result = await fetchFireballs(4)
    expect(result[1].lat).toBeCloseTo(51.2)
    expect(result[1].lon).toBeCloseTo(10.5) // E → positive
  })

  it('returns null lat/lon when location fields are absent', async () => {
    stubFetch(NASA_FIXTURE)
    const result = await fetchFireballs(4)
    expect(result[2].lat).toBeNull()
    expect(result[2].lon).toBeNull()
  })

  it('passes through energy and impactE as strings', async () => {
    stubFetch(NASA_FIXTURE)
    const result = await fetchFireballs(4)
    expect(result[0].impactE).toBe('4.5e-01')
    expect(result[1].impactE).toBe('2.1e-02')
    expect(result[2].impactE).toBeNull()
  })

  it('passes through alt and vel as strings', async () => {
    stubFetch(NASA_FIXTURE)
    const result = await fetchFireballs(4)
    expect(result[0].alt).toBe('45.2')
    expect(result[0].vel).toBe('12.3')
    expect(result[1].alt).toBeNull() // null in fixture
    expect(result[1].vel).toBe('8.7')
  })

  it('looks up fields by name, not position — reordered columns produce same output', async () => {
    // Swap lat and lon columns to verify column-index lookup is by name
    const reorderedFields = ['date', 'lon', 'lon-dir', 'lat', 'lat-dir', 'energy', 'impact-e', 'alt', 'vel']
    const reorderedData = [
      ['2024-01-15 21:30:45', '86.8', 'W', '36.1', 'N', '1.2e+00', '4.5e-01', '45.2', '12.3'],
    ]
    stubFetch({ fields: reorderedFields, data: reorderedData })
    const result = await fetchFireballs(1)
    expect(result[0].lat).toBeCloseTo(36.1)
    expect(result[0].lon).toBeCloseTo(-86.8)
  })

  it('returns null for a field that is absent from the fields list', async () => {
    // impact-e is missing from the fields array — impactE should be null
    const sparseFields = ['date', 'lat', 'lat-dir', 'lon', 'lon-dir', 'energy', 'alt', 'vel']
    const sparseData   = [['2024-01-15 21:30:45', '36.1', 'N', '86.8', 'W', '1.2e+00', '45.2', '12.3']]
    stubFetch({ fields: sparseFields, data: sparseData })
    const result = await fetchFireballs(1)
    expect(result[0].impactE).toBeNull() // field not in fields list → col() returns null
  })
})

// ============================================
// fetchKpIndex
// ============================================
describe('fetchKpIndex', () => {
  it('returns parsed Kp entries on success', async () => {
    stubFetch([{ time_tag: '2024-01-15 12:00:00', Kp: 3.0, a_running: 10, station_count: 12 }])
    const result = await fetchKpIndex()
    expect(result).toHaveLength(1)
    expect(result[0].Kp).toBe(3.0)
    expect(result[0].time_tag).toBe('2024-01-15 12:00:00')
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(fetchKpIndex()).rejects.toThrow()
  })
})

// ============================================
// fetchKpForecast
// ============================================
describe('fetchKpForecast', () => {
  it('returns parsed forecast entries on success', async () => {
    stubFetch([{ time_tag: '2024-01-16 00:00:00', kp: 4.0, observed: 'predicted', noaa_scale: 'G0' }])
    const result = await fetchKpForecast()
    expect(result).toHaveLength(1)
    expect(result[0].kp).toBe(4.0)
  })

  it('returns empty array when upstream returns invalid shape (safeParse failure)', async () => {
    stubFetch('not an array')
    const result = await fetchKpForecast()
    expect(result).toEqual([])
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    await expect(fetchKpForecast()).rejects.toThrow()
  })
})

// ============================================
// fetchOvation
// ============================================
describe('fetchOvation', () => {
  it('returns parsed OVATION data on success', async () => {
    stubFetch({ 'Forecast Time': '2024-01-15T12:00:00Z', coordinates: [[240, 55, 18]] })
    const result = await fetchOvation()
    expect(result.coordinates).toHaveLength(1)
  })

  it('returns { coordinates: [] } fallback when upstream returns invalid shape', async () => {
    stubFetch(null) // null fails z.object() safeParse
    const result = await fetchOvation()
    expect(result).toEqual({ coordinates: [] })
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))
    await expect(fetchOvation()).rejects.toThrow()
  })
})

// ============================================
// fetchPlasma
// ============================================
describe('fetchPlasma', () => {
  it('returns parsed plasma entries on success', async () => {
    stubFetch([
      ['time_tag', 'density', 'speed', 'temperature'],
      ['2024-01-15 12:00:00', '5.2', '420.1', '90000'],
    ])
    const result = await fetchPlasma()
    expect(result).toHaveLength(1)
    expect(result[0].speed).toBe(420.1)
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    await expect(fetchPlasma()).rejects.toThrow()
  })
})

// ============================================
// fetchMag
// ============================================
describe('fetchMag', () => {
  it('returns parsed mag entries on success', async () => {
    stubFetch([
      ['time_tag', 'bx_gsm', 'by_gsm', 'bz_gsm', 'lon_gsm', 'lat_gsm', 'bt'],
      ['2024-01-15 12:00:00', '1.2', '-3.4', '-5.6', '45.0', '12.0', '6.7'],
    ])
    const result = await fetchMag()
    expect(result).toHaveLength(1)
    expect(result[0].bz_gsm).toBe(-5.6)
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    await expect(fetchMag()).rejects.toThrow()
  })
})

// ============================================
// fetchXrayFlaresLatest
// ============================================
describe('fetchXrayFlaresLatest', () => {
  it('returns parsed flare entries on success', async () => {
    stubFetch([{ time_tag: '2024-01-15T12:00:00Z', satellite: 18, max_class: 'M2.5' }])
    const result = await fetchXrayFlaresLatest()
    expect(result).toHaveLength(1)
    expect(result[0].max_class).toBe('M2.5')
  })

  it('returns empty array when upstream returns invalid shape', async () => {
    stubFetch({ not: 'an array' })
    const result = await fetchXrayFlaresLatest()
    expect(result).toEqual([])
  })
})

// ============================================
// fetchAlerts
// ============================================
describe('fetchAlerts', () => {
  it('returns parsed alerts on success', async () => {
    stubFetch([{ product_id: 'WATA07', issue_datetime: '2024-01-15 12:00:00', message: 'Geomagnetic storm watch' }])
    const result = await fetchAlerts()
    expect(result).toHaveLength(1)
    expect(result[0].product_id).toBe('WATA07')
  })

  it('returns empty array when upstream returns invalid shape', async () => {
    stubFetch('bad')
    const result = await fetchAlerts()
    expect(result).toEqual([])
  })
})

// ============================================
// fetchSolarRegions
// ============================================
describe('fetchSolarRegions', () => {
  it('returns parsed solar regions on success', async () => {
    stubFetch([{ observed_date: '2024-01-15', region: 3800, number_spots: 42 }])
    const result = await fetchSolarRegions()
    expect(result).toHaveLength(1)
    expect(result[0].number_spots).toBe(42)
  })

  it('returns empty array when upstream returns invalid shape', async () => {
    stubFetch(null)
    const result = await fetchSolarRegions()
    expect(result).toEqual([])
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    await expect(fetchSolarRegions()).rejects.toThrow()
  })
})
