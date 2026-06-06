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
