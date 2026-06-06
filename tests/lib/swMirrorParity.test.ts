/**
 * SW mirror parity tests
 *
 * The functions parseKpFromTabular and shouldTriggerNotification are inlined
 * verbatim in public/sw.js because service workers cannot import ES modules.
 * These tests enforce that the two copies stay behaviourally identical under
 * every input combination — catching drift before it reaches production.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'
import { parseKpFromTabular } from '../../lib/utils/swKpParsing'
import { shouldTriggerNotification } from '../../lib/utils/swNotifications'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SW_SOURCE = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8')

/**
 * Extract a named function from sw.js by brace-matching and return it as a
 * callable. Throws if the function is not found (itself a test failure signal).
 */
function extractSwFn(name: string): (...args: unknown[]) => unknown {
  const pattern = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{`)
  const m = pattern.exec(SW_SOURCE)
  if (!m) throw new Error(`'${name}' not found in public/sw.js — KEEP IN SYNC comment may be stale`)

  let depth = 0
  let i = m.index
  for (; i < SW_SOURCE.length; i++) {
    if (SW_SOURCE[i] === '{') depth++
    else if (SW_SOURCE[i] === '}') { if (--depth === 0) break }
  }
  const funcText = SW_SOURCE.slice(m.index, i + 1)
  // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
  return eval(`(${funcText})`)
}

const swParseKp = extractSwFn('parseKpFromTabular') as typeof parseKpFromTabular
const swShouldTrigger = extractSwFn('shouldTriggerNotification') as (
  kp: number | null,
  prefs: { kp: number; prob: number },
  bz: number | null,
  maxProb: number | null
) => boolean

// ── parseKpFromTabular ────────────────────────────────────────────────────────

const VALID_KP_TABLE = [
  ['time_tag', 'Kp', 'status'],
  ['2024-01-15 06:00:00', '3.00', 'official'],
  ['2024-01-15 09:00:00', '5.33', 'official'],
]

describe('parseKpFromTabular — TS and SW behavior match', () => {
  const cases: [string, unknown][] = [
    ['null for undefined',   undefined],
    ['null for null',        null],
    ['null for empty array', []],
    ['null for single-row (header only)', [['time_tag', 'Kp']]],
    ['null for non-array header row',     [42, ['2024-01-15', '3.00']]],
    ['null when Kp column absent',        [['time_tag', 'speed'], ['2024-01-15', '450']]],
    ['null for NaN Kp value',             [['Kp'], ['bad']]],
    ['parses last row Kp correctly',      VALID_KP_TABLE],
    ['returns 0 for "0.00"',              [['Kp'], ['0.00']]],
    ['handles large Kp (9)',              [['Kp'], ['9.00']]],
  ]

  for (const [label, input] of cases) {
    it(label, () => {
      expect(swParseKp(input)).toBe(parseKpFromTabular(input))
    })
  }

  it('SW returns the same value as TS for a realistic multi-row table', () => {
    expect(swParseKp(VALID_KP_TABLE)).toBe(parseKpFromTabular(VALID_KP_TABLE))
    expect(swParseKp(VALID_KP_TABLE)).toBeCloseTo(5.33)
  })
})

// ── shouldTriggerNotification ─────────────────────────────────────────────────

const PREFS = { kp: 4, prob: 15 }

describe('shouldTriggerNotification — TS and SW behavior match', () => {
  const cases: [string, [number | null, typeof PREFS, number | null, number | null]][] = [
    ['false when kp is null',                    [null,  PREFS, null,  null]],
    ['false when nothing meets threshold',        [2,     PREFS, -2,   5]],
    ['true when kp meets threshold',              [4,     PREFS, null, null]],
    ['true when kp exceeds threshold',            [7,     PREFS, null, null]],
    ['true when maxProb meets threshold',         [1,     PREFS, null, 15]],
    ['true when maxProb exceeds threshold',       [1,     PREFS, null, 80]],
    ['true when bz is exactly -5',                [1,     PREFS, -5,   null]],
    ['true when bz is strongly negative',         [1,     PREFS, -12,  null]],
    ['false when bz is -4 (above cutoff)',        [2,     PREFS, -4,   5]],
    ['true when all three conditions are met',    [5,     PREFS, -8,   20]],
    ['false when kp=0, prob=0, bz=0',            [0,     PREFS, 0,    0]],
  ]

  for (const [label, args] of cases) {
    it(label, () => {
      expect(swShouldTrigger(...args)).toBe(shouldTriggerNotification(...args))
    })
  }
})
