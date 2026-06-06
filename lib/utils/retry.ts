/**
 * Shared retry, resilience, and observability utilities for AuroraWatch.
 *
 * Single source of truth for:
 *   - TanStack Query retry predicates + exponential backoff
 *   - Structured error logging with production throttling  (logDataError)
 *   - Per-source data health tracking                      (recordDataSuccess, getDataHealth)
 *   - Vercel Analytics error event forwarding (prod only)
 */

export const CRITICAL_RETRY_COUNT = 5;
export const NON_CRITICAL_RETRY_COUNT = 2;
export const MAX_RETRY_DELAY_MS = 30_000; // 30 s cap

// ─── Retry predicates and backoff ────────────────────────────────────────────

/**
 * Exponential backoff with jitter.
 * Matches TanStack Query's retryDelay signature: (attemptIndex, error) => ms.
 * Formula: min(base × 2^attempt, max) + random 0–1 s jitter
 */
export function exponentialBackoff(
  attemptIndex: number,
  _error?: unknown,
  baseMs = 1_000
): number {
  const exp = Math.min(baseMs * Math.pow(2, attemptIndex), MAX_RETRY_DELAY_MS);
  return Math.floor(exp + Math.random() * 1_000);
}

/**
 * Retry predicate for critical sources (Kp, OVATION).
 * Gives up immediately on 4xx and Zod / parse failures — those are data-shape
 * issues, not transient network problems.
 */
export function shouldRetryCritical(failureCount: number, error: unknown): boolean {
  if (failureCount >= CRITICAL_RETRY_COUNT) return false;
  const msg = error instanceof Error ? error.message : String(error);
  if (/\b4\d\d\b/.test(msg) || msg.includes('parse') || msg.includes('Zod')) return false;
  return true;
}

/** Lighter retry budget for enhancement / non-critical data. */
export function shouldRetryNonCritical(failureCount: number, error: unknown): boolean {
  if (failureCount >= NON_CRITICAL_RETRY_COUNT) return false;
  const msg = error instanceof Error ? error.message : String(error);
  if (/\b4\d\d\b/.test(msg) || msg.includes('parse') || msg.includes('Zod')) return false;
  return true;
}

// ─── Data source health types ─────────────────────────────────────────────────

/** Every external data source tracked by the dashboard. */
export type DataSource =
  | 'kp'
  | 'ovation'
  | 'plasma'
  | 'mag'
  | 'kp-forecast'
  | 'xray-flares'
  | 'alerts'
  | 'solar-regions'
  | 'fireballs'
  | 'cloud-cover';

/** Aggregate health rolled up from all tracked sources. */
export type HealthStatus = 'healthy' | 'degraded' | 'down';

/** Health snapshot for one data source. */
export interface DataHealthRecord {
  source: DataSource;
  /** Epoch ms of the last successful fetch + parse; null if never succeeded this session. */
  lastSuccess: number | null;
  /** Epoch ms of the most recent error; null if never errored this session. */
  lastError: number | null;
  /** Total errors recorded this session. */
  errorCount: number;
  /** Consecutive errors since the last success; reset to 0 by recordDataSuccess(). */
  consecutiveErrors: number;
  /** Truncated message from the most recent error (≤ 200 chars). */
  lastErrorMessage: string | null;
}

// Sources where ≥ 2 consecutive failures escalate status to 'down' rather than 'degraded'
const CRITICAL_SOURCES: ReadonlySet<DataSource> = new Set(['kp', 'ovation']);

// ─── In-memory health store ───────────────────────────────────────────────────

// Module-level singleton — one per JS context (client page session or server request).
const healthStore = new Map<DataSource, DataHealthRecord>();

function getOrCreate(source: DataSource): DataHealthRecord {
  if (!healthStore.has(source)) {
    healthStore.set(source, {
      source,
      lastSuccess: null,
      lastError: null,
      errorCount: 0,
      consecutiveErrors: 0,
      lastErrorMessage: null,
    });
  }
  return healthStore.get(source)!;
}

/**
 * Dispatch a lightweight custom DOM event so DataStatus can re-render immediately
 * without polling. No-op in server / non-browser environments.
 */
function notifyHealthChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('aurorawatch:health'));
  }
}

// ─── Public health API ────────────────────────────────────────────────────────

/**
 * Call this after each successful data fetch to reset the consecutive-error counter
 * and timestamp the last known-good state for a source.
 * Triggers an immediate DataStatus re-render via the 'aurorawatch:health' DOM event.
 */
export function recordDataSuccess(source: DataSource): void {
  const record = getOrCreate(source);
  record.lastSuccess = Date.now();
  record.consecutiveErrors = 0;
  healthStore.set(source, record);
  notifyHealthChange();
}

/** Returns a read-only snapshot of all tracked health records. */
export function getDataHealth(): ReadonlyMap<DataSource, DataHealthRecord> {
  return healthStore;
}

/**
 * Derives an overall health status across all tracked sources:
 * - 'down'     — a critical source (Kp, OVATION) has ≥ 2 consecutive errors
 * - 'degraded' — any source has ≥ 1 consecutive error
 * - 'healthy'  — no consecutive errors among currently tracked sources
 */
export function getOverallHealthStatus(): HealthStatus {
  const records = Array.from(healthStore.values());
  if (records.length === 0) return 'healthy';

  if (records.some((r) => CRITICAL_SOURCES.has(r.source) && r.consecutiveErrors >= 2)) {
    return 'down';
  }
  if (records.some((r) => r.consecutiveErrors >= 1)) return 'degraded';
  return 'healthy';
}

// ─── Structured error logger ──────────────────────────────────────────────────

// Throttle map: keyed on context + error-message prefix to suppress prod log spam.
const loggedErrors = new Map<string, number>();
const LOG_THROTTLE_MS = 5 * 60 * 1_000; // 5 minutes

type VAFunction = (cmd: string, opts: Record<string, unknown>) => void;

/**
 * Structured error logger — the single entry point for all data-fetch errors.
 *
 * On every call it:
 *   1. Updates the in-memory health store for the given source (if provided).
 *   2. Logs to the console (always in dev; throttled once per 5 min in prod).
 *   3. Forwards a 'data_error' event to Vercel Analytics (prod + browser only).
 *
 * @param context    Human-readable label, e.g. "KpIndex parse", "OVATION fetch"
 * @param error      The caught error or unknown value
 * @param queryKey   Optional diagnostic context (e.g. `{ url }`)
 * @param isCritical Prefixes the log with 🚨 to signal a user-visible failure
 * @param source     Data source identifier; drives health-store updates
 */
export function logDataError(
  context: string,
  error: unknown,
  queryKey?: unknown,
  isCritical = false,
  source?: DataSource
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // 1. Health store update
  if (source) {
    const record = getOrCreate(source);
    record.lastError = Date.now();
    record.errorCount += 1;
    record.consecutiveErrors += 1;
    record.lastErrorMessage = errorMessage.substring(0, 200);
    healthStore.set(source, record);
    notifyHealthChange();
  }

  // 2. Throttled console log (dev: always; prod: once per 5 min per unique error)
  const key = `${context}:${errorMessage.substring(0, 100)}`;
  const now = Date.now();
  const lastLogged = loggedErrors.get(key) ?? 0;
  const shouldLog =
    process.env.NODE_ENV === 'development' || now - lastLogged > LOG_THROTTLE_MS;

  if (shouldLog) {
    loggedErrors.set(key, now);

    const prefix = isCritical ? '🚨 [CRITICAL DATA]' : '⚠️ [DATA]';
    console.groupCollapsed(`${prefix} ${context}`);
    console.error('Error:', error);
    if (queryKey) console.info('Query key:', queryKey);
    if (source)   console.info('Source:', source);
    console.info('Time:', new Date().toISOString());
    console.groupEnd();

    // 3. Vercel Analytics — fire-and-forget; never throw
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      try {
        (window as Window & { va?: VAFunction }).va?.('event', {
          name: 'data_error',
          source: source ?? 'unknown',
          context,
          is_critical: String(isCritical),
          error_type: error instanceof Error ? error.constructor.name : 'unknown',
        });
      } catch {
        // Analytics failures must never surface to the user
      }
    }
  }
}
