import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { parseNoaaTimestamp, useGlobalFreshness } from '../../lib/hooks/useGlobalFreshness';

// ============================================
// parseNoaaTimestamp
// ============================================
describe('parseNoaaTimestamp', () => {
  it('handles date-only strings — the Safari/Firefox regression case', () => {
    // "2026-06-05Z" is non-standard and produces Invalid Date in Safari/Firefox JSC.
    // The fix appends "T00:00:00Z" to date-only strings instead of bare "Z".
    const d = parseNoaaTimestamp('2026-06-05');
    expect(d.getTime()).not.toBeNaN();
    expect(d.toISOString()).toBe('2026-06-05T00:00:00.000Z');
  });

  it('handles space-separated NOAA datetime (most common live-feed format)', () => {
    const d = parseNoaaTimestamp('2026-06-05 23:00:00.000');
    expect(d.getTime()).not.toBeNaN();
    expect(d.toISOString()).toBe('2026-06-05T23:00:00.000Z');
  });

  it('handles already-correct ISO string ending in Z', () => {
    const d = parseNoaaTimestamp('2026-06-05T23:00:00Z');
    expect(d.getTime()).not.toBeNaN();
    expect(d.toISOString()).toBe('2026-06-05T23:00:00.000Z');
  });

  it('handles ISO string with a fixed UTC offset', () => {
    const d = parseNoaaTimestamp('2026-06-05T19:00:00-04:00');
    expect(d.getTime()).not.toBeNaN();
    expect(d.toISOString()).toBe('2026-06-05T23:00:00.000Z');
  });

  it('handles a datetime string with leading/trailing whitespace', () => {
    const d = parseNoaaTimestamp('  2026-06-05  ');
    expect(d.getTime()).not.toBeNaN();
    expect(d.toISOString()).toBe('2026-06-05T00:00:00.000Z');
  });

  it('produces Invalid Date for a completely unparseable string', () => {
    const d = parseNoaaTimestamp('not-a-date');
    expect(d.getTime()).toBeNaN();
  });
});

// ============================================
// useGlobalFreshness
// ============================================
describe('useGlobalFreshness', () => {
  it('returns null when called with no arguments', () => {
    const { result } = renderHook(() => useGlobalFreshness());
    expect(result.current).toBeNull();
  });

  it('returns null when all inputs are null', () => {
    const { result } = renderHook(() => useGlobalFreshness(null, null, null, null));
    expect(result.current).toBeNull();
  });

  it('returns the single non-null timestamp as a Date', () => {
    const { result } = renderHook(() => useGlobalFreshness('2026-06-05T12:00:00Z'));
    expect(result.current?.toISOString()).toBe('2026-06-05T12:00:00.000Z');
  });

  it('returns the maximum of multiple timestamps', () => {
    const { result } = renderHook(() =>
      useGlobalFreshness(
        '2026-06-05T10:00:00Z',
        '2026-06-05T12:00:00Z',
        '2026-06-05T11:00:00Z',
        null
      )
    );
    expect(result.current?.toISOString()).toBe('2026-06-05T12:00:00.000Z');
  });

  it('correctly parses a date-only string (Safari/Firefox regression)', () => {
    const { result } = renderHook(() => useGlobalFreshness('2026-06-05'));
    expect(result.current).not.toBeNull();
    expect(result.current?.toISOString()).toBe('2026-06-05T00:00:00.000Z');
  });

  it('filters out invalid timestamps instead of returning NaN', () => {
    const { result } = renderHook(() =>
      useGlobalFreshness('2026-06-05T10:00:00Z', 'not-a-date')
    );
    expect(result.current?.toISOString()).toBe('2026-06-05T10:00:00.000Z');
  });

  it('returns null when all inputs are invalid timestamps', () => {
    const { result } = renderHook(() => useGlobalFreshness('bad', 'also-bad'));
    expect(result.current).toBeNull();
  });

  it('handles space-separated NOAA format', () => {
    const { result } = renderHook(() =>
      useGlobalFreshness('2026-06-05 08:30:00.000', '2026-06-05T10:00:00Z')
    );
    expect(result.current?.toISOString()).toBe('2026-06-05T10:00:00.000Z');
  });
});
