"use client";

import { useSyncExternalStore, useCallback, useMemo } from "react";
import type { Alert } from "../api/schemas";

const LS_KEY = "aw_alerts_last_seen";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): number {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

function getServerSnapshot(): number {
  return 0;
}

function parseIssueTime(issueDatetime: string): number {
  const normalized = issueDatetime.trim().replace(" ", "T");
  const withTz = /[Z+-]\d*$/.test(normalized) ? normalized : normalized + "Z";
  return Date.parse(withTz);
}

export function useUnreadAlerts(alerts: Alert[] | undefined): {
  hasUnread: boolean;
  markSeen: () => void;
} {
  const lastSeen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const hasUnread = useMemo(() => {
    if (!alerts?.length) return false;
    const newest = alerts[0]?.issue_datetime;
    if (!newest) return false;
    const newestMs = parseIssueTime(newest);
    return isFinite(newestMs) && newestMs > lastSeen;
  }, [alerts, lastSeen]);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, String(Date.now()));
    } catch {
      // storage unavailable
    }
  }, []);

  return { hasUnread, markSeen };
}
