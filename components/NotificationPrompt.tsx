"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

export function NotificationPrompt() {
  const [perm, setPerm] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  });

  // Only show when permission hasn't been asked yet — AlertsPanel handles full config
  if (perm !== 'default') return null;

  const handleClick = async () => {
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result === 'granted') {
      // Register periodic background sync for aurora checks
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          if ('periodicSync' in reg) {
            type WithPeriodicSync = ServiceWorkerRegistration & {
              periodicSync: { register(tag: string, opts: { minInterval: number }): Promise<void> };
            };
            await (reg as WithPeriodicSync).periodicSync.register('aurora-check', {
              minInterval: 30 * 60 * 1000,
            });
          }
        } catch {
          // periodicSync not supported or permission denied — alerts still work when tab is open
        }
      }
      try {
        new Notification('AuroraWatch', {
          body: 'Alerts enabled. Configure sensitivity in the Alerts section below.',
          icon: '/icons/icon-192.png',
        });
      } catch {
        // Non-fatal if SW isn't ready yet
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
      title="Get browser notifications when aurora conditions improve"
    >
      <Bell className="h-3.5 w-3.5" />
      Get alerts
    </button>
  );
}
