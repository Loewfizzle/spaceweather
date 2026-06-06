"use client";

import { useState } from "react";
import { CalendarPlus, ChevronRight } from "lucide-react";
import {
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  useFireballs,
  formatFireballDate,
  formatFireballLocation,
  formatFireballEnergy,
  type Fireball,
} from "../lib/use-noaa-data";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";
import { FireballModal } from "./FireballModal";

function energyColor(impactE: string | null | undefined): string {
  if (!impactE) return "#475569";
  const val = parseFloat(impactE);
  if (isNaN(val)) return "#475569";
  if (val >= 1)   return "#f97316"; // significant
  if (val >= 0.1) return "#eab308"; // moderate
  return "#64748b";                 // minor
}

function dateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr.replace(" ", "T") + "Z");
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function activityColor(level: string): string {
  const lc = level.toLowerCase();
  if (lc.includes("high")) return "#22c55e";
  if (lc.includes("moderate")) return "#eab308";
  return "#94a3b8";
}

function daysUntilLabel(days: number): string {
  if (days <= 0) return "Peaks tonight";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/**
 * MeteorActivity
 * Two cards: Next Meteor Shower (with Google Calendar link) + Fireball Tracker (NASA JPL CNEOS).
 */
export function MeteorActivity() {
  const fireballsQuery = useFireballs();
  const nextMeteor = getNextMeteorShower();
  const [selectedFireball, setSelectedFireball] = useState<Fireball | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="section-title">METEOR ACTIVITY</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Next Meteor Shower */}
        <div className="card p-5">
          {nextMeteor ? (
            <>
              {/* Header: label + countdown */}
              {(() => {
                const days = Math.ceil(
                  (nextMeteor.peakDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const color = activityColor(nextMeteor.shower.activityLevel);
                return (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="uppercase tracking-[1.5px] text-[10px] text-[#64748b]">
                        NEXT METEOR SHOWER
                      </div>
                      <span className="text-[11px] text-[#64748b] tabular-nums">
                        {daysUntilLabel(days)}
                      </span>
                    </div>

                    {/* Name + date */}
                    <div className="text-3xl font-semibold tracking-tight leading-none mb-1.5">
                      {nextMeteor.shower.name}
                    </div>
                    <div className="text-[15px] text-[#94a3b8] tabular-nums mb-3">
                      {formatMeteorPeak(nextMeteor.peakDate, nextMeteor.shower)}
                    </div>

                    {/* Activity badge */}
                    <div className="mb-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                        style={{
                          color,
                          backgroundColor: color + "1a",
                          border: `1px solid ${color}33`,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {nextMeteor.shower.activityLevel} activity
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-[#94a3b8] leading-relaxed mb-3">
                      {nextMeteor.shower.description}
                    </p>

                    {/* Viewing tip */}
                    <div className="text-[11px] text-[#475569] mb-4">
                      Best after midnight &middot; Dark rural skies
                    </div>

                    {/* Calendar button */}
                    <button
                      onClick={() => {
                        const url = createGoogleCalendarLink(
                          nextMeteor.shower,
                          nextMeteor.peakDate
                        );
                        window.open(url, "_blank", "noopener");
                      }}
                      className="button w-full justify-center gap-2 text-xs px-4 py-1.5 min-h-0"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Add Peak Night to Calendar
                    </button>
                  </>
                );
              })()}
            </>
          ) : (
            <div className="uppercase tracking-[1.5px] text-[10px] text-[#64748b] mb-3">
              NEXT METEOR SHOWER
            </div>
          )}
          {!nextMeteor && (
            <EmptyState
              title="No upcoming shower data"
              description="No major meteor shower peaks in the near future."
            />
          )}
        </div>

        {/* Fireball Tracker */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="uppercase tracking-[1.5px] text-[10px] text-[#64748b]">FIREBALL TRACKER</div>
            {!fireballsQuery.isLoading && !fireballsQuery.error && fireballsQuery.fireballs.length > 0 && (
              <span className="text-[11px] text-[#64748b] tabular-nums">
                {fireballsQuery.fireballs.length} recent
              </span>
            )}
          </div>

          {fireballsQuery.isLoading ? (
            <LoadingSkeleton variant="list" count={4} />
          ) : fireballsQuery.error ? (
            <ErrorState
              message="Unable to load recent fireball reports right now."
              onRetry={fireballsQuery.refetch}
            />
          ) : fireballsQuery.fireballs.length === 0 ? (
            <EmptyState
              title="No recent fireballs reported"
              description="NASA JPL has not recorded any notable fireballs recently."
            />
          ) : (
            <>
              <div className="space-y-0.5">
                {fireballsQuery.fireballs.slice(0, 4).map((fb: Fireball) => {
                  const color = energyColor(fb.impactE);
                  return (
                    <button
                      key={fb.date}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#0f1720] transition-colors text-left group"
                      onClick={() => setSelectedFireball(fb)}
                    >
                      <div
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[#cbd5e1] tabular-nums leading-tight">
                          {dateShort(fb.date)}
                        </div>
                        <div className="text-[11px] text-[#64748b] truncate mt-0.5">
                          {formatFireballLocation(fb)}
                        </div>
                      </div>
                      {fb.impactE && (
                        <span
                          className="text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ color, backgroundColor: color + "1a" }}
                        >
                          {formatFireballEnergy(fb.impactE)}
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-[#334155] group-hover:text-[#475569] transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#1e2937] text-[9px] text-[#334155]">
                Source: NASA JPL CNEOS · Orange = significant (&ge;1 kt) · Yellow = moderate
              </div>
            </>
          )}
        </div>
      </div>

      {selectedFireball && (
        <FireballModal
          fireball={selectedFireball}
          onClose={() => setSelectedFireball(null)}
        />
      )}
    </div>
  );
}
