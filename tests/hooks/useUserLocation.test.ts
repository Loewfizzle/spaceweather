import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useUserLocation } from '../../lib/hooks/useUserLocation';

vi.mock('../../lib/aurora/location', () => ({
  getNearestCityName: vi.fn(() => 'Test City, ST'),
}));

const LS_KEY = 'user-location';

// ── Geolocation mock helpers ──────────────────────────────────────────────────

let capturedSuccess: PositionCallback | null = null;
let capturedError: PositionErrorCallback | null = null;

function setupGeolocation() {
  capturedSuccess = null;
  capturedError = null;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
        capturedSuccess = success;
        capturedError = error;
      }),
    },
  });
}

function removeGeolocation() {
  // Delete the property so that `"geolocation" in navigator` is false,
  // which is the condition the hook checks for gps-unavailable.
  Reflect.deleteProperty(navigator, 'geolocation');
}

function fireGeoSuccess(lat = 44.0, lon = -93.0, accuracy = 50) {
  act(() => {
    capturedSuccess?.({
      coords: {
        latitude: lat, longitude: lon, accuracy,
        altitude: null, altitudeAccuracy: null, heading: null, speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);
  });
}

function fireGeoError(code: number) {
  act(() => {
    capturedError?.({
      code,
      message: 'error',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useUserLocation', () => {
  beforeEach(() => {
    localStorage.clear();
    setupGeolocation();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts idle when no location is saved', () => {
    const { result } = renderHook(() => useUserLocation());
    expect(result.current.state.status).toBe('idle');
  });

  it('restores a saved manual location from localStorage on mount', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      lat: 44.0, lon: -93.0, label: 'Minneapolis', source: 'manual', savedAt: Date.now(),
    }));

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.state.status).toBe('set');
    if (result.current.state.status === 'set') {
      expect(result.current.state.label).toBe('Minneapolis');
      expect(result.current.state.source).toBe('manual');
      expect(result.current.state.lat).toBe(44.0);
    }
  });

  it('ignores GPS location older than 12 hours', () => {
    const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
    localStorage.setItem(LS_KEY, JSON.stringify({
      lat: 44.0, lon: -93.0, label: 'Minneapolis', source: 'gps', savedAt: thirteenHoursAgo,
    }));

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.state.status).toBe('idle');
  });

  it('restores GPS location if it is within 12 hours', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    localStorage.setItem(LS_KEY, JSON.stringify({
      lat: 44.0, lon: -93.0, label: 'Minneapolis', source: 'gps', savedAt: twoHoursAgo,
    }));

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.state.status).toBe('set');
  });

  it('requestGpsLocation: idle → gps-loading → set on success', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => { result.current.requestGpsLocation(); });
    expect(result.current.state.status).toBe('gps-loading');

    fireGeoSuccess(44.0, -93.0, 50);

    expect(result.current.state.status).toBe('set');
    if (result.current.state.status === 'set') {
      expect(result.current.state.lat).toBe(44.0);
      expect(result.current.state.lon).toBe(-93.0);
      expect(result.current.state.source).toBe('gps');
      expect(result.current.state.label).toBe('Test City, ST');
    }
    // persisted to localStorage
    const saved = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(saved.lat).toBe(44.0);
    expect(saved.source).toBe('gps');
  });

  it('requestGpsLocation: PERMISSION_DENIED → gps-denied', () => {
    const { result } = renderHook(() => useUserLocation());
    act(() => { result.current.requestGpsLocation(); });

    fireGeoError(1); // PERMISSION_DENIED

    expect(result.current.state.status).toBe('gps-denied');
  });

  it('requestGpsLocation: TIMEOUT → gps-timeout', () => {
    const { result } = renderHook(() => useUserLocation());
    act(() => { result.current.requestGpsLocation(); });

    fireGeoError(3); // TIMEOUT

    expect(result.current.state.status).toBe('gps-timeout');
  });

  it('rejects GPS fix with accuracy > 100 km as gps-timeout', () => {
    const { result } = renderHook(() => useUserLocation());
    act(() => { result.current.requestGpsLocation(); });

    fireGeoSuccess(44.0, -93.0, 150_000); // accuracy > 100,000 m

    expect(result.current.state.status).toBe('gps-timeout');
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('gps-unavailable when geolocation API is absent', () => {
    removeGeolocation();

    const { result } = renderHook(() => useUserLocation());
    act(() => { result.current.requestGpsLocation(); });

    expect(result.current.state.status).toBe('gps-unavailable');
  });

  it('setManualLocation sets status and persists to localStorage', () => {
    const { result } = renderHook(() => useUserLocation());

    act(() => { result.current.setManualLocation(44.0, -93.0, 'Minneapolis'); });

    expect(result.current.state.status).toBe('set');
    if (result.current.state.status === 'set') {
      expect(result.current.state.lat).toBe(44.0);
      expect(result.current.state.label).toBe('Minneapolis');
      expect(result.current.state.source).toBe('manual');
    }
    const saved = JSON.parse(localStorage.getItem(LS_KEY)!);
    expect(saved.label).toBe('Minneapolis');
    expect(saved.source).toBe('manual');
  });

  it('clearLocation resets state to idle and removes localStorage entry', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      lat: 44.0, lon: -93.0, label: 'Minneapolis', source: 'manual', savedAt: Date.now(),
    }));
    const { result } = renderHook(() => useUserLocation());
    expect(result.current.state.status).toBe('set');

    act(() => { result.current.clearLocation(); });

    expect(result.current.state.status).toBe('idle');
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });
});
