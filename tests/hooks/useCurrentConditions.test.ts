import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useCurrentConditions } from '../../lib/use-noaa-data';
import { fetchKpIndex, fetchOvation, fetchPlasma, fetchMag, fetchKpForecast } from '../../lib/api/fetchers';
import type { KpEntry, PlasmaEntry, MagEntry, OvationResponse, KpForecastEntry } from '../../lib/api/schemas';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../lib/api/fetchers', () => ({
  fetchKpIndex: vi.fn(),
  fetchOvation: vi.fn(),
  fetchPlasma: vi.fn(),
  fetchMag: vi.fn(),
  fetchKpForecast: vi.fn(),
}));

vi.mock('../../lib/utils/retry', () => ({
  logDataError: vi.fn(),
  recordDataSuccess: vi.fn(),
  shouldRetryCritical: vi.fn().mockReturnValue(false),
  shouldRetryNonCritical: vi.fn().mockReturnValue(false),
  exponentialBackoff: vi.fn().mockReturnValue(0),
}));

const mockedFetchKpIndex = vi.mocked(fetchKpIndex);
const mockedFetchOvation = vi.mocked(fetchOvation);
const mockedFetchPlasma = vi.mocked(fetchPlasma);
const mockedFetchMag = vi.mocked(fetchMag);
const mockedFetchKpForecast = vi.mocked(fetchKpForecast);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const kpHistory: KpEntry[] = [
  { time_tag: '2026-06-05 06:00:00', Kp: 3.0 },
  { time_tag: '2026-06-05 09:00:00', Kp: 4.5 },
];

// NOAA 0-360 longitude format; filterOvationCoordinates converts >180 to negative:
//   [212, 65, 70] → lon=-148 (near Fairbanks, AK), lat=65, prob=70
//   [238, 48, 20] → lon=-122 (near Seattle, WA),   lat=48, prob=20
//   [270, 50, 35] → lon=-90  (central NA),          lat=50, prob=35
const ovationFixture: OvationResponse = {
  'Observation Time': '2026-06-05T09:00:00Z',
  coordinates: [
    [212, 65, 70],
    [238, 48, 20],
    [270, 50, 35],
  ],
};

const plasmaEntries: PlasmaEntry[] = [
  { time_tag: '2026-06-05 08:58:00', speed: 480, density: 5.1, temperature: null },
  { time_tag: '2026-06-05 09:00:00', speed: 520, density: 4.2, temperature: null },
];

const magEntries: MagEntry[] = [
  { time_tag: '2026-06-05 08:58:00', bz_gsm: -4.0, bt: 8.0 },
  { time_tag: '2026-06-05 09:00:00', bz_gsm: -6.5, bt: 10.0 },
];

const emptyForecast: KpForecastEntry[] = [];

// ── Wrapper factory ───────────────────────────────────────────────────────────

// Returns a fresh QueryClientProvider wrapper per test so caches don't bleed across tests.
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchKpIndex.mockResolvedValue(kpHistory);
  mockedFetchOvation.mockResolvedValue(ovationFixture);
  mockedFetchPlasma.mockResolvedValue(plasmaEntries);
  mockedFetchMag.mockResolvedValue(magEntries);
  mockedFetchKpForecast.mockResolvedValue(emptyForecast);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCurrentConditions', () => {
  it('returns isLoading true and kp null when all fetchers are pending', () => {
    const neverResolve = () => new Promise<never>(() => {});
    mockedFetchKpIndex.mockImplementation(neverResolve);
    mockedFetchOvation.mockImplementation(neverResolve);
    mockedFetchPlasma.mockImplementation(neverResolve);
    mockedFetchMag.mockImplementation(neverResolve);
    mockedFetchKpForecast.mockImplementation(neverResolve);

    const { result } = renderHook(() => useCurrentConditions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.kp).toBe(null);
  });

  it('populates kp, bz, solarWindSpeed, ovationPoints, riskLevel on happy path', async () => {
    const { result } = renderHook(() => useCurrentConditions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.kp).toBe(4.5);
    expect(result.current.kpTime).toBe('2026-06-05 09:00:00');
    expect(result.current.bz).toBe(-6.5);
    expect(result.current.solarWindSpeed).toBe(520);
    expect(result.current.maxAuroraProbNA).toBeGreaterThan(0);
    expect(result.current.ovationPoints.length).toBeGreaterThan(0);
    expect(result.current.riskLevel).toBe('High');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns riskLevel Quiet with low Kp and empty OVATION', async () => {
    mockedFetchKpIndex.mockResolvedValue([
      { time_tag: '2026-06-05 09:00:00', Kp: 2 },
    ]);
    mockedFetchOvation.mockResolvedValue({ coordinates: [] });
    mockedFetchMag.mockResolvedValue([
      { time_tag: '2026-06-05 09:00:00', bz_gsm: -2.0, bt: 4.0 },
    ]);

    const { result } = renderHook(() => useCurrentConditions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.riskLevel).toBe('Quiet');
  });

  it('sets kpError and error truthy when fetchKpIndex rejects', async () => {
    mockedFetchKpIndex.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useCurrentConditions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kpError).toBeTruthy());

    expect(result.current.error).toBeTruthy();
  });

  it('does not set critical error when only plasma and mag reject', async () => {
    mockedFetchPlasma.mockRejectedValue(new Error('plasma down'));
    mockedFetchMag.mockRejectedValue(new Error('mag down'));

    const { result } = renderHook(() => useCurrentConditions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.solarWindError).toBeTruthy());

    expect(result.current.error).toBeNull();
  });

  it('ovationPoints reference is stable after refetch with identical data', async () => {
    const { result } = renderHook(() => useCurrentConditions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const firstRef = result.current.ovationPoints;

    act(() => { result.current.refetchAll(); });

    await waitFor(() => expect(mockedFetchOvation).toHaveBeenCalledTimes(2));

    expect(Object.is(result.current.ovationPoints, firstRef)).toBe(true);
  });

  it('cityProbs has 6 entries with correct shape, Fairbanks prob > Seattle prob', async () => {
    mockedFetchKpIndex.mockResolvedValue([
      { time_tag: '2026-06-05 09:00:00', Kp: 5 },
    ]);

    const { result } = renderHook(() => useCurrentConditions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const { cityProbs } = result.current;
    expect(cityProbs).toHaveLength(6);
    for (const city of cityProbs) {
      expect(city).toHaveProperty('name');
      expect(city).toHaveProperty('state');
      expect(typeof city.prob).toBe('number');
      expect(city.prob).toBeGreaterThanOrEqual(0);
      expect(city.prob).toBeLessThanOrEqual(99);
    }

    const fairbanks = cityProbs.find(c => c.name === 'Fairbanks')!;
    const seattle   = cityProbs.find(c => c.name === 'Seattle')!;
    expect(fairbanks.prob).toBeGreaterThan(seattle.prob);
  });

  it('refetchAll is a stable function reference across re-renders in steady state', async () => {
    const { result, rerender } = renderHook(() => useCurrentConditions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const firstRef = result.current.refetchAll;
    rerender();

    expect(Object.is(result.current.refetchAll, firstRef)).toBe(true);
  });
});
