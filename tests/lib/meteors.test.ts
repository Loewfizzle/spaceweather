import { describe, it, expect } from 'vitest';
import {
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  createIcsContent,
  icsFileName,
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

// ── createIcsContent ──────────────────────────────────────────────────────────

describe('createIcsContent', () => {
  const shower: MeteorShower = {
    name: 'Perseids', peakMonth: 8, peakDay: 12,
    peakEndMonth: 8, peakEndDay: 13,
    description: 'A great shower.', activityLevel: 'High',
  };
  const date = new Date(2026, 7, 12);
  const now = new Date('2026-06-11T20:00:00Z'); // injected for deterministic DTSTAMP

  it('produces a structurally valid VCALENDAR with one VEVENT', () => {
    const ics = createIcsContent(shower, date, now);
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
  });

  it('uses CRLF line endings throughout (RFC 5545)', () => {
    const ics = createIcsContent(shower, date, now);
    // No bare LF: every \n must be preceded by \r
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('sets all-day DTSTART/DTEND with a 2-day span for multi-night peaks', () => {
    const ics = createIcsContent(shower, date, now);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260812');
    expect(ics).toContain('DTEND;VALUE=DATE:20260814'); // exclusive end
  });

  it('sets a 1-day span when peakEndDay is absent', () => {
    const singleDay: MeteorShower = { name: 'Lyrids', peakMonth: 4, peakDay: 22, description: '', activityLevel: '' };
    const ics = createIcsContent(singleDay, new Date(2026, 3, 22), now);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260422');
    expect(ics).toContain('DTEND;VALUE=DATE:20260423');
  });

  it('includes the shower name in SUMMARY', () => {
    const ics = createIcsContent(shower, date, now);
    expect(ics).toContain('SUMMARY:Meteor Shower Peak: Perseids');
  });

  it('formats DTSTAMP as a UTC timestamp from the injected now', () => {
    const ics = createIcsContent(shower, date, now);
    expect(ics).toContain('DTSTAMP:20260611T200000Z');
  });

  it('generates a deterministic UID from shower and year', () => {
    const ics = createIcsContent(shower, date, now);
    expect(ics).toContain('UID:perseids-2026@skyglow.app');
  });

  it('escapes commas and newlines in DESCRIPTION text', () => {
    const tricky: MeteorShower = {
      name: 'Test', peakMonth: 4, peakDay: 22,
      description: 'Fast, bright; reliable.', activityLevel: 'High',
    };
    const ics = createIcsContent(tricky, new Date(2026, 3, 22), now);
    // Unfold first (RFC 5545: CRLF + space is a fold), as a real parser would —
    // folding may split an escape sequence across physical lines
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('Fast\\, bright\\; reliable.');
    // Real newlines in the description become literal \n sequences
    expect(unfolded).toContain('\\n\\nExpected activity');
  });

  it('folds long lines to at most 75 octets followed by a space continuation', () => {
    const ics = createIcsContent(shower, date, now);
    const physicalLines = ics.split('\r\n');
    for (const line of physicalLines) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // The long DESCRIPTION must actually have been folded
    expect(ics).toMatch(/\r\n [^\r\n]/);
  });
});

// ── icsFileName ───────────────────────────────────────────────────────────────

describe('icsFileName', () => {
  it('builds a slugged filename with the peak year', () => {
    const shower: MeteorShower = { name: 'Perseids', peakMonth: 8, peakDay: 12, description: '', activityLevel: '' };
    expect(icsFileName(shower, new Date(2026, 7, 12))).toBe('perseids-2026-peak.ics');
  });

  it('slugs multi-word shower names', () => {
    const shower: MeteorShower = { name: 'Eta Aquariids', peakMonth: 5, peakDay: 5, description: '', activityLevel: '' };
    expect(icsFileName(shower, new Date(2027, 4, 5))).toBe('eta-aquariids-2027-peak.ics');
  });
});
