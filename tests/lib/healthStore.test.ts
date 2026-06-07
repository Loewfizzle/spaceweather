import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { DataSource } from '../../lib/utils/retry'

// The health store lives in module-level state inside retry.ts.
// Re-importing a fresh module before each test guarantees an empty store.
type RetryModule = typeof import('../../lib/utils/retry')
let m: RetryModule

beforeEach(async () => {
  vi.resetModules()
  vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
  m = await import('../../lib/utils/retry')
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── recordDataSuccess ────────────────────────────────────────────────────────

describe('recordDataSuccess', () => {
  it('creates a record with lastSuccess set', () => {
    const before = Date.now()
    m.recordDataSuccess('kp')
    const record = m.getDataHealth().get('kp')!
    expect(record).toBeDefined()
    expect(record.lastSuccess).toBeGreaterThanOrEqual(before)
  })

  it('sets consecutiveErrors to 0', () => {
    m.recordDataSuccess('kp')
    expect(m.getDataHealth().get('kp')!.consecutiveErrors).toBe(0)
  })

  it('resets consecutiveErrors to 0 after prior errors', () => {
    m.logDataError('test', new Error('err'), undefined, false, 'kp')
    m.logDataError('test2', new Error('err2'), undefined, false, 'kp')
    expect(m.getDataHealth().get('kp')!.consecutiveErrors).toBe(2)
    m.recordDataSuccess('kp')
    expect(m.getDataHealth().get('kp')!.consecutiveErrors).toBe(0)
  })

  it('preserves errorCount when resetting consecutiveErrors', () => {
    m.logDataError('test', new Error('e'), undefined, false, 'ovation')
    m.logDataError('test', new Error('e2'), undefined, false, 'ovation')
    m.recordDataSuccess('ovation')
    const rec = m.getDataHealth().get('ovation')!
    expect(rec.errorCount).toBe(2)       // cumulative total unchanged
    expect(rec.consecutiveErrors).toBe(0) // streak reset
  })
})

// ─── logDataError ─────────────────────────────────────────────────────────────

describe('logDataError', () => {
  it('creates a record and increments errorCount and consecutiveErrors', () => {
    m.logDataError('ctx', new Error('boom'), undefined, false, 'plasma')
    const rec = m.getDataHealth().get('plasma')!
    expect(rec.errorCount).toBe(1)
    expect(rec.consecutiveErrors).toBe(1)
  })

  it('accumulates consecutive errors on repeated calls', () => {
    m.logDataError('ctx', new Error('e1'), undefined, false, 'mag')
    m.logDataError('ctx', new Error('e2'), undefined, false, 'mag')
    m.logDataError('ctx', new Error('e3'), undefined, false, 'mag')
    expect(m.getDataHealth().get('mag')!.consecutiveErrors).toBe(3)
    expect(m.getDataHealth().get('mag')!.errorCount).toBe(3)
  })

  it('stores the error message', () => {
    m.logDataError('ctx', new Error('fetch failed'), undefined, false, 'kp-forecast')
    expect(m.getDataHealth().get('kp-forecast')!.lastErrorMessage).toBe('fetch failed')
  })

  it('truncates error messages to 200 characters', () => {
    const long = 'x'.repeat(300)
    m.logDataError('ctx', new Error(long), undefined, false, 'alerts')
    expect(m.getDataHealth().get('alerts')!.lastErrorMessage).toHaveLength(200)
  })

  it('sets lastError timestamp', () => {
    const before = Date.now()
    m.logDataError('ctx', new Error('e'), undefined, false, 'fireballs')
    expect(m.getDataHealth().get('fireballs')!.lastError).toBeGreaterThanOrEqual(before)
  })

  it('handles non-Error values as strings', () => {
    m.logDataError('ctx', 'plain string error', undefined, false, 'cloud-cover')
    expect(m.getDataHealth().get('cloud-cover')!.lastErrorMessage).toBe('plain string error')
  })

  it('does not create a health record when source is omitted', () => {
    m.logDataError('ctx', new Error('no source'))
    expect(m.getDataHealth().size).toBe(0)
  })
})

// ─── getDataHealth ────────────────────────────────────────────────────────────

describe('getDataHealth', () => {
  it('returns an empty map when no sources have been touched', () => {
    expect(m.getDataHealth().size).toBe(0)
  })

  it('returns all sources that have been touched', () => {
    m.recordDataSuccess('kp')
    m.logDataError('ctx', new Error('e'), undefined, false, 'ovation')
    const health = m.getDataHealth()
    expect(health.has('kp')).toBe(true)
    expect(health.has('ovation')).toBe(true)
    expect(health.size).toBe(2)
  })
})

// ─── getOverallHealthStatus ───────────────────────────────────────────────────

describe('getOverallHealthStatus', () => {
  it('returns healthy when the store is empty', () => {
    expect(m.getOverallHealthStatus()).toBe('healthy')
  })

  it('returns healthy when all sources have consecutiveErrors = 0', () => {
    m.recordDataSuccess('kp')
    m.recordDataSuccess('plasma')
    expect(m.getOverallHealthStatus()).toBe('healthy')
  })

  it('returns degraded when a non-critical source has 1 consecutive error', () => {
    m.logDataError('ctx', new Error('e'), undefined, false, 'plasma')
    expect(m.getOverallHealthStatus()).toBe('degraded')
  })

  it('returns degraded when a critical source has exactly 1 consecutive error', () => {
    m.logDataError('ctx', new Error('e'), undefined, false, 'kp')
    expect(m.getOverallHealthStatus()).toBe('degraded')
  })

  it('returns down when a critical source has 2+ consecutive errors', () => {
    m.logDataError('ctx', new Error('e1'), undefined, false, 'kp')
    m.logDataError('ctx2', new Error('e2'), undefined, false, 'kp')
    expect(m.getOverallHealthStatus()).toBe('down')
  })

  it('returns down when ovation (critical) has 2+ consecutive errors', () => {
    m.logDataError('ctx', new Error('e1'), undefined, false, 'ovation')
    m.logDataError('ctx', new Error('e2'), undefined, false, 'ovation')
    expect(m.getOverallHealthStatus()).toBe('down')
  })

  it('non-critical source with 2+ errors is degraded, not down', () => {
    m.logDataError('ctx', new Error('e1'), undefined, false, 'plasma')
    m.logDataError('ctx', new Error('e2'), undefined, false, 'plasma')
    expect(m.getOverallHealthStatus()).toBe('degraded')
  })

  it('returns healthy after recordDataSuccess resets a critical source', () => {
    m.logDataError('ctx', new Error('e1'), undefined, false, 'kp')
    m.logDataError('ctx', new Error('e2'), undefined, false, 'kp')
    expect(m.getOverallHealthStatus()).toBe('down')
    m.recordDataSuccess('kp')
    expect(m.getOverallHealthStatus()).toBe('healthy')
  })

  it('prefers down over degraded when both conditions exist simultaneously', () => {
    m.logDataError('ctx', new Error('e'), undefined, false, 'plasma') // degraded
    m.logDataError('ctx', new Error('e1'), undefined, false, 'kp')
    m.logDataError('ctx2', new Error('e2'), undefined, false, 'kp')   // down
    expect(m.getOverallHealthStatus()).toBe('down')
  })
})
