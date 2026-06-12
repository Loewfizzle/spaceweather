/**
 * Sliding-window in-memory rate limiter for API route handlers.
 *
 * Per-instance only — state resets on serverless cold start, which is
 * acceptable for launch-scale abuse prevention (the goal is stopping rapid
 * hammering of upstream APIs like Nominatim, not precise global quotas).
 */

export interface RateLimiterOptions {
  /** Window length in ms. Default 60s. */
  windowMs?: number;
  /** Max requests allowed per key within the window. Default 10. */
  maxHits?: number;
  /** Map size that triggers eviction of expired keys. Default 1000. */
  maxKeys?: number;
}

export interface RateLimiter {
  /**
   * Records a hit for `key` and reports whether it exceeds the limit.
   * A null key (no client IP available — local dev, tests) is never limited;
   * Vercel always provides x-forwarded-for in production.
   */
  isRateLimited(key: string | null, now?: number): boolean;
}

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const { windowMs = 60_000, maxHits = 10, maxKeys = 1000 } = options;
  const hits = new Map<string, number[]>();

  return {
    isRateLimited(key: string | null, now: number = Date.now()): boolean {
      if (!key) return false;

      // Opportunistic eviction keeps the map bounded on long-lived instances
      if (hits.size > maxKeys) {
        for (const [k, times] of hits) {
          if (now - times[times.length - 1] >= windowMs) hits.delete(k);
        }
      }

      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= maxHits) return true;
      recent.push(now);
      hits.set(key, recent);
      return false;
    },
  };
}
