import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/utils/retry', () => ({ logDataError: vi.fn() }));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function makeReq(base: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${base}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

// ============================================
// GET /api/geocode
// ============================================
describe('GET /api/geocode', () => {
  afterEach(() => vi.resetAllMocks());

  async function geocode(params: Record<string, string> = {}) {
    const { GET } = await import('../../app/api/geocode/route');
    return GET(makeReq('/api/geocode', params));
  }

  it('returns 400 when lat and lon are missing', async () => {
    const res = await geocode({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range lat (> 90)', async () => {
    const res = await geocode({ lat: '95', lon: '0' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range lat (< -90)', async () => {
    const res = await geocode({ lat: '-91', lon: '0' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range lon (> 180)', async () => {
    const res = await geocode({ lat: '45', lon: '200' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric lat', async () => {
    const res = await geocode({ lat: 'abc', lon: '0' });
    expect(res.status).toBe(400);
  });

  it('returns city and state for a US location', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: { city: 'Detroit', state: 'Michigan', country_code: 'us' } }),
    });
    const res = await geocode({ lat: '42.33', lon: '-83.04' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.location).toBe('Detroit, Michigan');
  });

  it('returns water body name when address contains a sea/ocean field', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: { sea: 'Lake Michigan' } }),
    });
    const res = await geocode({ lat: '43', lon: '-86' });
    const body = await res.json();
    expect(body.location).toBe('Lake Michigan');
  });

  it('returns city and country for non-US/CA locations', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: { city: 'London', country: 'United Kingdom', country_code: 'gb' } }),
    });
    const res = await geocode({ lat: '51.5', lon: '-0.1' });
    const body = await res.json();
    expect(body.location).toBe('London, United Kingdom');
  });

  it('returns null location when Nominatim returns an error field', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: 'Unable to geocode' }),
    });
    const res = await geocode({ lat: '0', lon: '0' });
    const body = await res.json();
    expect(body.location).toBeNull();
  });

  it('returns null location when Nominatim response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    const res = await geocode({ lat: '45', lon: '-80' });
    const body = await res.json();
    expect(body.location).toBeNull();
  });

  it('returns null location on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    const res = await geocode({ lat: '45', lon: '-80' });
    const body = await res.json();
    expect(body.location).toBeNull();
  });

  it('returns null location when address is missing from response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ type: 'FeatureCollection' }),
    });
    const res = await geocode({ lat: '45', lon: '-80' });
    const body = await res.json();
    expect(body.location).toBeNull();
  });

  it('uses "City, Province" format for Canadian addresses', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: { city: 'Toronto', state: 'Ontario', country_code: 'ca' } }),
    });
    const res = await geocode({ lat: '43.7', lon: '-79.4' });
    const body = await res.json();
    expect(body.location).toBe('Toronto, Ontario');
  });

  it('falls back to suburb when city/town/village/hamlet are absent', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: { suburb: 'Midtown', state: 'New York', country_code: 'us' } }),
    });
    const res = await geocode({ lat: '40.76', lon: '-73.98' });
    const body = await res.json();
    expect(body.location).toBe('Midtown, New York');
  });

  it('returns null location when address has no city and no water body', async () => {
    // Only non-city, non-water fields — buildLocationString returns null
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: { country: 'United States', postcode: '48101', country_code: 'us' } }),
    });
    const res = await geocode({ lat: '42', lon: '-83' });
    const body = await res.json();
    expect(body.location).toBeNull();
  });

  it('water body takes priority over a city in the same address', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: { bay: 'Chesapeake Bay', city: 'Annapolis', country_code: 'us' } }),
    });
    const res = await geocode({ lat: '38.9', lon: '-76.5' });
    const body = await res.json();
    expect(body.location).toBe('Chesapeake Bay');
  });
});

