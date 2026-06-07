"use client";

import { useState, useEffect, useRef } from "react";
import { shouldTriggerNotification } from "../utils/swNotifications";

// Alert threshold presets (module scope for stability + used by effect, handler, and render in AlertsPanel)
export const ALERT_THRESHOLDS = {
  sensitive: { kp: 3, prob: 10 },
  balanced: { kp: 4, prob: 15 },
  strong: { kp: 5, prob: 25 },
} as const;

export type AlertSensitivity = "sensitive" | "balanced" | "strong";

export const PRESETS: { key: AlertSensitivity; label: string; desc: string }[] = [
  { key: "sensitive", label: "Sensitive", desc: "Kp ≥3 or 10%" },
  { key: "balanced",  label: "Balanced",  desc: "Kp ≥4 or 15%" },
  { key: "strong",    label: "Strong only", desc: "Kp ≥5 or 25%" },
];

// Writes the chosen sensitivity thresholds to localStorage and the SW cache.
// Exported as a standalone function so non-hook contexts (e.g. NotificationPrompt)
// can persist prefs without mounting the full hook.
export async function saveSensitivity(val: AlertSensitivity): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem("aw_alert_sensitivity", val);
    // Notify all useNotifications instances in this tab so their React state stays
    // in sync when the value is written outside the hook (e.g. NotificationPrompt).
    window.dispatchEvent(new CustomEvent("aurorawatch:sensitivity-changed", { detail: val }));
  }
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const { kp, prob } = ALERT_THRESHOLDS[val];
      const cache = await caches.open("aurorawatch-sw-v1");
      await cache.put("/__prefs", new Response(JSON.stringify({ kp, prob })));
    } catch {
      // Cache API unavailable (private browsing, etc.) — non-fatal
    }
  }
}

