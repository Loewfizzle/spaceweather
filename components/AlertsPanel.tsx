"use client";

import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotifications, ALERT_THRESHOLDS } from "../lib/hooks/useNotifications";
import type { Alert } from "../lib/api/schemas";

interface AlertsPanelProps {
  riskLevel: "Quiet" | "Moderate" | "High" | null;
  kp: number | null;
  maxAuroraProbNA: number | null;
  bz: number | null;
  isLoading: boolean;
  alerts?: Alert[];
  alertsLoading?: boolean;
}

function alertProductLabel(productId: string): { text: string; color: string } {
  // NOAA live format: K05A, K04A, K07A (Kp threshold alerts)
  if (/^K\d+[A-Z]$/.test(productId)) return { text: 'K-index Alert', color: '#eab308' };
  if (productId.startsWith('WATA')) {
    const g = ({ WATA07: 'G1', WATA20: 'G2', WATA30: 'G3', WATA40: 'G4', WATA50: 'G5' } as Record<string, string>)[productId];
    return { text: g ? `Storm Watch ${g}` : 'Storm Watch', color: '#22c55e' };
  }
  if (productId.startsWith('ALTK')) return { text: 'K-index Alert', color: '#eab308' };
  if (productId.startsWith('ALTTP')) return { text: 'Geomagnetic Alert', color: '#eab308' };
  if (productId.startsWith('WARPT') || productId.startsWith('ALTPX')) return { text: 'Radiation Storm', color: '#f97316' };
  if (productId.startsWith('SUM')) return { text: 'NOAA Summary', color: '#64748b' };
  if (productId.startsWith('WAR')) return { text: 'Warning', color: '#f97316' };
  if (productId.startsWith('ALT')) return { text: 'Alert', color: '#eab308' };
  return { text: 'Notice', color: '#64748b' };
}

function alertFirstLine(message: string): string {
  // NOAA messages use \r\n\r\n as header/body separator
  const bodyStart = message.indexOf('\r\n\r\n');
  const body = bodyStart >= 0 ? message.slice(bodyStart + 4).trim() : message.trim();
  const match = body.match(/^(.{20,140}[.!?])/);
  const raw = match ? match[1] : body.slice(0, 120);
  return raw.length < body.length ? raw : raw + (body.length > 120 ? '…' : '');
}

// NOAA issue_datetime uses space instead of T ("2026-06-05 23:25:16") — normalize before parsing.
function formatAlertAge(issueDatetime: string): string {
  try {
    return formatDistanceToNow(new Date(issueDatetime.replace(' ', 'T')), { addSuffix: true });
  } catch {
    return issueDatetime;
  }
}

