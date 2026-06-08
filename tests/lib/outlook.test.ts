import { describe, it, expect } from 'vitest';
import {
  getCityAuroraProbabilities,
  getLocationAuroraProb,
  getTonightOutlook,
} from '../../lib/aurora/outlook';
import type { OvationPoint } from '../../lib/aurora/ovation';

// ── helpers ───────────────────────────────────────────────────────────────────

function pt(lat: number, lon: number, prob: number): OvationPoint {
  return { lat, lon, prob };
}

// ── resolveProb / getLocationAuroraProb ──────────────────────────────────────

describe('getLocationAuroraProb', () => {
  it('returns the probability of the nearest OVATION point', () => {
    const points = [pt(60, -150, 30), pt(45, -90, 10)];
    // User at 61°N, -148°W — closest to first point
    expect(getLocationAuroraProb(61, -148, points, null, null)).toBe(30);
  });

  it('falls back to Kp-based estimate when points array is empty', () => {
    // Kp=5, lat=65 → boundary=47, margin=18 → peak=min(90,70)=70 → returns 70
    const result = getLocationAuroraProb(65, -120, [], 5, null);
    expect(result).toBeGreaterThan(0);
  });

  it('returns 0 when no points and kp is null', () => {
    expect(getLocationAuroraProb(45, -90, [], null, null)).toBe(0);
  });

  it('applies Bz boost when bz <= -5', () => {
    const base = getLocationAuroraProb(65, -120, [], 3, null);
    const boosted = getLocationAuroraProb(65, -120, [], 3, -8);
    expect(boosted).toBeGreaterThan(base);
  });

  it('does not apply Bz boost when bz > -5', () => {
    const base = getLocationAuroraProb(65, -120, [], 3, null);
    const same  = getLocationAuroraProb(65, -120, [], 3, -4);
    expect(same).toBe(base);
  });

  it('date-line crossing: picks closest point across the antimeridian (line 53 true branch)', () => {
    // User at lon=-170 (Aleutians), OVATION point at lon=150 (eastern Russia).
    // dLonRaw = 150 - (-170) = 320 → |320| > 180 → dLon = 360 - 320 = 40.
    // Without the antimeridian fix the point would appear ~320° away instead of 40°,
    // causing a different (wrong) nearest-point selection.
    const nearPoint = pt(65, 150, 80);   // true nearest across date-line
    const farPoint  = pt(0, -90, 5);     // far away in the Atlantic
    const result = getLocationAuroraProb(65, -170, [nearPoint, farPoint], null, null);
    // Should pick nearPoint (prob=80) not farPoint (prob=5)
    expect(result).toBe(80);
  });
});

// ── getCityAuroraProbabilities ────────────────────────────────────────────────

describe('getCityAuroraProbabilities', () => {
  it('returns a prob for every watch city', () => {
    const result = getCityAuroraProbabilities([], 4, null);
    expect(result).toHaveLength(6);
    for (const city of result) {
      expect(city.prob).toBeGreaterThanOrEqual(0);
      expect(city.prob).toBeLessThanOrEqual(99);
    }
  });

  it('Fairbanks always has highest prob among the six watch cities (high Kp)', () => {
    const result = getCityAuroraProbabilities([], 8, null);
    const fairbanks = result.find((c) => c.name === 'Fairbanks')!;
    const others = result.filter((c) => c.name !== 'Fairbanks');
    for (const city of others) {
      expect(fairbanks.prob).toBeGreaterThanOrEqual(city.prob);
    }
  });
});

// ── getTonightOutlook ─────────────────────────────────────────────────────────

