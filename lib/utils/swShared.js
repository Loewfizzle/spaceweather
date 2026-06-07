/**
 * Shared service-worker helpers — plain JavaScript, no ES module imports.
 *
 * CANONICAL SOURCE: lib/utils/swShared.js — edit there, not in public/sw.js.
 * An auto-generated copy is inlined into public/sw.js at build time by
 * scripts/inlineSwFunctions.js, because service workers cannot use ES module imports.
 *
 * Also imported as ESM by: swKpParsing.ts, swNotifications.ts.
 */

/**
 * @param {unknown} data
 * @returns {number | null}
 */
export function parseKpFromTabular(data) {
  if (!Array.isArray(data) || data.length < 2) return null;
  const headers = data[0];
  if (!Array.isArray(headers)) return null;
  const kpColIdx = headers.indexOf('Kp');
  if (kpColIdx === -1) return null;
  const lastRow = data[data.length - 1];
  if (!Array.isArray(lastRow)) return null;
  const kp = parseFloat(String(lastRow[kpColIdx]));
  return isNaN(kp) ? null : kp;
}

/**
 * @param {number | null} kp
 * @param {{ kp: number; prob: number }} prefs
 * @param {number | null} cachedBz
 * @param {number | null} cachedMaxProb
 * @returns {boolean}
 */
export function shouldTriggerNotification(kp, prefs, cachedBz, cachedMaxProb) {
  if (kp === null) return false;
  const kpHit   = kp >= prefs.kp;
  const probHit = cachedMaxProb !== null && cachedMaxProb >= prefs.prob;
  const bzHit   = cachedBz !== null && cachedBz <= -5;
  return kpHit || probHit || bzHit;
}
