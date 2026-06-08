import { describe, it, expect } from 'vitest';
import {
  windBlurb,
  bzBlurb,
  liveKpBlurb,
  ovationNABlurb,
  ovationUserBlurb,
  forecastKpBlurb,
  viewingWindowLocationBlurb,
  mapLocationBlurb,
} from '../../lib/aurora/conditions';

// ── windBlurb ─────────────────────────────────────────────────────────────────

describe('windBlurb', () => {
  it('returns no-data when speed is null', () => {
    expect(windBlurb(null).status).toBe('no data');
  });
  it('slow — below 300', () => {
    expect(windBlurb(250).status).toContain('slow');
  });
  it('normal — 300–449', () => {
    expect(windBlurb(400).status).toContain('normal');
  });
  it('elevated — 450–599', () => {
    expect(windBlurb(500).status).toContain('elevated');
  });
  it('fast — 600–799', () => {
    expect(windBlurb(650).status).toContain('fast');
    expect(windBlurb(650).status).not.toContain('very fast');
  });
  it('very fast — 800+', () => {
    expect(windBlurb(850).status).toContain('very fast');
  });
  it('rounds speed to integer in status string', () => {
    expect(windBlurb(449.7).status).toContain('450');
  });
});

// ── bzBlurb ───────────────────────────────────────────────────────────────────

describe('bzBlurb', () => {
  it('returns no-data when bz is null', () => {
    expect(bzBlurb(null).status).toBe('no data');
  });
  it('strongly southward — -15 or below', () => {
    expect(bzBlurb(-20).status).toContain('strongly southward');
    expect(bzBlurb(-15).status).toContain('strongly southward');
  });
  it('southward — -14.9 to -5', () => {
    expect(bzBlurb(-10).status).toContain('southward');
    expect(bzBlurb(-10).status).not.toContain('strongly');
  });
  it('mildly southward — -4.9 to -2', () => {
    expect(bzBlurb(-3).status).toContain('mildly southward');
  });
  it('near neutral — -1.9 to 2', () => {
    expect(bzBlurb(0).status).toContain('near neutral');
    expect(bzBlurb(2).status).toContain('near neutral');
  });
  it('northward — 2.1 to 10', () => {
    expect(bzBlurb(5).status).toContain('northward');
    expect(bzBlurb(5).status).not.toContain('strongly');
  });
  it('strongly northward — above 10', () => {
    expect(bzBlurb(15).status).toContain('strongly northward');
  });
});

// ── liveKpBlurb ───────────────────────────────────────────────────────────────

describe('liveKpBlurb', () => {
  it('returns no-data when kp is null', () => {
    expect(liveKpBlurb(null).status).toBe('no data');
  });
  it('very quiet — below 1', () => {
    expect(liveKpBlurb(0).status).toContain('very quiet');
  });
  it('quiet — 1 to 2.9', () => {
    expect(liveKpBlurb(2).status).toContain('quiet');
    expect(liveKpBlurb(2).status).not.toContain('very quiet');
  });
  it('mild activity — 3 to 3.9', () => {
    expect(liveKpBlurb(3.5).status).toContain('mild activity');
  });
  it('enhanced — 4 to 4.9', () => {
    expect(liveKpBlurb(4).status).toContain('enhanced');
  });
  it('minor storm G1 — 5 to 5.9', () => {
    expect(liveKpBlurb(5).status).toContain('G1');
  });
  it('moderate storm G2 — 6 to 6.9', () => {
    expect(liveKpBlurb(6).status).toContain('G2');
  });
  it('strong storm G3 — 7 to 7.9', () => {
    expect(liveKpBlurb(7).status).toContain('G3');
  });
  it('extreme storm G4/G5 — 8+', () => {
    expect(liveKpBlurb(9).status).toContain('G4/G5');
  });
});

// ── ovationNABlurb ────────────────────────────────────────────────────────────

describe('ovationNABlurb', () => {
  it('unavailable when processed is false', () => {
    expect(ovationNABlurb(40, false)).toContain("isn't available");
  });
  it('unavailable when processed is undefined', () => {
    expect(ovationNABlurb(40)).toContain("isn't available");
  });
  it('unavailable when prob is null even if processed', () => {
    expect(ovationNABlurb(null, true)).toContain("isn't available");
  });
  it('no signal — prob 0', () => {
    expect(ovationNABlurb(0, true)).toContain('no aurora signal');
  });
  it('very faint — prob 1–4', () => {
    expect(ovationNABlurb(3, true)).toContain('very faint');
  });
  it('weak signal — prob 5–14', () => {
    expect(ovationNABlurb(10, true)).toContain('weak aurora signal');
  });
  it('meaningful signal — prob 15–29', () => {
    expect(ovationNABlurb(20, true)).toContain('meaningful aurora signal');
  });
  it('significant activity — prob 30–49', () => {
    expect(ovationNABlurb(40, true)).toContain('significant aurora activity');
  });
  it('very active — prob 50+', () => {
    expect(ovationNABlurb(60, true)).toContain('very active aurora oval');
  });
});

