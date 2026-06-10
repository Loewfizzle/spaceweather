"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import {
  ALERT_THRESHOLDS,
  PRESETS,
  saveSensitivity,
  type AlertSensitivity,
} from "../lib/hooks/useNotifications";
import { loadAlertSensitivity } from "../lib/utils/notificationStorage";
import { registerPeriodicSync } from "../lib/utils/registerPeriodicSync";

type Phase = "prompt" | "picking" | "done";

interface NotificationPromptProps {
  accentColor?: string;
}

export function NotificationPrompt({ accentColor = "#38bdf8" }: NotificationPromptProps) {
  const [perm, setPerm] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    return Notification.permission;
  });
  const [phase, setPhase] = useState<Phase>("prompt");
  const [chosen, setChosen] = useState<AlertSensitivity>("balanced");
  const [sensitivity, setSensitivity] = useState<AlertSensitivity>(loadAlertSensitivity);
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
        <Bell className="h-3.5 w-3.5" />
        Add to home screen for alerts
      </button>
    );
  }

  // Completed the flow this session
  if (phase === "done") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
        <Check className="h-3.5 w-3.5" />
        Alerts on · {PRESETS.find((p) => p.key === chosen)!.label}
      </span>
    );
  }

  // Sensitivity picker — checked before the perm guard so it survives the
  // batched state update that sets perm="granted" + phase="picking" together
  if (phase === "picking") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#94a3b8]">Notify me for:</span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            style={{ color: accentColor }}
            onClick={async () => {
              setChosen(p.key);
              if (typeof window !== "undefined") {
                localStorage.setItem("aw_alerts_enabled", "1");
              }
              await saveSensitivity(p.key);
              await registerPeriodicSync();
              try {
                const thresh = ALERT_THRESHOLDS[p.key];
                new Notification("SkyGlow", {
                  body: `Alerts on. You'll hear from us when Kp ≥ ${thresh.kp} or OVATION ≥ ${thresh.prob}%.`,
                  icon: "/icons/icon-192.png",
                });
              } catch {}
              setPhase("done");
            }}
            className="text-xs px-2.5 py-0.5 rounded-full border border-[#1e2937] hover:opacity-80 transition-opacity"
            title={p.desc}
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  // Permission already granted (returning user) — show current sensitivity with toggle
  if (perm === "granted") {
    return (
      <div className="flex items-center gap-2">
        <Bell className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
        <span className="text-xs text-[#94a3b8]">Alerts:</span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            style={{ color: sensitivity === p.key ? accentColor : "#64748b" }}
            onClick={async () => {
              setSensitivity(p.key);
              await saveSensitivity(p.key);
            }}
            className="text-xs px-2 py-0.5 rounded-full border border-[#1e2937] hover:opacity-80 transition-opacity"
            title={p.desc}
          >
            {p.label}
          </button>
        ))}
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
          setPhase("picking");
        }
      }}
      style={{ color: accentColor }}
      className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
      title="Get browser notifications when aurora conditions improve"
    >
      <Bell className="h-3.5 w-3.5" />
      Get alerts
    </button>
  );
}
