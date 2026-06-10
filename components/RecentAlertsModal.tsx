"use client";

import { useRef } from "react";
import { Bell, X } from "lucide-react";
import { useFocusTrap } from "../lib/hooks/useFocusTrap";
import { useBodyScrollLock } from "../lib/hooks/useBodyScrollLock";
import { alertProductLabel, alertFirstLine, formatAlertAge } from "../lib/utils/alertHelpers";
import type { Alert } from "../lib/api/schemas";

export function RecentAlertsModal({
  alerts,
  onClose,
}: {
  alerts: Alert[];
  onClose: () => void;
}) {
  useBodyScrollLock();
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, onClose);

  const items = alerts.slice(0, 12);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recent NOAA Alerts"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={containerRef}
          className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#94a3b8]" />
              <span className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
                Recent NOAA Alerts
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-1 -mr-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 pt-4">
            {items.length === 0 ? (
              <p className="text-[13px] text-[#94a3b8]">No recent alerts.</p>
            ) : (
              <div className="space-y-3">
                {items.map((alert, i) => {
                  const { text, color } = alertProductLabel(alert.product_id);
                  const firstLine = alertFirstLine(alert.message);
                  const ago = formatAlertAge(alert.issue_datetime);
                  return (
                    <div key={i} className="text-[12px]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium" style={{ color }}>{text}</span>
                        <span className="text-[#64748b] tabular-nums">{ago}</span>
                      </div>
                      <div className="text-[#94a3b8] leading-snug">{firstLine}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