// Writes the latest live conditions (Bz, max OVATION probability) to the SW cache
// so background Periodic Background Sync checks can apply the same multi-factor
// conditions as in-tab alerts without fetching the large OVATION grid themselves.
// Called on every data refresh while the tab is open; the SW treats values older
// than 2 hours as stale and falls back to Kp-only.
export async function syncLiveStateToSw(
  bz: number | null,
  maxAuroraProbNA: number | null,
): Promise<boolean> {
  if (typeof window === "undefined" || !("caches" in window)) return false;
  try {
    const cache = await caches.open("aurorawatch-sw-v1");
    await cache.put(
      "/__state",
      new Response(
        JSON.stringify({ bz, maxProb: maxAuroraProbNA, updatedAt: Date.now() }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

interface UseNotificationsParams {
  kp: number | null;
  maxAuroraProbNA: number | null;
  bz: number | null;
  isLoading: boolean;
}

interface UseNotificationsReturn {
  notificationPermission: NotificationPermission;
  alertsEnabled: boolean;
  alertSensitivity: AlertSensitivity;
  notificationError: string | null;
  swCacheDegraded: boolean;
  setAlertsEnabled: (val: boolean) => void;
  setAlertSensitivity: (val: AlertSensitivity) => void;
  handleEnableAlerts: () => Promise<void>;
}

/**
 * useNotifications
 * Encapsulates:
 *  - Browser Notification.permission state (checked on mount + after explicit request)
 *  - Persisted user prefs (aw_alerts_enabled, aw_alert_sensitivity) via localStorage
 *  - Throttling (lastNotifiedRef + aw_last_notified, 30min min between auto alerts)
 *  - Auto-alert side effect: when conditions cross user threshold (and alertsEnabled), fire Notification
 *  - Manual "Enable / Send test" handler with permission flow + confirmation test notification
 *
 * The auto effect depends on live kp / prob / bz values (passed in) so it reacts to data refreshes.
 */
export function useNotifications({
  kp,
  maxAuroraProbNA,
  bz,
  isLoading,
}: UseNotificationsParams): UseNotificationsReturn {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });

  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [swCacheDegraded, setSwCacheDegraded] = useState(false);

  // Re-sync Notification.permission when tab regains focus (user may have changed browser setting)
  // or when another component instance grants permission (e.g. NotificationPrompt).
  useEffect(() => {
    function syncPermission() {
      if ("Notification" in window) setNotificationPermission(Notification.permission);
    }
    function onPermissionChanged(e: Event) {
      const val = (e as CustomEvent<NotificationPermission>).detail;
      setNotificationPermission(val);
    }
    document.addEventListener("visibilitychange", syncPermission);
    window.addEventListener("aurorawatch:permission-changed", onPermissionChanged);
    return () => {
      document.removeEventListener("visibilitychange", syncPermission);
      window.removeEventListener("aurorawatch:permission-changed", onPermissionChanged);
    };
  }, []);

  // Use ref for throttle to avoid setState in effect (lint + perf)
  const lastNotifiedRef = useRef<number>(0);
  // Track previous Kp to detect sudden surges that warrant immediate notification
  const prevKpRef = useRef<number | null>(null);

  // Register the service worker once on mount (idempotent — safe to call every render cycle)
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // SW registration failure is non-fatal; in-tab alerts continue to work
      });
    }
  }, []);

  // Load throttle from storage once on mount (client only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aw_last_notified");
      if (stored) lastNotifiedRef.current = parseInt(stored, 10);
    }
  }, []);

  // Notifications v2: persisted user prefs (enable + sensitivity for thresholds)
  // These are independent of browser Notification.permission (which gates delivery)
  const [alertsEnabled, setAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("aw_alerts_enabled");
      return v === null ? true : v === "1";
    }
    return true;
  });

  const [alertSensitivity, setAlertSensitivityState] = useState<AlertSensitivity>(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("aw_alert_sensitivity") as AlertSensitivity | null;
      return v === "sensitive" || v === "strong" ? v : "balanced";
    }
    return "balanced";
  });

  // Keep sensitivity state in sync when saveSensitivity() is called outside this hook instance
  // (e.g. NotificationPrompt writes prefs directly — this ensures AlertsPanel reflects the change).
  useEffect(() => {
    function onSensitivityChanged(e: Event) {
      const val = (e as CustomEvent<AlertSensitivity>).detail;
      if (val === "sensitive" || val === "balanced" || val === "strong") {
        setAlertSensitivityState(val);
      }
    }
    window.addEventListener("aurorawatch:sensitivity-changed", onSensitivityChanged);
    return () => window.removeEventListener("aurorawatch:sensitivity-changed", onSensitivityChanged);
  }, []);

  // Keep the SW cache fresh with the latest Bz and OVATION probability so background
  // checks can apply multi-factor conditions without fetching the large OVATION grid.
  // Track whether the cache write succeeded so we can surface a degraded-mode note in the UI.
  useEffect(() => {
    if (kp !== null && !isLoading) {
      syncLiveStateToSw(bz, maxAuroraProbNA).then((ok) => {
        if (!ok) setSwCacheDegraded(true);
      });
    }
  }, [kp, bz, maxAuroraProbNA, isLoading]);

  const setAlertsEnabled = (val: boolean) => {
    setAlertsEnabledState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("aw_alerts_enabled", val ? "1" : "0");
    }
  };

  const setAlertSensitivity = (val: AlertSensitivity) => {
    setAlertSensitivityState(val);
    saveSensitivity(val);
  };

  // Auto-trigger browser notification when conditions meet the alert threshold.
  // Normal cadence: 30-min throttle. Surge (Kp jumps ≥2 into alert territory): 5-min throttle.
  useEffect(() => {
    // Always record prevKp before early returns so the ref tracks the true last-seen value.
    const prevKp = prevKpRef.current;
    prevKpRef.current = kp;

    if (
      notificationPermission !== "granted" ||
      kp === null ||
      isLoading ||
      !alertsEnabled
    )
      return;

    const now = Date.now();
    const thresh = ALERT_THRESHOLDS[alertSensitivity];

    const likelyForMI = shouldTriggerNotification(kp, thresh, bz, maxAuroraProbNA);

    // Surge: Kp rose ≥2 points in one poll cycle and crossed into alert territory.
    // Use a tighter throttle so the user hears about rapid storm onset quickly.
    const isSurge = prevKp !== null && kp - prevKp >= 2 && kp >= thresh.kp;
    const throttleMs = isSurge ? 1000 * 60 * 5 : 1000 * 60 * 30;

    if (now - lastNotifiedRef.current < throttleMs) return;

    if (likelyForMI) {
      const body = isSurge
        ? `Kp jumped to ${kp.toFixed(1)} (was ${prevKp!.toFixed(1)}). Conditions may be changing rapidly — check the aurora map now.`
        : `Kp ${kp.toFixed(1)}. Aurora may be visible across the northern US tonight. Check the map and current conditions.`;
      try {
        new Notification("AuroraWatch Alert", {
          body,
          tag: "aurorawatch-mi",
        });
        lastNotifiedRef.current = now;
        localStorage.setItem("aw_last_notified", now.toString());
      } catch (e) {
        console.warn("Could not show notification", e);
      }
    }
  }, [
    kp,
    maxAuroraProbNA,
    bz,
    notificationPermission,
    isLoading,
    alertsEnabled,
    alertSensitivity,
  ]);

  const handleEnableAlerts = async () => {
    if (!("Notification" in window)) {
      setNotificationError("Browser notifications are not supported in this browser.");
      return;
    }
    setNotificationError(null);

    if (notificationPermission === "granted") {
      // Test notification (works even if user has toggled auto alerts off)
      try {
        const thresh = ALERT_THRESHOLDS[alertSensitivity];
        new Notification("AuroraWatch Test", {
          body: `Test. You will receive real alerts when Kp ≥ ${thresh.kp} or OVATION ≥ ${thresh.prob}% (or strong −Bz) for the northern US.`,
          tag: "aurorawatch-test",
        });
      } catch (e) {
        console.warn("Could not send test notification", e);
      }
      return;
    }

    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    window.dispatchEvent(new CustomEvent("aurorawatch:permission-changed", { detail: perm }));

    if (perm === "granted") {
      setAlertsEnabled(true);
      saveSensitivity(alertSensitivity);

      // Register Periodic Background Sync so alerts fire even when the tab is closed.
      // Only available in Chrome/Edge; fails silently on other browsers.
      try {
        const reg = await navigator.serviceWorker.ready;
        if ("periodicSync" in reg) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (reg as any).periodicSync.register("aurora-check", {
            minInterval: 30 * 60 * 1000,
          });
        }
      } catch {
        // periodicSync not supported or permission denied — in-tab alerts still work
      }

      try {
        new Notification("AuroraWatch", {
          body: "Alerts enabled. We'll notify you when aurora looks likely across the northern US.",
        });
      } catch {}
    }
  };

  return {
    notificationPermission,
    alertsEnabled,
    alertSensitivity,
    notificationError,
    swCacheDegraded,
    setAlertsEnabled,
    setAlertSensitivity,
    handleEnableAlerts,
  };
}
