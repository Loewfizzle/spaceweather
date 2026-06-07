"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import {
  ALERT_THRESHOLDS,
  PRESETS,
  saveSensitivity,
  type AlertSensitivity,
} from "../lib/hooks/useNotifications";

type Phase = "prompt" | "picking" | "done";

type WithPeriodicSync = ServiceWorkerRegistration & {
  periodicSync: { register(tag: string, opts: { minInterval: number }): Promise<void> };
};

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

  // Show confirmation after the user completed the flow
  if (phase === "done") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
        <Check className="h-3.5 w-3.5" />
        Alerts on · {PRESETS.find((p) => p.key === chosen)!.label}
      </span>
    );
  }

  // Already resolved (granted from a previous session) or unavailable — AlertsPanel handles config
  if (perm !== "default") return null;

  if (phase === "picking") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#64748b]">Notify me for:</span>
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
              if ("serviceWorker" in navigator) {
                try {
                  const reg = await navigator.serviceWorker.ready;
                  if ("periodicSync" in reg) {
                    await (reg as WithPeriodicSync).periodicSync.register(
                      "aurora-check",
                      { minInterval: 30 * 60 * 1000 },
                    );
                  }
                } catch {}
              }
              try {
                const thresh = ALERT_THRESHOLDS[p.key];
                new Notification("AuroraWatch", {
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

  // phase === "prompt"
  return (
    <button
      onClick={async () => {
        const result = await Notification.requestPermission();
        setPerm(result);
        if (result === "granted") {
          window.dispatchEvent(new CustomEvent("aurorawatch:permission-changed", { detail: result }));
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