// ============================================
// GET /api/cloud-cover
// ============================================
describe('GET /api/cloud-cover', () => {
  afterEach(() => vi.resetAllMocks());

  async function cloudCover(params: Record<string, string> = {}) {
    const { GET } = await import('../../app/api/cloud-cover/route');
    return GET(makeReq('/api/cloud-cover', params));
  }

  it('returns 400 when lat and lon are missing', async () => {
    const res = await cloudCover({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range lat (> 90)', async () => {
    const res = await cloudCover({ lat: '95', lon: '0' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric lat', async () => {
    const res = await cloudCover({ lat: 'abc', lon: '0' });
    expect(res.status).toBe(400);
  });

  it('returns 200 with Cache-Control header on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ current: { cloud_cover: 45 } }),
    });
    const res = await cloudCover({ lat: '42.33', lon: '-83.04' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=300');
  });

  it('passes upstream JSON body through unchanged', async () => {
    const upstream = { current: { cloud_cover: 20 }, hourly: { cloud_cover: [10, 15] } };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => upstream });
    const res = await cloudCover({ lat: '42', lon: '-83' });
    const body = await res.json();
    expect(body).toEqual(upstream);
  });

  it('returns 502 when upstream returns non-ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    const res = await cloudCover({ lat: '42', lon: '-83' });
    expect(res.status).toBe(502);
  });

  it('returns 500 on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    const res = await cloudCover({ lat: '42', lon: '-83' });
    expect(res.status).toBe(500);
  });
});

// ============================================
// GET /api/fireballs
// ============================================
describe('GET /api/fireballs', () => {
  afterEach(() => vi.resetAllMocks());

  const validNasaPayload = {
    fields: ['date', 'lat', 'lon', 'alt', 'vel', 'energy', 'impact-e'],
    data: [['2024-08-12 21:30:45', '38.0', '-77.0', '35.2', '22.1', '1.2e10', '1.5']],
  };

  async function fireballs(params: Record<string, string> = {}) {
    const { GET } = await import('../../app/api/fireballs/route');
    return GET(makeReq('/api/fireballs', params));
  }

  it('returns 200 with validated payload on success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => validNasaPayload });
    const res = await fireballs();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fields).toBeDefined();
    expect(body.data).toBeDefined();
  });

  it('returns Cache-Control header on success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => validNasaPayload });
    const res = await fireballs();
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=300');
  });

  it('returns error status from NASA when upstream fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' });
    const res = await fireballs();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 500 on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    const res = await fireballs();
    expect(res.status).toBe(500);
  });

  it('uses default limit of 10 when no param given', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => validNasaPayload });
    await fireballs();
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('limit=10');
  });

  it('respects a valid custom limit', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => validNasaPayload });
    await fireballs({ limit: '25' });
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('limit=25');
  });

  it('clamps limit to 10 when the value exceeds 100', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => validNasaPayload });
    await fireballs({ limit: '999' });
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('limit=10');
  });

  it('clamps limit to 10 for non-numeric limit param', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => validNasaPayload });
    await fireballs({ limit: 'bad' });
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('limit=10');
  });
});

