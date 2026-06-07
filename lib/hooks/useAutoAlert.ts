"use client";

import { useEffect, useRef } from "react";
import { shouldTriggerNotification } from "../utils/swNotifications";
import {
  ALERT_THRESHOLDS,
  type AlertSensitivity,
  loadLastNotified,
  saveLastNotified,
} from "../utils/notificationStorage";

interface UseAutoAlertParams {
  kp: number | null;
  maxAuroraProbNA: number | null;
  bz: number | null;
  isLoading: boolean;
  alertsEnabled: boolean;
  alertSensitivity: AlertSensitivity;
  notificationPermission: NotificationPermission;
}

// Fires browser notifications when live conditions exceed the chosen threshold.
// Throttled to 30 min normally; 5 min on a ≥2-point Kp surge.
export function useAutoAlert({
  kp,
  maxAuroraProbNA,
  bz,
  isLoading,
  alertsEnabled,
  alertSensitivity,
  notificationPermission,
}: UseAutoAlertParams): void {
  const lastNotifiedRef = useRef<number>(0);
  const prevKpRef = useRef<number | null>(null);

  useEffect(() => { lastNotifiedRef.current = loadLastNotified(); }, []);

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
}
