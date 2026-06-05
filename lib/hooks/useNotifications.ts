"use client";

import { useState, useEffect, useRef } from "react";

// Alert threshold presets (module scope for stability + used by effect, handler, and render in AlertsPanel)
export const ALERT_THRESHOLDS = {
  sensitive: { kp: 3, prob: 10 },
  balanced: { kp: 4, prob: 15 },
  strong: { kp: 5, prob: 25 },
} as const;

export type AlertSensitivity = "sensitive" | "balanced" | "strong";

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
 * All original behavior, storage keys, messages, and throttling preserved exactly.
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

  // Use ref for throttle to avoid setState in effect (lint + perf)
  const lastNotifiedRef = useRef<number>(0);

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

  const setAlertsEnabled = (val: boolean) => {
    setAlertsEnabledState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("aw_alerts_enabled", val ? "1" : "0");
    }
  };

  const setAlertSensitivity = (val: AlertSensitivity) => {
    setAlertSensitivityState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("aw_alert_sensitivity", val);
    }
  };

  // Auto-trigger browser notification when conditions look good for Michigan
  // Throttled to avoid spam (min 30 min between notifications)
  // Respects user alertsEnabled toggle + chosen sensitivity threshold
  useEffect(() => {
    if (
      notificationPermission !== "granted" ||
      kp === null ||
      isLoading ||
      !alertsEnabled
    )
      return;

    const now = Date.now();
    const last = lastNotifiedRef.current;
    if (now - last < 1000 * 60 * 30) return;

    const thresh = ALERT_THRESHOLDS[alertSensitivity];
    const likelyForMI =
      kp >= thresh.kp ||
      (maxAuroraProbNA !== null && maxAuroraProbNA >= thresh.prob) ||
      (bz !== null && bz <= -5);

    if (likelyForMI) {
      const body = `Kp ${kp.toFixed(1)}. Aurora may be visible in parts of Michigan tonight. Check the map and current conditions.`;
      try {
        new Notification("AuroraWatch Alert", {
          body,
          tag: "aurorawatch-mi",
        });
        lastNotifiedRef.current = now;
        localStorage.setItem("aw_last_notified", now.toString());
      } catch (e) {
        // Notifications may be blocked or not supported in some contexts
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
          body: `Test. You will receive real alerts when Kp ≥ ${thresh.kp} or OVATION ≥ ${thresh.prob}% (or strong −Bz) for Michigan.`,
          tag: "aurorawatch-test",
        });
      } catch (e) {
        console.warn("Could not send test notification", e);
      }
      return;
    }

    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);

    if (perm === "granted") {
      // Turn auto alerts on by default when user grants permission
      setAlertsEnabled(true);
      // Confirmation notification
      try {
        new Notification("AuroraWatch", {
          body: "Alerts enabled. We'll notify you when aurora looks likely over Michigan.",
        });
      } catch {}
    }
  };

  return {
    notificationPermission,
    alertsEnabled,
    alertSensitivity,
    notificationError,
    setAlertsEnabled,
    setAlertSensitivity,
    handleEnableAlerts,
  };
}
