// lib/noaa.ts — re-export barrel (do not delete)
// Pure business logic for AuroraWatch, split into focused modules under lib/aurora/.
// This barrel keeps all existing imports working without changes.

export * from './aurora/ovation';
export * from './aurora/kp';
export * from './aurora/outlook';
export * from './aurora/solar';
export * from './aurora/location';
export * from './aurora/meteors';
export * from './aurora/fireballs';

// Kept in barrel — used by use-noaa-data.ts and other hooks directly.
export function latest<T extends { time_tag?: string | null }>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[arr.length - 1];
}
