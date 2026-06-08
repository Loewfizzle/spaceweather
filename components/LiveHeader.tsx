"use client";

import { Activity, Bell } from "lucide-react";
import { useCurrentConditions, useSolarActivity } from "../lib/use-noaa-data";
import { getKpTier } from "../lib/aurora/kp";
import { DataStatus } from "./DataStatus";
import { useModalState } from "../lib/hooks/useModalState";
import { useUnreadAlerts } from "../lib/hooks/useUnreadAlerts";
import { RecentAlertsModal } from "./RecentAlertsModal";

export function LiveHeader() {
  const { kp } = useCurrentConditions();
  const { alerts } = useSolarActivity();
  const { isOpen, open, close } = useModalState();
  const { hasUnread, markSeen } = useUnreadAlerts(alerts);

  const kpClass = `kp-${kp !== null ? getKpTier(kp) : "quiet"}`;

  function handleBellClick() {
    markSeen();
    open();
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      {/* Kp index — primary live signal in the header */}
      <div
        className={`kp-pill ${kpClass}`}
        title="Planetary K-index (live from NOAA)"
      >
        <Activity className="w-3.5 h-3.5" />
        <span>Kp {kp !== null ? kp.toFixed(1) : "—"}</span>
      </div>

      {/* NOAA alerts bell */}
      <button
        onClick={handleBellClick}
        className="relative text-[#64748b] hover:text-[#94a3b8] transition-colors p-1"
        aria-label="View recent NOAA alerts"
      >
        <Bell className="w-3.5 h-3.5" />
        {hasUnread && (
          <span className="absolute top-0.5 right-0.5 block h-1.5 w-1.5 rounded-full bg-red-500" />
        )}
      </button>

      {/* Appears only when a data source is degraded or down */}
      <DataStatus />

      {isOpen && (
        <RecentAlertsModal
          alerts={alerts ?? []}
          onClose={close}
        />
      )}
    </div>
  );
}
