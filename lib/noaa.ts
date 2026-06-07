// lib/noaa.ts — retained for the latest() utility, which has no natural home
// in a submodule (it's a generic array helper used by multiple hooks).
// All other exports have moved to their respective modules under lib/aurora/.

/** Returns the last element of an array, or null if empty. */
export function latest<T extends { time_tag?: string | null }>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[arr.length - 1];
}
