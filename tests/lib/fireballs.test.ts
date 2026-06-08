import { describe, it, expect } from 'vitest';
import {
  formatFireballDate,
  formatFireballLocation,
  formatFireballEnergy,
} from '../../lib/aurora/fireballs';

// ── formatFireballDate ────────────────────────────────────────────────────────

describe('formatFireballDate', () => {
  it('returns "—" for empty string', () => {
    expect(formatFireballDate('')).toBe('—');
  });

  it('formats a CNEOS space-separated datetime to a UTC string', () => {
    const result = formatFireballDate('2024-06-15 10:30:00');
    expect(result).toContain('UTC');
    expect(result).toContain('2024');
  });

  it('returns the original string when the date is unparseable (NaN path)', () => {
    expect(formatFireballDate('not-a-date')).toBe('not-a-date');
  });

  it('preserves the UTC timestamp (no timezone shift)', () => {
    // 2024-01-15 00:00:00 UTC should show Jan 15, not Jan 14
    const result = formatFireballDate('2024-01-15 00:00:00');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });
});

// ── formatFireballLocation ────────────────────────────────────────────────────

describe('formatFireballLocation', () => {
  it('formats positive lat/lon as N/E', () => {
    const result = formatFireballLocation({ lat: 34.5, lon: 118.3 });
    expect(result).toContain('34.5°N');
    expect(result).toContain('118.3°E');
  });

  it('formats negative lat/lon as S/W', () => {
    const result = formatFireballLocation({ lat: -23.1, lon: -46.6 });
    expect(result).toContain('23.1°S');
    expect(result).toContain('46.6°W');
  });

  it('returns "Location unavailable" when lat is null', () => {
    expect(formatFireballLocation({ lat: null, lon: -90 })).toBe('Location unavailable');
  });

  it('returns "Location unavailable" when lon is null', () => {
    expect(formatFireballLocation({ lat: 40, lon: null })).toBe('Location unavailable');
  });
});

// ── formatFireballEnergy ──────────────────────────────────────────────────────

describe('formatFireballEnergy', () => {
  it('returns "—" for null', () => {
    expect(formatFireballEnergy(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatFireballEnergy(undefined)).toBe('—');
  });

  it('returns "—" for a non-numeric string', () => {
    expect(formatFireballEnergy('n/a')).toBe('—');
  });

  it('formats values >= 1 with one decimal place', () => {
    expect(formatFireballEnergy('2.5')).toBe('2.5 kt TNT');
    expect(formatFireballEnergy('10')).toBe('10.0 kt TNT');
  });

  it('formats values >= 0.001 and < 1 with three decimal places', () => {
    expect(formatFireballEnergy('0.015')).toBe('0.015 kt TNT');
    expect(formatFireballEnergy('0.1')).toBe('0.100 kt TNT');
  });

  it('returns "< 0.001 kt TNT" for very small values', () => {
    expect(formatFireballEnergy('0.0001')).toBe('< 0.001 kt TNT');
  });
});
