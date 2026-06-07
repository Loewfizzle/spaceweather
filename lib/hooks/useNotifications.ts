"use client";

import { useState, useEffect, useRef } from "react";
import { shouldTriggerNotification } from "../utils/swNotifications";
import {
  ALERT_THRESHOLDS,
  PRESETS,
  type AlertSensitivity,
  saveSensitivity,
  loadAlertsEnabled,
  saveAlertsEnabled,
  loadAlertSensitivity,
  loadLastNotified,
  saveLastNotified,
} from "../utils/notificationStorage";
import { useNotificationPermission } from "./useNotificationPermission";
import { registerPeriodicSync } from "../utils/registerPeriodicSync";

// Re-export constants and types so existing call sites (AlertsPanel, NotificationPrompt)
// continue to import from this module without modification.
export { ALERT_THRESHOLDS, PRESETS, saveSensitivity };
export type { AlertSensitivity };

// Writes the latest live conditions to the SW cache so background Periodic Background
// Sync checks can apply multi-factor conditions without fetching the OVATION grid.
// Called on every data refresh; SW treats values older than 2 hours as stale.
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

export function useNotifications({
  kp, maxAuroraProbNA, bz, isLoading,
}: UseNotificationsParams): UseNotificationsReturn {
  const { permission: notificationPermission, dispatchPermissionChange } = useNotificationPermission();
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [swCacheDegraded, setSwCacheDegraded] = useState(false);
  const lastNotifiedRef = useRef<number>(0);
  const prevKpRef = useRef<number | null>(null);
  const [alertsEnabled, setAlertsEnabledState] = useState<boolean>(loadAlertsEnabled);
  const [alertSensitivity, setAlertSensitivityState] = useState<AlertSensitivity>(loadAlertSensitivity);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  useEffect(() => { lastNotifiedRef.current = loadLastNotified(); }, []);
  useEffect(() => {
    const handler = (e: Event) => {
      const val = (e as CustomEvent<AlertSensitivity>).detail;
      if (val === "sensitive" || val === "balanced" || val === "strong") setAlertSensitivityState(val);
    };
    window.addEventListener("aurorawatch:sensitivity-changed", handler);
    return () => window.removeEventListener("aurorawatch:sensitivity-changed", handler);
  }, []);
  useEffect(() => {
    if (kp !== null && !isLoading) syncLiveStateToSw(bz, maxAuroraProbNA).then(ok => { if (!ok) setSwCacheDegraded(true); });
  }, [kp, bz, maxAuroraProbNA, isLoading]);

  const setAlertsEnabled = (val: boolean) => { setAlertsEnabledState(val); saveAlertsEnabled(val); };
  const setAlertSensitivity = (val: AlertSensitivity) => { setAlertSensitivityState(val); saveSensitivity(val); };

  // Auto-alert: throttled notification when conditions meet threshold.
  // Normal cadence: 30-min throttle. Surge (Kp jumps ≥2 into alert territory): 5-min throttle.
  useEffect(() => {
    const prevKp = prevKpRef.current;
    prevKpRef.current = kp;
    if (notificationPermission !== "granted" || kp === null || isLoading || !alertsEnabled) return;
    const now = Date.now();
    const thresh = ALERT_THRESHOLDS[alertSensitivity];
    const likelyForMI = shouldTriggerNotification(kp, thresh, bz, maxAuroraProbNA);
    const isSurge = prevKp !== null && kp - prevKp >= 2 && kp >= thresh.kp;
    const throttleMs = isSurge ? 1000 * 60 * 5 : 1000 * 60 * 30;
    if (now - lastNotifiedRef.current < throttleMs) return;
    if (likelyForMI) {
      const body = isSurge
        ? `Kp jumped to ${kp.toFixed(1)} (was ${prevKp!.toFixed(1)}). Conditions may be changing rapidly — check the aurora map now.`
        : `Kp ${kp.toFixed(1)}. Aurora may be visible across the northern US tonight. Check the map and current conditions.`;
      try {
        new Notification("AuroraWatch Alert", { body, tag: "aurorawatch-mi" });
        lastNotifiedRef.current = now;
        saveLastNotified(now);
      } catch (e) { console.warn("Could not show notification", e); }
    }
  }, [kp, maxAuroraProbNA, bz, notificationPermission, isLoading, alertsEnabled, alertSensitivity]);

  const handleEnableAlerts = async () => {
    if (!("Notification" in window)) {
      setNotificationError("Browser notifications are not supported in this browser.");
      return;
    }
    setNotificationError(null);
    if (notificationPermission === "granted") {
      try {
        const thresh = ALERT_THRESHOLDS[alertSensitivity];
        new Notification("AuroraWatch Test", {
          body: `Test. You will receive real alerts when Kp ≥ ${thresh.kp} or OVATION ≥ ${thresh.prob}% (or strong −Bz) for the northern US.`,
          tag: "aurorawatch-test",
        });
      } catch (e) { console.warn("Could not send test notification", e); }
      return;
    }
    const perm = await Notification.requestPermission();
    dispatchPermissionChange(perm);
    if (perm === "granted") {
      setAlertsEnabled(true);
      saveSensitivity(alertSensitivity);
      await registerPeriodicSync();
      try { new Notification("AuroraWatch", { body: "Alerts enabled. We'll notify you when aurora looks likely across the northern US." }); } catch {}
    }
  };

  return { notificationPermission, alertsEnabled, alertSensitivity, notificationError, swCacheDegraded, setAlertsEnabled, setAlertSensitivity, handleEnableAlerts };
}
