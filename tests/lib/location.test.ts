import { describe, it, expect } from 'vitest';
import { getNearestCityName, approximateLocation } from '../../lib/aurora/location';

// ── getNearestCityName ────────────────────────────────────────────────────────

describe('getNearestCityName', () => {
  it('returns a "City, ST" formatted string', () => {
    const result = getNearestCityName(40.71, -74.01); // near NYC
    expect(result).toMatch(/^.+, [A-Z]{2}$/);
  });

  it('returns a city close to the given coordinates', () => {
    // Fairbanks AK is 64.84, -147.72 — should win over any other city
    const result = getNearestCityName(64.8, -147.7);
    expect(result).toContain('Fairbanks');
  });

  it('chooses Seattle over Fairbanks for a Seattle-area coordinate', () => {
    const result = getNearestCityName(47.6, -122.3);
    expect(result).toContain('Seattle');
  });
});

// ── approximateLocation ───────────────────────────────────────────────────────

describe('approximateLocation', () => {
  // Priority 1 — Bering Sea (antimeridian)
  it('matches Bering Sea for lon >= 155', () => {
    expect(approximateLocation(57, 160)).toBe('Bering Sea');
  });
  it('matches Bering Sea for lon <= -168', () => {
    expect(approximateLocation(57, -169)).toBe('Bering Sea');
  });

  // Priority 2 — Enclosed seas
  it('matches Black Sea before Mediterranean (overlapping bbox)', () => {
    expect(approximateLocation(43, 32)).toBe('Black Sea');
  });
  it('matches Mediterranean Sea', () => {
    expect(approximateLocation(38, 15)).toBe('Mediterranean Sea');
  });
  it('matches Gulf of Mexico', () => {
    expect(approximateLocation(24, -90)).toBe('Gulf of Mexico');
  });
  it('matches Caribbean Sea', () => {
    expect(approximateLocation(17, -75)).toBe('Caribbean Sea');
  });

  // Priority 3 — Greenland / North America
  it('matches Greenland', () => {
    expect(approximateLocation(72, -45)).toBe('Greenland');
  });
  it('matches North America (Alaska band)', () => {
    expect(approximateLocation(64, -145)).toBe('North America');
  });
  it('matches North America (main continent)', () => {
    expect(approximateLocation(40, -100)).toBe('North America');
  });

  // Priority 4 — Arctic Ocean (fires after Greenland/NA so lat=80 lon=0 → Arctic, not Europe)
  it('matches Arctic Ocean for high-latitude non-land', () => {
    expect(approximateLocation(80, 0)).toBe('Arctic Ocean');
  });

  // Priority 5 — Southern Ocean
  it('matches Southern Ocean for lat < -60', () => {
    expect(approximateLocation(-65, 30)).toBe('Southern Ocean');
  });

  // Priority 6 — Other landmasses
  it('matches Europe', () => {
    expect(approximateLocation(50, 10)).toBe('Europe');
  });
  it('matches South America', () => {
    expect(approximateLocation(-20, -60)).toBe('South America');
  });
  it('matches East Asia', () => {
    expect(approximateLocation(35, 120)).toBe('East Asia');
  });
  it('matches Australia', () => {
    expect(approximateLocation(-25, 135)).toBe('Australia');
  });

  // Priority 7 — Open-ocean catch-alls
  it('matches North Pacific (eastern side)', () => {
    expect(approximateLocation(40, -150)).toBe('North Pacific Ocean');
  });
  it('matches North Pacific (western side)', () => {
    expect(approximateLocation(40, 160)).toBe('North Pacific Ocean');
  });
  it('matches North Atlantic', () => {
    expect(approximateLocation(45, -40)).toBe('North Atlantic Ocean');
  });
  it('matches South Atlantic', () => {
    expect(approximateLocation(-30, -20)).toBe('South Atlantic Ocean');
  });
  it('matches Indian Ocean', () => {
    // lat=-10 is south of the South Asia bbox (lat 5–50); lon=70 is well inside the Indian Ocean
    expect(approximateLocation(-10, 70)).toBe('Indian Ocean');
  });
});
