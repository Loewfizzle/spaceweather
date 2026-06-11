"use client";

import { useState, useEffect } from "react";
import {
  ALERT_THRESHOLDS,
  PRESETS,
  type AlertSensitivity,
  saveSensitivity,
  loadAlertsEnabled,
  saveAlertsEnabled,
  loadAlertSensitivity,
} from "../utils/notificationStorage";
import { useNotificationPermission } from "./useNotificationPermission";
import { registerPeriodicSync } from "../utils/registerPeriodicSync";
import { syncLiveStateToSw } from "../utils/swCacheSync";
import { useAutoAlert } from "./useAutoAlert";

// Re-export constants and types so existing call sites (AlertsPanel, NotificationPrompt)
// continue to import from this module without modification.
export { ALERT_THRESHOLDS, PRESETS, saveSensitivity };
export type { AlertSensitivity };

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
  const [alertsEnabled, setAlertsEnabledState] = useState<boolean>(loadAlertsEnabled);
  const [alertSensitivity, setAlertSensitivityState] = useState<AlertSensitivity>(loadAlertSensitivity);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  useEffect(() => {
    const handler = (e: Event) => {
      const val = (e as CustomEvent<AlertSensitivity>).detail;
      if (val === "sensitive" || val === "balanced" || val === "strong") setAlertSensitivityState(val);
    };
    window.addEventListener("skyglow:sensitivity-changed", handler);
    return () => window.removeEventListener("skyglow:sensitivity-changed", handler);
  }, []);
  useEffect(() => {
    if (kp !== null && !isLoading) syncLiveStateToSw(bz, maxAuroraProbNA).then(ok => { if (!ok) setSwCacheDegraded(true); });
  }, [kp, bz, maxAuroraProbNA, isLoading]);

  const setAlertsEnabled = (val: boolean) => { setAlertsEnabledState(val); saveAlertsEnabled(val); };
  const setAlertSensitivity = (val: AlertSensitivity) => { setAlertSensitivityState(val); saveSensitivity(val); };

  useAutoAlert({ kp, maxAuroraProbNA, bz, isLoading, alertsEnabled, alertSensitivity, notificationPermission });

  const handleEnableAlerts = async () => {
    if (!("Notification" in window)) {
      setNotificationError("Browser notifications are not supported in this browser.");
      return;
    }
    setNotificationError(null);
    if (notificationPermission === "granted") {
      try {
        const thresh = ALERT_THRESHOLDS[alertSensitivity];
        new Notification("SkyGlow Test", {
          body: `Test. You will receive real alerts when Kp ≥ ${thresh.kp} or OVATION ≥ ${thresh.prob}% (or strong −Bz) for the northern US.`,
          tag: "skyglow-test",
        });
      } catch (e) { if (process.env.NODE_ENV === 'development') console.warn("Could not send test notification", e); }
      return;
    }
    const perm = await Notification.requestPermission();
    dispatchPermissionChange(perm);
    if (perm === "granted") {
      setAlertsEnabled(true);
      saveSensitivity(alertSensitivity);
      await registerPeriodicSync();
      try { new Notification("SkyGlow", { body: "Alerts enabled. We'll notify you when aurora looks likely across the northern US." }); } catch {}
    }
  };

  return { notificationPermission, alertsEnabled, alertSensitivity, notificationError, swCacheDegraded, setAlertsEnabled, setAlertSensitivity, handleEnableAlerts };
}
