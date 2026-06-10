"use client";

import { useState } from "react";
import { CalendarPlus, ChevronRight } from "lucide-react";
import {
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  useFireballs,
  formatFireballLocation,
  formatFireballEnergy,
  approximateLocation,
  type Fireball,
} from "../lib/use-noaa-data";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";
import { FireballModal } from "./FireballModal";
import { MeteorShowerModal } from "./solar/MeteorShowerModal";
import { FireballsModal } from "./solar/FireballsModal";

// ── Location helper ───────────────────────────────────────────────────────────

function locationLabel(fb: Pick<Fireball, "lat" | "lon">): string {
  if (fb.lat == null || fb.lon == null) return "Location unavailable";
  return approximateLocation(fb.lat, fb.lon) || formatFireballLocation(fb);
}

// ── Activity / energy helpers ─────────────────────────────────────────────────

function energyColor(impactE: string | null | undefined): string {
  if (!impactE) return "#475569";
  const val = parseFloat(impactE);
  if (isNaN(val)) return "#475569";
  if (val >= 3)   return "#a78bfa"; // major
  if (val >= 1)   return "#ef4444"; // significant
  if (val >= 0.1) return "#eab308"; // moderate
  return "#64748b";                 // minor
}

function dateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function activityColor(level: string): string {
  const lc = level.toLowerCase();
  if (lc.includes("high")) return "#a78bfa";
  if (lc.includes("moderate")) return "#eab308";
  return "#94a3b8";
}

function daysUntilLabel(days: number): string {
  if (days <= 0) return "Peaks tonight";
  if (days === 1) return "Tomorrow";
  if (days <= 7)  return `In ${days} days`;
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
  const [showFireballsModal, setShowFireballsModal] = useState(false);
  const [showMeteorModal, setShowMeteorModal] = useState(false);
  const [now] = useState(Date.now);
  const closeFireball = () => setSelectedFireball(null);

  const showerDays = nextMeteor
    ? Math.ceil((nextMeteor.peakDate.getTime() - now) / (1000 * 60 * 60 * 24))
    : null;
  const showerColor = nextMeteor ? activityColor(nextMeteor.shower.activityLevel) : "#64748b";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="section-title">METEOR ACTIVITY</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Next Meteor Shower ─────────────────────────────────────────── */}
        <div className="card p-5">
          {nextMeteor && showerDays !== null ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
                  NEXT METEOR SHOWER
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-medium tabular-nums px-2 py-0.5 rounded-full"
                    style={{
                      color: showerColor,
                      backgroundColor: showerColor + "1a",
                      border: `1px solid ${showerColor}33`,
                    }}
                  >
                    {daysUntilLabel(showerDays)}
                  </span>
                  <button
                    onClick={() => setShowMeteorModal(true)}
                    className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
                  >
                    Details <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-3xl font-semibold tracking-tight leading-none mb-1.5">
                {nextMeteor.shower.name}
              </div>
              <div className="text-[15px] text-[#94a3b8] tabular-nums mb-3">
                {formatMeteorPeak(nextMeteor.peakDate, nextMeteor.shower)}
              </div>

              <div className="mb-3">
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{
                    color: showerColor,
                    backgroundColor: showerColor + "1a",
                    border: `1px solid ${showerColor}33`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: showerColor }}
                  />
                  {nextMeteor.shower.activityLevel} activity
                </span>
              </div>

              <p className="text-sm text-[#94a3b8] leading-relaxed mb-4">
                {nextMeteor.shower.description}
              </p>

              <div className="border-t border-[#1e2937] pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#64748b]">
                    <span className="h-1 w-1 rounded-full bg-[#334155] flex-shrink-0" />
                    Best after midnight
                  </div>
                  <div className="flex items-center gap-1.5 text-[#64748b]">
                    <span className="h-1 w-1 rounded-full bg-[#334155] flex-shrink-0" />
                    Dark rural skies
                  </div>
                  <div className="flex items-center gap-1.5 text-[#64748b]">
                    <span className="h-1 w-1 rounded-full bg-[#334155] flex-shrink-0" />
                    No equipment needed
                  </div>
                  <div className="flex items-center gap-1.5 text-[#64748b]">
                    <span className="h-1 w-1 rounded-full bg-[#334155] flex-shrink-0" />
                    Allow 15–20 min dark adaptation
                  </div>
                </div>
                <button
                  onClick={() => {
                    const url = createGoogleCalendarLink(nextMeteor.shower, nextMeteor.peakDate);
                    window.open(url, "_blank", "noopener");
                  }}
                  className="button w-full justify-center gap-2 text-xs px-4 py-1.5 min-h-0"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Add Peak Night to Calendar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="uppercase tracking-[2px] text-[10px] text-[#64748b] mb-3">
                NEXT METEOR SHOWER
              </div>
              <EmptyState
                title="No upcoming shower data"
                description="No major meteor shower peaks in the near future."
                standalone={false}
              />
            </>
          )}
        </div>

        {/* ── Fireball Tracker ───────────────────────────────────────────── */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="uppercase tracking-[2px] text-[10px] text-[#64748b]">
              FIREBALL TRACKER
            </div>
            {!fireballsQuery.isLoading && !fireballsQuery.error && fireballsQuery.fireballs.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#475569] tabular-nums">
                  NASA JPL · {fireballsQuery.fireballs.length} events
                </span>
                <button
                  onClick={() => setShowFireballsModal(true)}
                  className="text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors flex items-center gap-0.5"
                >
                  Details <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {fireballsQuery.isLoading ? (
            <LoadingSkeleton variant="list" count={5} />
          ) : fireballsQuery.error ? (
            <ErrorState
              message="Unable to load recent fireball reports right now."
              onRetry={fireballsQuery.refetch}
              standalone={false}
            />
          ) : fireballsQuery.fireballs.length === 0 ? (
            <EmptyState
              title="No recent fireballs reported"
              description="NASA JPL has not recorded any notable fireballs recently."
              standalone={false}
            />
          ) : (
            <>
              <div className="space-y-0.5">
                {fireballsQuery.fireballs.map((fb: Fireball) => {
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
                          {locationLabel(fb)}
                        </div>
                      </div>
                      {fb.impactE && (
                        <span
                          className="text-[10px] font-medium tabular-nums px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            color,
                            backgroundColor: color + "1a",
                            border: `1px solid ${color}33`,
                          }}
                        >
                          {formatFireballEnergy(fb.impactE)}
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-[#334155] group-hover:text-[#475569] transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Footer: dot legend + source + definition */}
              <div className="border-t border-[#1e2937] pt-3 mt-3 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {([
                      { color: "#a78bfa", label: "≥3 kt"   },
                      { color: "#ef4444", label: "≥1 kt"   },
                      { color: "#eab308", label: "≥0.1 kt" },
                      { color: "#64748b", label: "<0.1 kt" },
                    ] as const).map(({ color, label }) => (
                      <span key={label} className="flex items-center gap-1 text-[10px] text-[#475569]">
                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        {label}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#475569] flex-shrink-0">Impact energy (kt TNT)</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedFireball && (
        <FireballModal
          fireball={selectedFireball}
          onClose={closeFireball}
        />
      )}

      {showFireballsModal && (
        <FireballsModal onClose={() => setShowFireballsModal(false)} />
      )}

      {showMeteorModal && nextMeteor && (
        <MeteorShowerModal
          shower={nextMeteor.shower}
          peakDate={nextMeteor.peakDate}
          onClose={() => setShowMeteorModal(false)}
        />
      )}
    </div>
  );
}
