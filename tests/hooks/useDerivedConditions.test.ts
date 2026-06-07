import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDerivedConditions } from '../../lib/hooks/useDerivedConditions';
import type { OvationResponse, KpEntry } from '../../lib/api/schemas';

// NOAA 0-360 lon format; filterOvationCoordinates converts >180 to negative:
//   [212, 65, 70] → lon=-148 (near Fairbanks AK), lat=65, prob=70
//   [238, 48, 20] → lon=-122 (near Seattle WA),   lat=48, prob=20
//   [270, 50, 35] → lon=-90  (central NA),          lat=50, prob=35
const ovationFixture: OvationResponse = {
  'Observation Time': '2026-06-05T09:00:00Z',
  coordinates: [
    [212, 65, 70],
    [238, 48, 20],
    [270, 50, 35],
  ],
};

const kp45: KpEntry = { time_tag: '2026-06-05 09:00:00', Kp: 4.5 };

function render(overrides: Partial<Parameters<typeof useDerivedConditions>[0]> = {}) {
  return renderHook(() => useDerivedConditions({
    latestKp: kp45,
    ovationData: ovationFixture,
    ovationIsSuccess: true,
    bz: -3,
    speed: 450,
    forecastData: [],
    ...overrides,
  }));
}

describe('useDerivedConditions', () => {
  it('returns empty ovationPoints and null maxAuroraProbNA when ovationData is undefined', () => {
    const { result } = render({ ovationData: undefined, ovationIsSuccess: false });
    expect(result.current.ovationPoints).toHaveLength(0);
    expect(result.current.maxAuroraProbNA).toBeNull();
    expect(result.current.ovationProcessed).toBe(false);
  });

  it('filters and returns ovationPoints from fixture coordinates', () => {
    const { result } = render();
    expect(result.current.ovationPoints).toHaveLength(3);
  });

  it('maxAuroraProbNA is positive with northern-latitude high-prob points', () => {
    const { result } = render();
    expect(result.current.maxAuroraProbNA).toBeGreaterThan(0);
  });

  it('ovationProcessed is true when ovationIsSuccess and ovationData are both truthy', () => {
    const { result } = render();
    expect(result.current.ovationProcessed).toBe(true);
  });

  it('ovationProcessed is false when ovationIsSuccess is false', () => {
    const { result } = render({ ovationIsSuccess: false });
    expect(result.current.ovationProcessed).toBe(false);
  });

  it('riskLevel is High with Kp=4.5 and populated OVATION', () => {
    const { result } = render();
    expect(result.current.riskLevel).toBe('High');
  });

  it('riskLevel is Quiet with low Kp and empty ovation', () => {
    const { result } = render({
      latestKp: { time_tag: '2026-06-05 09:00:00', Kp: 2 },
      ovationData: { coordinates: [] },
      bz: -2,
    });
    expect(result.current.riskLevel).toBe('Quiet');
  });

  it('cityProbs has 6 entries with Fairbanks prob > Seattle prob', () => {
    const { result } = render({ latestKp: { time_tag: '', Kp: 5 } });
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

  it('applies Bz boost to cityProbs when bz <= -5', () => {
    const { result: withBoost } = render({ bz: -8 });
    const { result: noBoost   } = render({ bz: -3 });
    const boosted = withBoost.current.cityProbs.map(c => c.prob);
    const normal  = noBoost.current.cityProbs.map(c => c.prob);
    expect(boosted.some((p, i) => p > normal[i])).toBe(true);
  });

  it('viewingWindow is null when forecastData is empty', () => {
    const { result } = render({ forecastData: [] });
    expect(result.current.viewingWindow).toBeNull();
  });

  it('ovationPoints reference is stable across re-renders with unchanged ovationData', () => {
    const { result, rerender } = render();
    const first = result.current.ovationPoints;
    rerender();
    expect(Object.is(result.current.ovationPoints, first)).toBe(true);
  });
});
