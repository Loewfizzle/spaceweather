import { describe, it, expect } from 'vitest';
import {
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
} from '../../lib/aurora/meteors';
import type { MeteorShower } from '../../lib/aurora/meteors';

// ── getNextMeteorShower ───────────────────────────────────────────────────────

describe('getNextMeteorShower', () => {
  it('returns the next upcoming shower when called before any peak this year', () => {
    // Jan 2 is before Quadrantids peak (Jan 3)
    const result = getNextMeteorShower(new Date('2026-01-02T00:00:00Z'));
    expect(result).not.toBeNull();
    expect(result!.shower.name).toBe('Quadrantids');
    expect(result!.peakDate.getFullYear()).toBe(2026);
  });

  it('skips peaks already passed this year and returns the next one', () => {
    // Jan 4 is after Quadrantids; next should be Lyrids (Apr 22)
    const result = getNextMeteorShower(new Date('2026-01-04T12:00:00Z'));
    expect(result!.shower.name).toBe('Lyrids');
  });

  it('returns the first next-year shower when all this-year peaks have passed', () => {
    // Dec 31: all showers for the year have passed; wraps to next year's Quadrantids
    const result = getNextMeteorShower(new Date('2026-12-31T00:00:00Z'));
    expect(result).not.toBeNull();
    expect(result!.shower.name).toBe('Quadrantids');
    expect(result!.peakDate.getFullYear()).toBe(2027);
  });

  it('returns a shower with the correct peakDate month and day', () => {
    // Just before Perseids peak (Aug 12)
    const result = getNextMeteorShower(new Date('2026-08-11T00:00:00Z'));
    expect(result!.shower.name).toBe('Perseids');
    expect(result!.peakDate.getMonth()).toBe(7); // August (0-indexed)
    expect(result!.peakDate.getDate()).toBe(12);
  });
});

// ── formatMeteorPeak ──────────────────────────────────────────────────────────

describe('formatMeteorPeak', () => {
  it('formats a single-day peak with year', () => {
    const shower: MeteorShower = { name: 'Test', peakMonth: 4, peakDay: 22, description: '', activityLevel: '' };
    const date = new Date(2026, 3, 22); // Apr 22 2026
    expect(formatMeteorPeak(date, shower)).toBe('April 22, 2026');
  });

  it('formats a same-month multi-day range (e.g. Perseids Aug 12–13)', () => {
    const shower: MeteorShower = {
      name: 'Perseids', peakMonth: 8, peakDay: 12,
      peakEndMonth: 8, peakEndDay: 13,
      description: '', activityLevel: '',
    };
    const date = new Date(2026, 7, 12); // Aug 12 2026
    const result = formatMeteorPeak(date, shower);
    expect(result).toBe('August 12–13, 2026');
  });

  it('formats a cross-month multi-day range (e.g. Nov 28 – Dec 2)', () => {
    const shower: MeteorShower = {
      name: 'Hypothetical', peakMonth: 11, peakDay: 28,
      peakEndMonth: 12, peakEndDay: 2,
      description: '', activityLevel: '',
    };
    const date = new Date(2026, 10, 28); // Nov 28 2026
    const result = formatMeteorPeak(date, shower);
    expect(result).toContain('November 28');
    expect(result).toContain('December 2');
    expect(result).toContain('2026');
  });
});

// ── createGoogleCalendarLink ──────────────────────────────────────────────────

describe('createGoogleCalendarLink', () => {
  const shower: MeteorShower = {
    name: 'Perseids', peakMonth: 8, peakDay: 12,
    peakEndMonth: 8, peakEndDay: 13,
    description: 'A great shower.', activityLevel: 'High',
  };
  const date = new Date(2026, 7, 12);

  it('returns a Google Calendar URL', () => {
    const url = createGoogleCalendarLink(shower, date);
    expect(url).toContain('calendar.google.com');
    expect(url).toContain('action=TEMPLATE');
  });

  it('encodes the shower name in the URL', () => {
    const url = createGoogleCalendarLink(shower, date);
    expect(url).toContain(encodeURIComponent('Meteor Shower Peak: Perseids'));
  });

  it('sets a 2-day span when peakEndDay is present', () => {
    const url = createGoogleCalendarLink(shower, date);
    // start=20260812, end=20260814 (2-day span)
    expect(url).toContain('20260812');
    expect(url).toContain('20260814');
  });

  it('sets a 1-day span when peakEndDay is absent', () => {
    const singleDay: MeteorShower = { name: 'Lyrids', peakMonth: 4, peakDay: 22, description: '', activityLevel: '' };
    const d = new Date(2026, 3, 22);
    const url = createGoogleCalendarLink(singleDay, d);
    expect(url).toContain('20260422');
    expect(url).toContain('20260423'); // 1-day span → end is next day
  });
});
