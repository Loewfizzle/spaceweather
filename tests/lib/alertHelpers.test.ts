import { describe, it, expect, vi, afterEach } from 'vitest'
import { alertProductLabel, alertFirstLine, formatAlertAge } from '../../lib/utils/alertHelpers'

afterEach(() => vi.useRealTimers())

// ============================================
// alertProductLabel
// ============================================
describe('alertProductLabel', () => {
  // K-index alerts — live NOAA format is "K05A", "K04A", etc.
  // This was a real bug: old code only matched "ALTK*" and missed all live K-index alerts.
  it('matches live NOAA K-index format (K05A, K04A, K12Z)', () => {
    expect(alertProductLabel('K05A')).toEqual({ text: 'K-index Alert', color: '#eab308' })
    expect(alertProductLabel('K04A')).toEqual({ text: 'K-index Alert', color: '#eab308' })
    expect(alertProductLabel('K12Z')).toEqual({ text: 'K-index Alert', color: '#eab308' })
  })

  it('does not match single-digit K with no letter, or bare "K"', () => {
    // K5 (no letter suffix) should fall through to fallback
    expect(alertProductLabel('K5').text).not.toBe('K-index Alert')
    expect(alertProductLabel('K').text).toBe('Notice')
  })

  it('matches legacy ALTK format', () => {
    expect(alertProductLabel('ALTK05')).toEqual({ text: 'K-index Alert', color: '#eab308' })
  })

  it('maps WATA codes to the correct geomagnetic storm watch level', () => {
    expect(alertProductLabel('WATA07')).toEqual({ text: 'Storm Watch G1', color: '#22c55e' })
    expect(alertProductLabel('WATA20')).toEqual({ text: 'Storm Watch G2', color: '#22c55e' })
    expect(alertProductLabel('WATA30')).toEqual({ text: 'Storm Watch G3', color: '#22c55e' })
    expect(alertProductLabel('WATA40')).toEqual({ text: 'Storm Watch G4', color: '#22c55e' })
    expect(alertProductLabel('WATA50')).toEqual({ text: 'Storm Watch G5', color: '#22c55e' })
  })

  it('returns generic Storm Watch for unknown WATA codes', () => {
    expect(alertProductLabel('WATAXX')).toEqual({ text: 'Storm Watch', color: '#22c55e' })
  })

  it('maps ALTTP to Geomagnetic Alert', () => {
    expect(alertProductLabel('ALTTP02').text).toBe('Geomagnetic Alert')
  })

  it('maps WARPT and ALTPX to Radiation Storm', () => {
    expect(alertProductLabel('WARPT01').text).toBe('Radiation Storm')
    expect(alertProductLabel('ALTPX01').text).toBe('Radiation Storm')
  })

  it('maps SUM prefix to NOAA Summary', () => {
    expect(alertProductLabel('SUM99').text).toBe('NOAA Summary')
  })

  it('maps WAR prefix (not WARPT) to Warning', () => {
    expect(alertProductLabel('WARX01').text).toBe('Warning')
  })

  it('maps ALT prefix (not ALTK/ALTTP/ALTPX) to Alert', () => {
    expect(alertProductLabel('ALTXX').text).toBe('Alert')
  })

  it('returns Notice for completely unknown product IDs', () => {
    expect(alertProductLabel('UNKNOWN')).toEqual({ text: 'Notice', color: '#64748b' })
    expect(alertProductLabel('')).toEqual({ text: 'Notice', color: '#64748b' })
  })
})

// ============================================
// alertFirstLine
// ============================================
describe('alertFirstLine', () => {
  it('strips the NOAA header and returns body content after \\r\\n\\r\\n', () => {
    const msg = 'HEADER LINE 1\r\nHEADER LINE 2\r\n\r\nBody text follows here with some content.'
    const result = alertFirstLine(msg)
    expect(result).not.toContain('HEADER')
    expect(result).toContain('Body text')
  })

  it('returns the longest punctuation-terminated segment within 20–140 chars', () => {
    // The regex is greedy: it maximizes the match length.
    // 45-char sentence followed by 200 Xs → regex finds '.' at position 44,
    // returns just the sentence (shorter than body).
    const sentence = 'Solar wind speed elevated at moderate levels.'  // 45 chars
    const result = alertFirstLine(sentence + 'X'.repeat(200))
    expect(result).toBe(sentence)
  })

  it('returns the whole body when the body is short and ends in punctuation', () => {
    // Greedy match covers the entire body string when it fits within 140 chars.
    const body = 'Solar activity was at low levels. No significant events expected.'
    const result = alertFirstLine(body)
    expect(result).toBe(body)
  })

  it('falls back to first 120 chars when no sentence-ending punctuation exists in range', () => {
    // 200 'A's — no '.!?' anywhere → raw = body.slice(0, 120); raw.length < body.length → no ellipsis
    const body = 'A'.repeat(200)
    const result = alertFirstLine(body)
    expect(result).toBe('A'.repeat(120))
  })

  it('returns empty string for empty message', () => {
    expect(alertFirstLine('')).toBe('')
  })

  it('does NOT treat \\n\\n as a header separator (only \\r\\n\\r\\n splits)', () => {
    // If the code incorrectly used \n\n, "HEADER" would be stripped.
    const msg = 'HEADER\n\nBody text follows here.'
    const result = alertFirstLine(msg)
    expect(result).toContain('HEADER')
  })
})

// ============================================
// formatAlertAge
// ============================================
describe('formatAlertAge', () => {
  it('returns the original string for an unparseable datetime', () => {
    expect(formatAlertAge('not-a-date')).toBe('not-a-date')
  })

  it('returns the original string for an empty input', () => {
    expect(formatAlertAge('')).toBe('')
  })

  it('parses NOAA space-separated format and returns a relative time string', () => {
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'))
    // June 5 01:00 UTC is 11 hours before "now"
    const result = formatAlertAge('2026-06-05 01:00:00')
    expect(result).toContain('ago')
  })

  it('handles milliseconds in the NOAA datetime format', () => {
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'))
    const result = formatAlertAge('2026-06-05 01:30:15.893')
    // Should parse, not return as-is
    expect(result).not.toBe('2026-06-05 01:30:15.893')
    expect(result).toContain('ago')
  })

  it('does not double-append Z when the string already ends in Z', () => {
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'))
    // Already ISO with Z — appending another Z would produce an invalid date
    const result = formatAlertAge('2026-06-05T01:00:00Z')
    expect(result).toContain('ago')
    expect(result).not.toBe('2026-06-05T01:00:00Z')
  })

  it('handles already-normalized ISO string with T separator (no Z)', () => {
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'))
    // T already present, no Z — should still get Z appended and parse correctly
    const result = formatAlertAge('2026-06-05T01:00:00')
    expect(result).toContain('ago')
  })
})
