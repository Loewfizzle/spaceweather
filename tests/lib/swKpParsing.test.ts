import { describe, it, expect } from 'vitest';
import { parseKpFromTabular } from '@/lib/utils/swKpParsing';

describe('parseKpFromTabular', () => {
  it('returns the Kp value from the last data row', () => {
    const raw = [
      ['time_tag', 'Kp', 'a_running', 'station_count'],
      ['2026-06-06 00:00:00', '1.33', '2.00', '12'],
      ['2026-06-06 03:00:00', '3.67', '3.00', '14'],
    ];
    expect(parseKpFromTabular(raw)).toBe(3.67);
  });

  it('handles a single data row', () => {
    const raw = [
      ['time_tag', 'Kp'],
      ['2026-06-06 00:00:00', '2.00'],
    ];
    expect(parseKpFromTabular(raw)).toBe(2);
  });

  it('works when Kp column is not the first column', () => {
    const raw = [
      ['time_tag', 'a_running', 'Kp'],
      ['2026-06-06 00:00:00', '1.00', '4.33'],
    ];
    expect(parseKpFromTabular(raw)).toBe(4.33);
  });

  it('returns null for empty array', () => {
    expect(parseKpFromTabular([])).toBeNull();
  });

  it('returns null for header-only array (no data rows)', () => {
    expect(parseKpFromTabular([['time_tag', 'Kp']])).toBeNull();
  });

  it('returns null when Kp column is absent from header', () => {
    const raw = [
      ['time_tag', 'a_running'],
      ['2026-06-06 00:00:00', '1.33'],
    ];
    expect(parseKpFromTabular(raw)).toBeNull();
  });

  it('returns null for non-numeric Kp cell', () => {
    const raw = [
      ['time_tag', 'Kp'],
      ['2026-06-06 00:00:00', 'N/A'],
    ];
    expect(parseKpFromTabular(raw)).toBeNull();
  });

  it('returns null for empty Kp cell', () => {
    const raw = [
      ['time_tag', 'Kp'],
      ['2026-06-06 00:00:00', ''],
    ];
    expect(parseKpFromTabular(raw)).toBeNull();
  });

  it('returns null for non-array input', () => {
    expect(parseKpFromTabular(null)).toBeNull();
    expect(parseKpFromTabular(undefined)).toBeNull();
    expect(parseKpFromTabular('string')).toBeNull();
    expect(parseKpFromTabular(42)).toBeNull();
  });

  it('returns null when header row is not an array', () => {
    expect(parseKpFromTabular([null, ['2026-06-06 00:00:00', '1.33']])).toBeNull();
  });
});