// ── ovationUserBlurb ──────────────────────────────────────────────────────────

describe('ovationUserBlurb', () => {
  it('returns null when prob is null', () => {
    expect(ovationUserBlurb(null)).toBeNull();
  });
  it('less than 1% — prob 0–1', () => {
    const r = ovationUserBlurb(0, 'Duluth');
    expect(r?.first).toContain('less than 1%');
    expect(r?.rest).toBeNull();
  });
  it('faint signal — prob 2–9', () => {
    const r = ovationUserBlurb(5, 'Duluth');
    expect(r?.first).toContain('faint signal');
    expect(r?.rest).toBeTruthy();
  });
  it('marginal signal — prob 10–24', () => {
    expect(ovationUserBlurb(15)?.first).toContain('marginal but real signal');
  });
  it('solid reading — prob 25–49', () => {
    expect(ovationUserBlurb(30)?.first).toContain('solid reading');
  });
  it('strong signal — prob 50+', () => {
    expect(ovationUserBlurb(75)?.first).toContain('strong OVATION signal');
  });
  it('uses fallback name when label is null', () => {
    expect(ovationUserBlurb(5, null)?.first).toContain('Your location');
  });
});

// ── forecastKpBlurb ───────────────────────────────────────────────────────────

describe('forecastKpBlurb', () => {
  it('quiet — below 3', () => {
    expect(forecastKpBlurb(2)).toContain('conditions are quiet');
  });
  it('quiet-to-borderline — 3 to 3.9', () => {
    expect(forecastKpBlurb(3)).toContain('quiet-to-borderline');
  });
  it('slightly elevated — 4 to 4.9', () => {
    expect(forecastKpBlurb(4)).toContain('slightly elevated');
  });
  it('moderate storm — 5 to 5.9', () => {
    expect(forecastKpBlurb(5)).toContain('moderate storm');
  });
  it('strong storm — 6 to 6.9', () => {
    expect(forecastKpBlurb(6)).toContain('strong storm');
  });
  it('major storm — 7 to 7.9', () => {
    expect(forecastKpBlurb(7)).toContain('major storm');
  });
  it('extreme storm — 8+', () => {
    expect(forecastKpBlurb(9)).toContain('extreme geomagnetic storm');
  });
});

// ── viewingWindowLocationBlurb ────────────────────────────────────────────────

describe('viewingWindowLocationBlurb', () => {
  // At Kp=5, minLat = max(30, 67-15) = 52. userLat relative to 52:
  const KP = 5;

  it('comfortably within — diff >= 5 (userLat 60)', () => {
    const r = viewingWindowLocationBlurb(57, KP, 'Duluth');
    expect(r.first).toContain('comfortably within');
    expect(r.rest).toBeNull();
  });
  it('just inside — diff 0–4 (userLat 54)', () => {
    const r = viewingWindowLocationBlurb(54, KP);
    expect(r.first).toContain('just inside');
    expect(r.rest).toBeTruthy();
  });
  it('just outside — diff -3 to -1 (userLat 50)', () => {
    const r = viewingWindowLocationBlurb(50, KP);
    expect(r.first).toContain('just outside');
  });
  it('outside viewing zone — diff -8 to -4 (userLat 46)', () => {
    const r = viewingWindowLocationBlurb(46, KP);
    expect(r.first).toContain('outside the viewing zone');
  });
  it('well south — diff below -8 (userLat 40)', () => {
    const r = viewingWindowLocationBlurb(40, KP);
    expect(r.first).toContain('well south');
  });
  it('uses fallback name when label is omitted', () => {
    const r = viewingWindowLocationBlurb(57, KP);
    expect(r.first).toContain('Your location');
  });
});

// ── mapLocationBlurb ──────────────────────────────────────────────────────────

describe('mapLocationBlurb', () => {
  it('no OVATION signal — prob 0', () => {
    expect(mapLocationBlurb(0, 'Duluth').first).toContain('no OVATION signal');
  });
  it('less than 5% — prob 1–4', () => {
    expect(mapLocationBlurb(3, 'Duluth').first).toContain('less than 5%');
  });
  it('faint but real — prob 5–14', () => {
    expect(mapLocationBlurb(10, 'Duluth').first).toContain('faint but real signal');
  });
  it('meaningful reading — prob 15–29', () => {
    expect(mapLocationBlurb(20, 'Duluth').first).toContain('meaningful reading');
  });
  it('solid signal — prob 30–49', () => {
    expect(mapLocationBlurb(40, 'Duluth').first).toContain('solid signal');
  });
  it('strong OVATION signal — prob 50+', () => {
    expect(mapLocationBlurb(70, 'Duluth').first).toContain('strong OVATION signal');
  });
  it('uses fallback name when label is null', () => {
    expect(mapLocationBlurb(10, null).first).toContain('Your location');
  });
});
