"use client";

import { alertProductLabel, alertFirstLine, formatAlertAge } from "../lib/utils/alertHelpers";
import { EmptyState } from "./EmptyState";
import type { Alert } from "../lib/api/schemas";

interface AlertsPanelProps {
  riskLevel: "Quiet" | "Moderate" | "High" | null;
  isLoading: boolean;
  alerts?: Alert[];
  alertsLoading?: boolean;
}

export function AlertsPanel({ riskLevel, alerts, alertsLoading }: AlertsPanelProps) {
  const recentAlerts = (alerts ?? []).slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <div className="section-title flex items-center gap-2">
        AURORA ALERTS
        {riskLevel && (
          <span
            className={`risk-pill risk-${riskLevel.toLowerCase()}`}
            title="Live risk derived from Kp, max OVATION probability over North America, and Bz"
          >
            {riskLevel}
          </span>
        )}
      </div>
      <div className="card p-6">
        <div className="space-y-3">
          {recentAlerts.length === 0 ? (
            alertsLoading
              ? [1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-3 w-24 rounded bg-[#1e2937]" />
                      <div className="h-3 w-16 rounded bg-[#1e2937]" />
                    </div>
                    <div className="h-3 w-4/5 rounded bg-[#1e2937]" />
                  </div>
                ))
              : <EmptyState standalone={false} title="No recent alerts" description="NOAA hasn't issued any space weather alerts recently." />
          ) : (
            recentAlerts.map((alert, i) => {
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
            })
          )}
        </div>
      </div>
    </div>
  );
}