export function AlertsPanel({ riskLevel, kp, maxAuroraProbNA, bz, isLoading, alerts, alertsLoading }: AlertsPanelProps) {
  const recentAlerts = (alerts ?? []).slice(0, 8);
  const {
    notificationPermission,
    alertsEnabled,
    alertSensitivity,
    notificationError,
    setAlertsEnabled,
    setAlertSensitivity,
    handleEnableAlerts,
  } = useNotifications({ kp, maxAuroraProbNA, bz, isLoading });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          {/* Left: description + controls */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Bell className="w-5 h-5 text-[#64748b] shrink-0" />
              <div className="font-semibold">Alerts for Michigan</div>
              {riskLevel && (
                <span
                  className={`risk-pill risk-${riskLevel.toLowerCase()} ml-0.5`}
                  title="Live risk derived from Kp, max OVATION probability over North America, and Bz"
                >
                  {riskLevel}
                </span>
              )}
            </div>

            <div className="text-sm text-[#94a3b8] max-w-md">
              Browser notifications when Michigan conditions meet your threshold.
              Evaluated on every data refresh (∼5 min).
            </div>

            {/* On/Off toggle (only functional once permission granted) */}
            <div className="mt-4 flex items-center gap-3">
              <div className="text-xs text-[#64748b]">Auto alerts</div>
              <div className="inline-flex rounded-full border border-[#1e2937] text-xs overflow-hidden select-none">
                <button
                  onClick={() => {
                    if (notificationPermission === "granted") setAlertsEnabled(true);
                  }}
                  disabled={notificationPermission !== "granted"}
                  className={`px-3 py-1 transition-colors ${
                    alertsEnabled && notificationPermission === "granted"
                      ? "bg-[#22c55e] text-[#05070f] font-medium"
                      : "text-[#64748b] hover:bg-[#1e2937]"
                  }`}
                >
                  On
                </button>
                <button
                  onClick={() => setAlertsEnabled(false)}
                  disabled={notificationPermission !== "granted"}
                  className={`px-3 py-1 transition-colors ${
                    !alertsEnabled || notificationPermission !== "granted"
                      ? "bg-[#334155] text-white"
                      : "text-[#64748b] hover:bg-[#1e2937]"
                  }`}
                >
                  Off
                </button>
              </div>
              {notificationPermission === "granted" && alertsEnabled && (
                <div className="text-[10px] text-[#22c55e]">Active</div>
              )}
              {notificationPermission === "denied" && (
                <div className="text-[10px] text-red-400">Blocked in browser settings</div>
              )}
            </div>

            {/* User threshold presets (sensitivity) */}
            <div className="mt-4">
              <div className="text-xs text-[#64748b] mb-1.5">Notify me for:</div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: "sensitive", label: "Sensitive", desc: "Kp ≥3 or 10%" },
                    { key: "balanced", label: "Balanced", desc: "Kp ≥4 or 15%" },
                    { key: "strong", label: "Strong only", desc: "Kp ≥5 or 25%" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setAlertSensitivity(opt.key)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      alertSensitivity === opt.key
                        ? "bg-[#0f1425] border-[#22c55e] text-[#22c55e]"
                        : "border-[#1e2937] text-[#94a3b8] hover:border-[#334155]"
                    }`}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-[#475569]">
                Current threshold: Kp ≥ {ALERT_THRESHOLDS[alertSensitivity].kp} or OVATION ≥{" "}
                {ALERT_THRESHOLDS[alertSensitivity].prob}% (plus strong southward Bz)
              </div>
            </div>

            {notificationPermission === "granted" && (
              <div className="mt-3 text-[10px] text-[#64748b]">
                Throttled to once per 30 min • Respects Do Not Disturb
              </div>
            )}
            {notificationError && (
              <div className="mt-3 text-[11px] text-red-400">{notificationError}</div>
            )}
          </div>

          {/* Right: primary action */}
          <div className="sm:shrink-0 sm:pt-1">
            <button
              onClick={handleEnableAlerts}
              className="button button-primary w-full sm:w-auto justify-center min-w-[168px]"
              disabled={notificationPermission === "denied"}
            >
              {notificationPermission === "granted"
                ? "Send test alert"
                : notificationPermission === "denied"
                ? "Notifications blocked"
                : "Enable browser alerts"}
            </button>
            {notificationPermission === "granted" && !alertsEnabled && (
              <div className="mt-2 text-[10px] text-[#64748b] text-center sm:text-left">
                Auto alerts are paused
              </div>
            )}
          </div>
        </div>

        {/* Recent NOAA alerts feed — skeleton while loading, populated list once data arrives */}
        {(recentAlerts.length > 0 || !!alertsLoading) && (
          <div className="mt-6 pt-5 border-t border-[#1e2937]">
            <div className="uppercase tracking-[2px] text-[10px] text-[#64748b] mb-3">
              RECENT NOAA ALERTS
            </div>
            <div className="space-y-3">
              {recentAlerts.length === 0 ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-3 w-24 rounded bg-[#1e2937]" />
                      <div className="h-3 w-16 rounded bg-[#1e2937]" />
                    </div>
                    <div className="h-3 w-4/5 rounded bg-[#1e2937]" />
                  </div>
                ))
              ) : (
                recentAlerts.map((alert, i) => {
                  const { text, color } = alertProductLabel(alert.product_id);
                  const firstLine = alertFirstLine(alert.message);
                  const ago = formatAlertAge(alert.issue_datetime);
                  return (
                    <div key={i} className="text-[12px]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium" style={{ color }}>{text}</span>
                        <span className="text-[#475569] tabular-nums">{ago}</span>
                      </div>
                      <div className="text-[#64748b] leading-snug">{firstLine}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
