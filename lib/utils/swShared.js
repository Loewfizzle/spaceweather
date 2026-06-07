/**
 * Shared service-worker helpers — plain JavaScript, no ES module imports.
 *
 * This is the single canonical source for parseKpFromTabular and
 * shouldTriggerNotification. It is used in two ways:
 *   1. Imported as ESM by swKpParsing.ts and swNotifications.ts (unit tests).
 *   2. Bundled into public/sw.js via scripts/buildSw.js (esbuild, runs at build time).
 *
 * Edit this file; do not edit public/sw.js or worker/sw.js for these helpers.
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
