// Pure notification trigger logic — shared between tests and the SW.
// SW can't import modules, so the same logic is inlined in public/sw.js.
// If you change this function, mirror the change there too.

export interface NotificationPrefs {
  kp: number;
  prob: number;
}

/**
 * Returns true if any triggering condition is met.
 * Mirrors the multi-factor check in checkAurora() in public/sw.js.
 */
export function shouldTriggerNotification(
  kp: number | null,
  prefs: NotificationPrefs,
  cachedBz: number | null,
  cachedMaxProb: number | null
): boolean {
  if (kp === null) return false;
  const kpHit   = kp >= prefs.kp;
  const probHit = cachedMaxProb !== null && cachedMaxProb >= prefs.prob;
  const bzHit   = cachedBz !== null && cachedBz <= -5;
  return kpHit || probHit || bzHit;
}
