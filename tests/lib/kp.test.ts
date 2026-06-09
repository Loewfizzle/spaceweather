import { describe, it, expect } from 'vitest';
import { getAuroraRiskLevel, getAuroraGuidance } from '../../lib/aurora/kp';

// ── getAuroraRiskLevel ────────────────────────────────────────────────────────
// Covers all 9 distinct branches: null kp, quiet baseline, each of the 4 High
// triggers, and each of the 4 Moderate triggers.

describe('getAuroraRiskLevel', () => {
  it('returns "Quiet" when kp is null', () => {
    expect(getAuroraRiskLevel(null, null, null)).toBe('Quiet');
  });

  it('returns "Quiet" for calm baseline conditions', () => {
    expect(getAuroraRiskLevel(2, 5, -2)).toBe('Quiet');
  });

  // Moderate triggers
  it('returns "Moderate" when kp >= 4', () => {
    expect(getAuroraRiskLevel(4, 0, 0)).toBe('Moderate');
  });

  it('returns "Moderate" when prob >= 15', () => {
    expect(getAuroraRiskLevel(2, 15, 0)).toBe('Moderate');
  });

  it('returns "Moderate" when bz <= -5', () => {
    expect(getAuroraRiskLevel(2, 0, -5)).toBe('Moderate');
  });

  it('returns "Moderate" when kp >= 3 and speed > 600', () => {
    expect(getAuroraRiskLevel(3, 0, 0, 650)).toBe('Moderate');
  });

  // High triggers
  it('returns "High" when kp >= 5', () => {
    expect(getAuroraRiskLevel(5, 0, 0)).toBe('High');
  });

  it('returns "High" when prob >= 25', () => {
    expect(getAuroraRiskLevel(2, 25, 0)).toBe('High');
  });

  it('returns "High" when bz <= -8', () => {
    expect(getAuroraRiskLevel(2, 0, -8)).toBe('High');
  });

  it('returns "High" when kp >= 4 and speed > 600', () => {
    expect(getAuroraRiskLevel(4, 0, 0, 650)).toBe('High');
  });
});

// ── getAuroraGuidance ─────────────────────────────────────────────────────────
// Covers the non-obvious branches not already tested through getTonightOutlook.

describe('getAuroraGuidance', () => {
  it('returns loading string when kp is null', () => {
    expect(getAuroraGuidance(null, null, null)).toBe('Data loading...');
  });

  it('appends forecast peak note when forecastPeakKp is more than 0.5 above current kp', () => {
    const text = getAuroraGuidance(3, null, null, null, 5.0);
    expect(text).toContain('Kp 5.0 forecast as tonight\'s peak');
  });

  it('does not append peak note when forecastPeakKp is within 0.5 of current kp', () => {
    const text = getAuroraGuidance(4, null, null, null, 4.3);
    expect(text).not.toContain('forecast as tonight\'s peak');
  });

  it('appends Bz suffix when bz <= -5', () => {
    const text = getAuroraGuidance(4, null, -6);
    expect(text).toContain('Strong southward Bz');
  });
});
