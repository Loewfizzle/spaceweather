// Alert threshold presets — used by the hook, AlertsPanel, and NotificationPrompt.
// Defined here (not in the hook) so non-hook contexts can read thresholds without
// mounting the full hook.
export const ALERT_THRESHOLDS = {
  sensitive: { kp: 3, prob: 10 },
  balanced:  { kp: 4, prob: 15 },
  strong:    { kp: 5, prob: 25 },
} as const;

export type AlertSensitivity = "sensitive" | "balanced" | "strong";

export const PRESETS: { key: AlertSensitivity; label: string; desc: string }[] = [
  { key: "sensitive", label: "Any",      desc: "Kp ≥3 or 10%" },
  { key: "balanced",  label: "Moderate", desc: "Kp ≥4 or 15%" },
  { key: "strong",    label: "Strong",   desc: "Kp ≥5 or 25%" },
];

// ── Preference loaders (SSR-safe: return defaults when window is unavailable) ─

export function loadAlertsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem("aw_alerts_enabled");
  return v === null ? true : v === "1";
}

export function loadAlertSensitivity(): AlertSensitivity {
  if (typeof window === "undefined") return "balanced";
  const v = localStorage.getItem("aw_alert_sensitivity") as AlertSensitivity | null;
  return v === "sensitive" || v === "strong" ? v : "balanced";
}

export function loadLastNotified(): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem("aw_last_notified");
  return stored ? parseInt(stored, 10) : 0;
}

// ── Preference writers ────────────────────────────────────────────────────────

export function saveAlertsEnabled(val: boolean): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("aw_alerts_enabled", val ? "1" : "0");
  }
}

export function saveLastNotified(now: number): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("aw_last_notified", now.toString());
  }
}

/**
 * Persists the chosen sensitivity to localStorage + SW cache, and notifies all
 * useNotifications instances in this tab via a custom event so their React state
 * stays in sync when the value is written outside the hook (e.g. NotificationPrompt).
 *
 * Exported as a standalone async function so non-hook contexts can persist prefs
 * without mounting the full hook.
 */
export async function saveSensitivity(val: AlertSensitivity): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem("aw_alert_sensitivity", val);
    window.dispatchEvent(new CustomEvent("skyglow:sensitivity-changed", { detail: val }));
  }
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const { kp, prob } = ALERT_THRESHOLDS[val];
      const cache = await caches.open("skyglow-sw-v1");
      await cache.put("/__prefs", new Response(JSON.stringify({ kp, prob })));
    } catch {
      // Cache API unavailable (private browsing, etc.) — non-fatal
    }
  }
}
