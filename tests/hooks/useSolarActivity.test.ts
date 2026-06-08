import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSolarActivity } from '../../lib/hooks/useSolarActivity';
import { fetchXrayFlaresLatest, fetchAlerts, fetchSolarRegions } from '../../lib/api/fetchers';
import type { XrayFlare, Alert, SolarRegion } from '../../lib/api/schemas';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../lib/api/fetchers', () => ({
  fetchXrayFlaresLatest: vi.fn(),
  fetchAlerts: vi.fn(),
  fetchSolarRegions: vi.fn(),
}));

vi.mock('../../lib/utils/retry', () => ({
  logDataError: vi.fn(),
  recordDataSuccess: vi.fn(),
  shouldRetryCritical: vi.fn().mockReturnValue(false),
  shouldRetryNonCritical: vi.fn().mockReturnValue(false),
  exponentialBackoff: vi.fn().mockReturnValue(0),
}));

const mockedFetchFlares = vi.mocked(fetchXrayFlaresLatest);
const mockedFetchAlerts = vi.mocked(fetchAlerts);
const mockedFetchRegions = vi.mocked(fetchSolarRegions);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const flareFixtures: XrayFlare[] = [
  { time_tag: '2026-06-07T10:00:00Z', satellite: 16, max_class: 'M2.5', max_time: '2026-06-07T10:05:00Z' },
  { time_tag: '2026-06-07T08:00:00Z', satellite: 16, max_class: 'C1.0' },
];

const alertFixtures: Alert[] = [
  { product_id: 'AL0001', issue_datetime: '2026-06-07 09:00:00', message: 'ALERT: CME observed.' },
  { product_id: 'AL0002', issue_datetime: '2026-06-07 08:00:00', message: 'Watch issued.' },
];

const regionFixtures: SolarRegion[] = [
  { observed_date: '2026-06-07', region: 1234, number_spots: 12, latitude: 15, longitude: -30, location: 'N15W30' },
];

// ── Wrapper factory ───────────────────────────────────────────────────────────

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
  mockedFetchFlares.mockResolvedValue(flareFixtures);
  mockedFetchAlerts.mockResolvedValue(alertFixtures);
  mockedFetchRegions.mockResolvedValue(regionFixtures);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSolarActivity', () => {
  it('returns isLoading true when all queries are pending', () => {
    const never = () => new Promise<never>(() => {});
    mockedFetchFlares.mockImplementation(never);
    mockedFetchAlerts.mockImplementation(never);
    mockedFetchRegions.mockImplementation(never);

    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.latestFlare).toBeNull();
  });

  it('populates latestFlare, alerts, and sunspotNumber on happy path', async () => {
    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.latestFlare).not.toBeNull();
    expect(result.current.latestFlare?.max_class).toBe('M2.5');
    expect(result.current.alerts).toHaveLength(2);
    expect(result.current.sunspotNumber).toBeGreaterThanOrEqual(0);
    expect(result.current.error).toBeFalsy();
    expect(result.current.regionsError).toBeFalsy();
  });

  it('exposes flareTime from latestFlare.max_time when present', async () => {
    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.flareTime).toBe('2026-06-07T10:05:00Z');
  });

  it('falls back to time_tag for flareTime when max_time is absent', async () => {
    mockedFetchFlares.mockResolvedValue([
      { time_tag: '2026-06-07T10:00:00Z', satellite: 16, max_class: 'C1.0' },
    ]);

    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.flareTime).toBe('2026-06-07T10:00:00Z');
  });

  it('sets latestFlare to null and flareTime to null when flares array is empty', async () => {
    mockedFetchFlares.mockResolvedValue([]);

    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.latestFlare).toBeNull();
    expect(result.current.flareTime).toBeNull();
  });

  it('sets alertsTime to null when alerts array is empty', async () => {
    mockedFetchAlerts.mockResolvedValue([]);

    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.alertsTime).toBeNull();
  });

  it('sets regionsTime to null when regions array is empty', async () => {
    mockedFetchRegions.mockResolvedValue([]);

    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.regionsTime).toBeNull();
  });

  it('exposes alertsTime from the first alert', async () => {
    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.alertsTime).toBe('2026-06-07 09:00:00');
  });

  it('exposes regionsTime from the first region observed_date', async () => {
    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.regionsTime).toBe('2026-06-07');
  });

  it('sets error truthy when flares fetch fails', async () => {
    mockedFetchFlares.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.isLoading).toBe(false);
  });

  it('sets regionsError but not error when only regions fetch fails', async () => {
    mockedFetchRegions.mockRejectedValue(new Error('regions down'));

    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.regionsError).toBeTruthy());

    expect(result.current.error).toBeFalsy();
  });

  it('lastFetchedAt is 0 while loading, positive after data arrives', async () => {
    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.lastFetchedAt).toBeGreaterThan(0);
  });

  it('refetchAll is callable without throwing', async () => {
    const { result } = renderHook(() => useSolarActivity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(() => result.current.refetchAll()).not.toThrow();
  });
});
