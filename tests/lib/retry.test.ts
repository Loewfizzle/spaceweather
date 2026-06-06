import { describe, it, expect } from 'vitest'
import {
  shouldRetryCritical,
  shouldRetryNonCritical,
  exponentialBackoff,
  MAX_RETRY_DELAY_MS,
  CRITICAL_RETRY_COUNT,
  NON_CRITICAL_RETRY_COUNT,
} from '../../lib/utils/retry'

// ============================================
// shouldRetryCritical
// ============================================
describe('shouldRetryCritical', () => {
  it('returns false at exactly the retry limit', () => {
    expect(shouldRetryCritical(CRITICAL_RETRY_COUNT, new Error('network'))).toBe(false)
  })

  it('returns true one attempt before the limit', () => {
    expect(shouldRetryCritical(CRITICAL_RETRY_COUNT - 1, new Error('network'))).toBe(true)
  })

  it('retries on 5xx server errors', () => {
    expect(shouldRetryCritical(0, new Error('Failed to fetch: 503 Service Unavailable'))).toBe(true)
    expect(shouldRetryCritical(0, new Error('500 Internal Server Error'))).toBe(true)
  })

  it('retries on generic network / timeout errors', () => {
    expect(shouldRetryCritical(0, new Error('NetworkError when attempting to fetch resource'))).toBe(true)
    expect(shouldRetryCritical(0, new Error('Failed to fetch'))).toBe(true)
    expect(shouldRetryCritical(0, new Error('The operation was aborted'))).toBe(true)
  })

  it('does NOT retry on 4xx client errors', () => {
    expect(shouldRetryCritical(0, new Error('Failed to fetch url: 404 Not Found'))).toBe(false)
    expect(shouldRetryCritical(0, new Error('401 Unauthorized'))).toBe(false)
    expect(shouldRetryCritical(0, new Error('400 Bad Request'))).toBe(false)
    expect(shouldRetryCritical(0, new Error('403 Forbidden'))).toBe(false)
  })

  it('does NOT retry on Zod parse errors', () => {
    expect(shouldRetryCritical(0, new Error('ZodError: invalid schema'))).toBe(false)
    expect(shouldRetryCritical(0, new Error('Failed to parse response'))).toBe(false)
  })

  it('handles non-Error objects gracefully', () => {
    expect(shouldRetryCritical(0, 'string error')).toBe(true)
    expect(shouldRetryCritical(0, { code: 500 })).toBe(true)
  })

  it('uses word-boundary matching so "4" in other contexts does not block retry', () => {
    // "4" on its own, not as part of a 3-digit 4xx code, should not prevent retry
    expect(shouldRetryCritical(0, new Error('fetch attempt 4 failed'))).toBe(true)
  })
})

// ============================================
// shouldRetryNonCritical
// ============================================
describe('shouldRetryNonCritical', () => {
  it('returns false at the non-critical limit', () => {
    expect(shouldRetryNonCritical(NON_CRITICAL_RETRY_COUNT, new Error('network'))).toBe(false)
  })

  it('retries network errors within the limit', () => {
    expect(shouldRetryNonCritical(0, new Error('NetworkError'))).toBe(true)
    expect(shouldRetryNonCritical(1, new Error('NetworkError'))).toBe(true)
  })

  it('does NOT retry 4xx errors', () => {
    expect(shouldRetryNonCritical(0, new Error('404 Not Found'))).toBe(false)
  })

  it('does NOT retry parse/Zod errors', () => {
    expect(shouldRetryNonCritical(0, new Error('Zod parse failed'))).toBe(false)
  })
})

// ============================================
// exponentialBackoff
// ============================================
describe('exponentialBackoff', () => {
  it('returns a positive number for any attempt index', () => {
    for (let i = 0; i <= 20; i++) {
      expect(exponentialBackoff(i)).toBeGreaterThan(0)
    }
  })

  it('never exceeds MAX_RETRY_DELAY_MS + 1000 (jitter ceiling)', () => {
    for (let i = 0; i <= 20; i++) {
      expect(exponentialBackoff(i)).toBeLessThanOrEqual(MAX_RETRY_DELAY_MS + 1000)
    }
  })

  it('attempt 0 starts at ~baseMs (1000ms) plus jitter', () => {
    const d = exponentialBackoff(0)
    expect(d).toBeGreaterThanOrEqual(1000)
    expect(d).toBeLessThanOrEqual(2000)
  })

  it('attempt 2 is at least 4x the base (4000ms)', () => {
    // exponential = min(1000 * 2^2, MAX) = 4000 (well below max); plus jitter
    expect(exponentialBackoff(2)).toBeGreaterThanOrEqual(4000)
  })

  it('caps at MAX_RETRY_DELAY_MS for very high attempt counts', () => {
    // At attempt 20 the exponential far exceeds MAX_RETRY_DELAY_MS
    const d = exponentialBackoff(20)
    expect(d).toBeGreaterThanOrEqual(MAX_RETRY_DELAY_MS)
    expect(d).toBeLessThanOrEqual(MAX_RETRY_DELAY_MS + 1000)
  })

  it('accepts a custom baseMs', () => {
    const d = exponentialBackoff(0, undefined, 500)
    expect(d).toBeGreaterThanOrEqual(500)
    expect(d).toBeLessThanOrEqual(1500)
  })
})
