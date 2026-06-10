"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  ALERT_THRESHOLDS,
  PRESETS,
  saveSensitivity,
  type AlertSensitivity,
} from "../lib/hooks/useNotifications";
import {
  loadAlertSensitivity,
  loadAlertsEnabled,
  saveAlertsEnabled,
} from "../lib/utils/notificationStorage";
import { registerPeriodicSync } from "../lib/utils/registerPeriodicSync";

interface NotificationPromptProps {
  accentColor?: string;
}

export function NotificationPrompt({ accentColor = "#38bdf8" }: NotificationPromptProps) {
  const [perm, setPerm] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    return Notification.permission;
  });
  const [sensitivity, setSensitivity] = useState<AlertSensitivity>(loadAlertSensitivity);
  const [enabled, setEnabled] = useState<boolean>(loadAlertsEnabled);
  const [isIosNonInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent;
    return (
      /iPhone|iPad/.test(ua) &&
      !/CriOS|FxiOS/.test(ua) &&
      (navigator as Navigator & { standalone?: boolean }).standalone !== true
    );
  });

  // iOS Safari browser — Web Push only works in the installed PWA
  if (isIosNonInstalled) {
    return (
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("skyglow:open-install-prompt"))}
        style={{ color: accentColor }}
        className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Add to home screen for alerts
      </button>
    );
  }

  // Permission granted — compact AlertTriangle + Low/Med/High/Off in one row
  if (perm === "granted") {
    return (
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
        {PRESETS.map((p) => (
          <button
            key={p.key}
            style={{ color: enabled && sensitivity === p.key ? accentColor : "#64748b" }}
            onClick={async () => {
              setSensitivity(p.key);
              setEnabled(true);
              saveAlertsEnabled(true);
              await saveSensitivity(p.key);
            }}
            className="text-xs px-1.5 py-0.5 rounded-full border border-[#1e2937] hover:opacity-80 transition-opacity"
            title={p.desc}
          >
            {p.label}
          </button>
        ))}
        <button
          style={{ color: !enabled ? "#ef4444" : "#64748b" }}
          onClick={() => { setEnabled(false); saveAlertsEnabled(false); }}
          className="text-xs px-1.5 py-0.5 rounded-full border border-[#1e2937] hover:opacity-80 transition-opacity"
          title="Turn off aurora alerts"
        >
          Off
        </button>
      </div>
    );
  }

  // Permission denied or Notification API unavailable — nothing to show
  if (perm !== "default") return null;

  // Default: offer to enable alerts
  return (
    <button
      onClick={async () => {
        const result = await Notification.requestPermission();
        setPerm(result);
        if (result === "granted") {
          window.dispatchEvent(new CustomEvent("skyglow:permission-changed", { detail: result }));
          setSensitivity("balanced");
          setEnabled(true);
          saveAlertsEnabled(true);
          await saveSensitivity("balanced");
          await registerPeriodicSync();
          try {
            const thresh = ALERT_THRESHOLDS["balanced"];
            new Notification("SkyGlow", {
              body: `Alerts on. You'll hear from us when Kp ≥ ${thresh.kp} or OVATION ≥ ${thresh.prob}%.`,
              icon: "/icons/icon-192.png",
            });
          } catch {}
        }
      }}
      style={{ color: accentColor }}
      className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
      title="Get browser notifications when aurora conditions improve"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      Get alerts
    </button>
  );
}
