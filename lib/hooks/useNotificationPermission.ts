"use client";

import { useState, useEffect } from "react";

interface UseNotificationPermissionReturn {
  permission: NotificationPermission;
  /** Updates local state and broadcasts the change so all hook instances stay in sync. */
  dispatchPermissionChange: (perm: NotificationPermission) => void;
}

/**
 * Manages Notification.permission state with two sync mechanisms:
 *  - visibilitychange: re-reads the browser value when the tab regains focus,
 *    catching the case where the user changed the setting in browser preferences.
 *  - skyglow:permission-changed custom event: keeps multiple hook instances
 *    (e.g. AlertsPanel + NotificationPrompt in the same tab) in sync after an
 *    explicit requestPermission() call from any one of them.
 */
export function useNotificationPermission(): UseNotificationPermissionReturn {
  // Start with "default" so server and client render identically on first pass.
  // The effect below syncs the real value after hydration.
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    function syncPermission() {
      if ("Notification" in window) setPermission(Notification.permission);
    }
    syncPermission();
    function onPermissionChanged(e: Event) {
      setPermission((e as CustomEvent<NotificationPermission>).detail);
    }
    document.addEventListener("visibilitychange", syncPermission);
    window.addEventListener("skyglow:permission-changed", onPermissionChanged);
    return () => {
      document.removeEventListener("visibilitychange", syncPermission);
      window.removeEventListener("skyglow:permission-changed", onPermissionChanged);
    };
  }, []);

  function dispatchPermissionChange(perm: NotificationPermission) {
    setPermission(perm);
    window.dispatchEvent(new CustomEvent("skyglow:permission-changed", { detail: perm }));
  }

  return { permission, dispatchPermissionChange };
}
