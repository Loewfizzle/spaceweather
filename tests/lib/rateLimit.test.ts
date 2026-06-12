import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../../lib/utils/rateLimit';

describe('createRateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxHits: 3 });
    expect(limiter.isRateLimited('1.2.3.4', 1000)).toBe(false);
    expect(limiter.isRateLimited('1.2.3.4', 1001)).toBe(false);
    expect(limiter.isRateLimited('1.2.3.4', 1002)).toBe(false);
  });

  it('blocks the request that exceeds the limit within the window', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxHits: 3 });
    limiter.isRateLimited('1.2.3.4', 1000);
    limiter.isRateLimited('1.2.3.4', 1001);
    limiter.isRateLimited('1.2.3.4', 1002);
    expect(limiter.isRateLimited('1.2.3.4', 1003)).toBe(true);
  });

  it('tracks keys independently', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxHits: 1 });
    expect(limiter.isRateLimited('1.1.1.1', 1000)).toBe(false);
    expect(limiter.isRateLimited('1.1.1.1', 1001)).toBe(true);
    // A different key still has its full allowance
    expect(limiter.isRateLimited('2.2.2.2', 1002)).toBe(false);
  });

  it('allows again once hits fall outside the sliding window', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxHits: 2 });
    limiter.isRateLimited('1.2.3.4', 1000);
    limiter.isRateLimited('1.2.3.4', 2000);
    expect(limiter.isRateLimited('1.2.3.4', 3000)).toBe(true);
    // First hit (t=1000) expires at t=61000 — one slot frees up
    expect(limiter.isRateLimited('1.2.3.4', 61_500)).toBe(false);
    expect(limiter.isRateLimited('1.2.3.4', 61_501)).toBe(true);
  });

  it('never limits a null key (no client IP — local dev or tests)', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxHits: 1 });
    for (let i = 0; i < 5; i++) {
      expect(limiter.isRateLimited(null, 1000 + i)).toBe(false);
    }
  });

  it('evicts expired keys when the map exceeds maxKeys, without affecting behavior', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxHits: 2, maxKeys: 1 });
    // Two keys at t=0 — map size now exceeds maxKeys
    limiter.isRateLimited('a', 0);
    limiter.isRateLimited('b', 0);
    // Next call past the window triggers eviction of both expired keys
    expect(limiter.isRateLimited('c', 70_000)).toBe(false);
    // Evicted key has its full allowance back
    expect(limiter.isRateLimited('a', 70_001)).toBe(false);
    expect(limiter.isRateLimited('a', 70_002)).toBe(false);
    expect(limiter.isRateLimited('a', 70_003)).toBe(true);
  });

  it('does not evict keys that are still active within the window', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxHits: 2, maxKeys: 1 });
    limiter.isRateLimited('a', 0);
    limiter.isRateLimited('a', 50_000);
    limiter.isRateLimited('b', 50_000);
    // Eviction sweep runs (size > maxKeys) but 'a' is still active at t=55000
    limiter.isRateLimited('c', 55_000);
    // 'a' kept its history: already at 2 hits, so the next is blocked
    expect(limiter.isRateLimited('a', 55_001)).toBe(true);
  });

  it('uses defaults of 10 hits per 60s window', () => {
    const limiter = createRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(limiter.isRateLimited('1.2.3.4', now + i)).toBe(false);
    }
    expect(limiter.isRateLimited('1.2.3.4', now + 10)).toBe(true);
  });
});