describe('getTonightOutlook', () => {
  it('returns Loading when kp is null', () => {
    const out = getTonightOutlook(null, null, null);
    expect(out.status).toBe('Loading');
    expect(out.reasons).toEqual([]);
  });

  it('returns "Excellent" when kp >= 7', () => {
    const out = getTonightOutlook(7, null, null);
    expect(out.status).toBe('Excellent');
  });

  it('returns "Excellent" when kp >= 6 and strongFavorableBz (bz <= -10)', () => {
    const out = getTonightOutlook(6, -12, null);
    expect(out.status).toBe('Excellent');
    expect(out.reasons.some((r) => /southward bz/i.test(r))).toBe(true);
  });

  it('returns "Excellent" when kp >= 5, veryHighSpeed, and isFavorableBz', () => {
    const out = getTonightOutlook(5, -6, null, [], null, 750);
    expect(out.status).toBe('Excellent');
    expect(out.reasons.some((r) => /750/.test(r))).toBe(true);
  });

  it('returns "Good" when kp >= 5 without extreme conditions', () => {
    const out = getTonightOutlook(5, -1, null);
    expect(out.status).toBe('Good');
  });

  it('returns "Good" when kp >= 4 and isFavorableBz', () => {
    const out = getTonightOutlook(4, -6, null);
    expect(out.status).toBe('Good');
    expect(out.reasons.some((r) => /southward bz/i.test(r))).toBe(true);
  });

  it('returns "Good" when kp >= 4 and highSpeed (> 600)', () => {
    const out = getTonightOutlook(4, -1, null, [], null, 650);
    expect(out.status).toBe('Good');
  });

  it('returns "Good" via highProb (maxAuroraProbNA >= 20)', () => {
    const out = getTonightOutlook(2, -1, 25);
    expect(out.status).toBe('Good');
    expect(out.reasons.some((r) => /high aurora/i.test(r))).toBe(true);
  });

  it('returns "Moderate" when kp >= 4 without Good triggers', () => {
    // kp=4 but no Bz, no highSpeed, no highProb
    // kp >=4 enters Excellent? No: Excellent needs kp>=7 or (>=6 && strongBz) or (>=5 && veryHigh && bz)
    // Good needs kp>=5 or (>=4 && bz) or (>=4 && speed) — but we have none of those
    const out = getTonightOutlook(4, 1, 5);
    expect(out.status).toBe('Moderate');
  });

  it('returns "Moderate" via hasEarthCme with earthImpact including "impact" (first OR branch)', () => {
    const cme = { time: new Date().toISOString(), earthImpact: 'Likely Earth impact', note: '', speed: 700 };
    const out = getTonightOutlook(2, -1, null, [cme]);
    expect(out.status).toBe('Moderate');
    expect(out.reasons.some((r) => /CME/i.test(r))).toBe(true);
  });

  it('returns "Moderate" via hasEarthCme when note contains "Earth-directed" (line 123 second OR branch)', () => {
    // earthImpact does NOT include "impact", but note contains "Earth-directed"
    const cme = {
      time: new Date().toISOString(),
      earthImpact: 'Monitor for effects',
      note: 'Earth-directed CME detected by STEREO-A',
      speed: 600,
    };
    const out = getTonightOutlook(2, -1, null, [cme]);
    expect(out.status).toBe('Moderate');
    expect(out.reasons.some((r) => /CME/i.test(r))).toBe(true);
  });

  it('returns "Low" when kp < 3 with isFavorableBz — pushes Bz reason', () => {
    // kp=2: misses the Moderate "kp>=3 && isFavorableBz" guard → falls to Low via isFavorableBz
    const out = getTonightOutlook(2, -6, null);
    expect(out.status).toBe('Low');
    expect(out.reasons.some((r) => /southward bz/i.test(r))).toBe(true);
  });

  it('returns "Low" when kp >= 3 with bz not favorable — no Bz reason pushed (line 160 false branch)', () => {
    // kp=3, bz=-2 → isFavorableBz=false → if(isFavorableBz) block NOT entered
    const out = getTonightOutlook(3, -2, null);
    expect(out.status).toBe('Low');
    expect(out.reasons.every((r) => !/southward bz/i.test(r))).toBe(true);
  });

  it('returns "Low" when kp < 3 but significantFlare (M-class)', () => {
    const flare = { max_class: 'M5.0', begin_time: '', peak_time: '', end_time: '', region: '1234' };
    const out = getTonightOutlook(2, -1, null, [], flare);
    expect(out.status).toBe('Low');
    expect(out.reasons.some((r) => /flare/i.test(r))).toBe(true);
  });

  it('returns "very low" when all conditions are quiet', () => {
    const out = getTonightOutlook(1, 2, 5);
    expect(out.status).toBe('very low');
  });

  it('includes drivers string with Kp and Bz', () => {
    const out = getTonightOutlook(4, -3, null, [], null, 500);
    expect(out.drivers).toContain('Kp 4.0');
    expect(out.drivers).toContain('-3.0 nT');
    expect(out.drivers).toContain('500 km/s');
  });

  it('uses em-dash for Bz when bz is null', () => {
    const out = getTonightOutlook(4, null, null);
    expect(out.drivers).toContain('Bz — nT');
  });

  it('caps reasons at 2 entries', () => {
    // Excellent branch can push up to 3 reasons; verify it is sliced to 2
    const out = getTonightOutlook(7, -12, 30, [], null, 750);
    expect(out.reasons.length).toBeLessThanOrEqual(2);
  });
});