// ============================================
// GET /api/location-search
// ============================================
describe('GET /api/location-search', () => {
  afterEach(() => vi.resetAllMocks());

  async function locationSearch(params: Record<string, string> = {}) {
    const { GET } = await import('../../app/api/location-search/route');
    return GET(makeReq('/api/location-search', params));
  }

  function nominatimHit(overrides: {
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: Record<string, string>;
  } = {}) {
    return {
      lat: '45.0',
      lon: '-93.0',
      display_name: 'Minneapolis, Hennepin County, Minnesota, United States',
      address: {},
      ...overrides,
    };
  }

  function mockNominatim(results: unknown[]) {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => results });
  }

  it('returns empty results when q param is missing', async () => {
    const res = await locationSearch({});
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns empty results when q is a single character', async () => {
    const res = await locationSearch({ q: 'a' });
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns empty results when Nominatim responds with non-ok status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    const res = await locationSearch({ q: 'Chicago' });
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it('returns empty results when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    const res = await locationSearch({ q: 'Chicago' });
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it('formats US cities as "City, State"', async () => {
    mockNominatim([nominatimHit({ address: { city: 'Chicago', state: 'Illinois', country_code: 'us' } })]);
    const res = await locationSearch({ q: 'Chicago' });
    const body = await res.json();
    expect(body.results[0].label).toBe('Chicago, Illinois');
  });

  it('formats Canadian cities as "City, Province"', async () => {
    mockNominatim([nominatimHit({ address: { city: 'Toronto', state: 'Ontario', country_code: 'ca' } })]);
    const res = await locationSearch({ q: 'Toronto' });
    const body = await res.json();
    expect(body.results[0].label).toBe('Toronto, Ontario');
  });

  it('formats non-US/CA cities as "City, Country"', async () => {
    mockNominatim([nominatimHit({ address: { city: 'London', country: 'United Kingdom', country_code: 'gb' } })]);
    const res = await locationSearch({ q: 'London' });
    const body = await res.json();
    expect(body.results[0].label).toBe('London, United Kingdom');
  });

  it('returns just the city name when no country field is present', async () => {
    mockNominatim([nominatimHit({ address: { city: 'Nuuk', country_code: 'gl' } })]);
    const res = await locationSearch({ q: 'Nuuk' });
    const body = await res.json();
    expect(body.results[0].label).toBe('Nuuk');
  });

  it('falls back to town when city is absent', async () => {
    mockNominatim([nominatimHit({ address: { town: 'Stowe', state: 'Vermont', country_code: 'us' } })]);
    const res = await locationSearch({ q: 'Stowe' });
    const body = await res.json();
    expect(body.results[0].label).toBe('Stowe, Vermont');
  });

  it('falls back to village when city and town are absent', async () => {
    mockNominatim([nominatimHit({ address: { village: 'Woodstock', state: 'Vermont', country_code: 'us' } })]);
    const res = await locationSearch({ q: 'Woodstock' });
    const body = await res.json();
    expect(body.results[0].label).toBe('Woodstock, Vermont');
  });

  it('falls back to suburb when city/town/village/hamlet/municipality are absent', async () => {
    mockNominatim([nominatimHit({ address: { suburb: 'Midtown', state: 'New York', country_code: 'us' } })]);
    const res = await locationSearch({ q: 'Midtown' });
    const body = await res.json();
    expect(body.results[0].label).toBe('Midtown, New York');
  });

  it('formats a postcode query as "postcode, state, country"', async () => {
    mockNominatim([nominatimHit({
      display_name: '48101, Michigan, USA',
      address: { postcode: '48101', state: 'Michigan', country: 'United States' },
    })]);
    const res = await locationSearch({ q: '48101' });
    const body = await res.json();
    expect(body.results[0].label).toBe('48101, Michigan, United States');
  });

  it('falls back to the first two display_name segments when no city or postcode', async () => {
    mockNominatim([nominatimHit({ display_name: 'Pacific Ocean, Pacific, Global', address: {} })]);
    const res = await locationSearch({ q: 'Pacific' });
    const body = await res.json();
    expect(body.results[0].label).toBe('Pacific Ocean, Pacific');
  });

  it('limits results to 5 even when Nominatim returns more', async () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      nominatimHit({ lat: String(40 + i), address: { city: `City${i}`, state: 'State', country_code: 'us' } })
    );
    mockNominatim(many);
    const res = await locationSearch({ q: 'City' });
    const body = await res.json();
    expect(body.results).toHaveLength(5);
  });

  it('converts lat/lon strings to numbers in the result', async () => {
    mockNominatim([nominatimHit({ lat: '44.9778', lon: '-93.2650', address: { city: 'Minneapolis', state: 'Minnesota', country_code: 'us' } })]);
    const res = await locationSearch({ q: 'Minneapolis' });
    const body = await res.json();
    expect(body.results[0].lat).toBe(44.9778);
    expect(body.results[0].lon).toBe(-93.265);
  });

  it('includes a Cache-Control header on a successful response', async () => {
    mockNominatim([nominatimHit({ address: { city: 'Denver', state: 'Colorado', country_code: 'us' } })]);
    const res = await locationSearch({ q: 'Denver' });
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=3600');
  });
});
