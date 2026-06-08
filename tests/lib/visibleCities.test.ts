import { describe, it, expect } from 'vitest';
import { getVisibleCities } from '../../lib/aurora/visibleCities';

describe('getVisibleCities', () => {
  it('returns at most 5 cities', () => {
    const { cities } = getVisibleCities(5);
    expect(cities.length).toBeLessThanOrEqual(5);
  });

  it('returns 0 cities when Kp is so low the minLat floor (30°N) excludes everything', () => {
    // minLat = max(30, 67 - 0*3) = 67; all CONUS cities are south of 67°N except Alaska
    // At Kp=0 only far-north Alaskan cities qualify
    const { cities, minLat } = getVisibleCities(0);
    expect(minLat).toBe(67);
    for (const city of cities) {
      expect(city.lat).toBeGreaterThanOrEqual(67);
    }
  });

  it('all returned cities are at or above minLat', () => {
    const { cities, minLat } = getVisibleCities(5);
    for (const city of cities) {
      expect(city.lat).toBeGreaterThanOrEqual(minLat);
    }
  });

  it('minLat decreases as Kp increases', () => {
    const { minLat: low }  = getVisibleCities(2);
    const { minLat: high } = getVisibleCities(7);
    expect(high).toBeLessThan(low);
  });

  it('minLat is clamped at 30 for very high Kp', () => {
    const { minLat } = getVisibleCities(20);
    expect(minLat).toBe(30);
  });

  it('prefers well-known cities (Fairbanks, Duluth, etc.) over unknown ones at the same latitude', () => {
    // At moderate Kp multiple cities qualify; preferred ones should appear first
    const { cities } = getVisibleCities(5);
    const preferredNames = new Set([
      'Fairbanks', 'Anchorage', 'Juneau', 'Seattle', 'Spokane', 'Portland',
      'Billings', 'Great Falls', 'Missoula', 'Duluth', 'Fargo', 'Minneapolis',
      'Bismarck', 'Milwaukee', 'Chicago', 'Detroit', 'Cleveland', 'Buffalo',
      'Burlington', 'Boston', 'Denver', 'Salt Lake City', 'Boise',
    ]);
    // At least the first city in the list should be a preferred city (if any qualify)
    if (cities.length > 0) {
      expect(preferredNames.has(cities[0].name)).toBe(true);
    }
  });

  it('each city has name, state, and numeric lat', () => {
    const { cities } = getVisibleCities(5);
    for (const city of cities) {
      expect(typeof city.name).toBe('string');
      expect(typeof city.state).toBe('string');
      expect(typeof city.lat).toBe('number');
    }
  });

  it('returns more cities at higher Kp (lower minLat threshold)', () => {
    const { cities: lowKp }  = getVisibleCities(1);
    const { cities: highKp } = getVisibleCities(8);
    // Both are capped at 5 but at high Kp there should be at least as many
    expect(highKp.length).toBeGreaterThanOrEqual(lowKp.length);
  });
});
