/**
 * Shared retry and resilience utilities for TanStack Query data fetching.
 * Critical data (Kp, OVATION) gets aggressive retries + backoff.
 * Non-critical gets lighter treatment.
 */

import type { Query } from '@tanstack/react-query';

export const CRITICAL_RETRY_COUNT = 5;
export const NON_CRITICAL_RETRY_COUNT = 2;

export const MAX_RETRY_DELAY_MS = 30_000; // 30 seconds cap

/**
 * Exponential backoff with jitter for retryDelay.
 * Matches TanStack Query's expected signature: (attemptIndex: number, error: Error) => number
 * Formula: min( base * 2^attempt , max ) + random jitter
 */
export function exponentialBackoff(attemptIndex: number, _error?: unknown, baseMs = 1000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attemptIndex), MAX_RETRY_DELAY_MS);
  const jitter = Math.random() * 1000; // up to 1s jitter
  return Math.floor(exponential + jitter);
}

/**
 * Retry predicate for critical data sources.
 * Retries on network errors, 5xx, timeouts, but not client errors (4xx) or Zod parse errors (data shape issues).
 */
export function shouldRetryCritical(failureCount: number, error: unknown): boolean {
  if (failureCount >= CRITICAL_RETRY_COUNT) return false;

  const message = error instanceof Error ? error.message : String(error);

  // Don't retry client errors or validation failures (data is bad, not transient)
  if (message.includes('4') || message.includes('parse') || message.includes('Zod')) {
    return false;
  }

  // Retry on network, 5xx, timeouts, etc.
  return true;
}

/**
 * Lighter retry for non-critical (enhancement) data.
 */
export function shouldRetryNonCritical(failureCount: number, error: unknown): boolean {
  if (failureCount >= NON_CRITICAL_RETRY_COUNT) return false;

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('4') || message.includes('parse') || message.includes('Zod')) {
    return false;
  }

  return true;
}

/**
 * Structured error logger for data fetches.
 * In dev: always logs with context.
 * In prod: throttled (once per unique error type per 5 minutes) to avoid spam.
 */
const loggedErrors = new Map<string, number>();
const LOG_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export function logDataError(
  context: string,
  error: unknown,
  queryKey?: unknown,
  isCritical = false
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const key = `${context}:${errorMessage.substring(0, 100)}`; // key on context + message prefix

  const now = Date.now();
  const lastLogged = loggedErrors.get(key) || 0;

  const shouldLog =
    process.env.NODE_ENV === 'development' ||
    (isCritical && now - lastLogged > LOG_THROTTLE_MS);

  if (shouldLog) {
    loggedErrors.set(key, now);

    const prefix = isCritical ? '🚨 [CRITICAL DATA]' : '⚠️ [DATA]';
    console.groupCollapsed(`${prefix} ${context}`);
    console.error('Error:', error);
    if (queryKey) console.info('Query Key:', queryKey);
    console.info('Time:', new Date().toISOString());
    console.groupEnd();
  }
}

/**
 * Helper to attach consistent meta for debugging (used in query options if desired).
 */
export function dataQueryMeta(isCritical: boolean) {
  return {
    isCriticalData: isCritical,
    dataLayer: 'noaa-swpc',
  };
}
