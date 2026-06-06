import { describe, it, expect } from 'vitest';
import { shouldTriggerNotification } from '@/lib/utils/swNotifications';

const defaultPrefs = { kp: 4, prob: 15 };

describe('shouldTriggerNotification', () => {
  it('returns false when kp is null', () => {
    expect(shouldTriggerNotification(null, defaultPrefs, null, null)).toBe(false);
  });

  it('returns true when kp meets the threshold', () => {
    expect(shouldTriggerNotification(4.0, defaultPrefs, null, null)).toBe(true);
    expect(shouldTriggerNotification(4.5, defaultPrefs, null, null)).toBe(true);
  });

  it('returns false when kp is below the threshold and no other factor triggers', () => {
    expect(shouldTriggerNotification(3.9, defaultPrefs, null, null)).toBe(false);
    expect(shouldTriggerNotification(2.0, defaultPrefs, null, null)).toBe(false);
  });

  it('returns true when probability meets the threshold', () => {
    expect(shouldTriggerNotification(2.0, defaultPrefs, null, 15)).toBe(true);
    expect(shouldTriggerNotification(2.0, defaultPrefs, null, 30)).toBe(true);
  });

  it('returns false when probability is below the threshold', () => {
    expect(shouldTriggerNotification(2.0, defaultPrefs, null, 14)).toBe(false);
  });

  it('returns true when Bz is sufficiently southward', () => {
    expect(shouldTriggerNotification(2.0, defaultPrefs, -5, null)).toBe(true);
    expect(shouldTriggerNotification(2.0, defaultPrefs, -10, null)).toBe(true);
  });

  it('returns false when Bz is above the -5 threshold', () => {
    expect(shouldTriggerNotification(2.0, defaultPrefs, -4.9, null)).toBe(false);
    expect(shouldTriggerNotification(2.0, defaultPrefs, 0, null)).toBe(false);
  });

  it('returns true when any one factor hits — others can be null', () => {
    // Only Bz
    expect(shouldTriggerNotification(1.0, defaultPrefs, -6, null)).toBe(true);
    // Only prob
    expect(shouldTriggerNotification(1.0, defaultPrefs, null, 20)).toBe(true);
    // Only kp
    expect(shouldTriggerNotification(5.0, defaultPrefs, null, null)).toBe(true);
  });

  it('respects custom prefs thresholds', () => {
    const strictPrefs = { kp: 6, prob: 30 };
    expect(shouldTriggerNotification(5.9, strictPrefs, null, 29)).toBe(false);
    expect(shouldTriggerNotification(6.0, strictPrefs, null, null)).toBe(true);
    expect(shouldTriggerNotification(3.0, strictPrefs, null, 30)).toBe(true);
  });
});
