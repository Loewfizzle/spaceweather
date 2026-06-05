"use client";

import { useState } from "react";
import {
  getNextMeteorShower,
  formatMeteorPeak,
  createGoogleCalendarLink,
  useFireballs,
  formatFireballDate,
  formatFireballLocation,
  type Fireball,
} from "../lib/use-noaa-data";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";
import { FireballModal } from "./FireballModal";

/**
 * MeteorActivity
 * Two cards: Next Meteor Shower (with Add to Calendar Google link) + Fireball Tracker (last 4 from NASA via proxy).
 * Self-contained data fetching for its own concerns.
 * Dev console warning for fireball errors is kept at page orchestration level (for the refresh button context).
 * Exact original rendering, empty/error states, and button behavior preserved.
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
          <div className="uppercase tracking-[1.5px] text-[10px] text-[#64748b] mb-1">NEXT METEOR SHOWER</div>

          {nextMeteor ? (
            <>
              <div className="text-2xl font-semibold tracking-tight mb-1">{nextMeteor.shower.name}</div>
              <div className="text-sm text-[#94a3b8] mb-2 tabular-nums">
                Peak: {formatMeteorPeak(nextMeteor.peakDate, nextMeteor.shower)}
              </div>
              <p className="text-sm text-[#cbd5e1] mb-3 leading-snug">
                {nextMeteor.shower.description} <span className="text-[#64748b]">({nextMeteor.shower.activityLevel})</span>
              </p>
              <button
                onClick={() => {
                  const url = createGoogleCalendarLink(nextMeteor.shower, nextMeteor.peakDate);
                  window.open(url, "_blank", "noopener");
                }}
                className="button w-full sm:w-auto justify-center text-xs px-4 py-1.5 min-h-0"
              >
                Add Peak Night to Calendar
              </button>
            </>
          ) : (
            <EmptyState
              title="No upcoming shower data"
              description="No major meteor shower peaks in the near future."
            />
          )}
        </div>

        {/* Fireball Tracker */}
        <div className="card p-5">
          <div className="flex items-baseline justify-between mb-2">
            <div className="uppercase tracking-[1.5px] text-[10px] text-[#64748b]">FIREBALL TRACKER</div>
            <div className="text-[10px] text-[#64748b] normal-case">NASA JPL • recent</div>
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
              description="NASA has not reported any fireballs in the recent window."
            />
          ) : (
            <div className="space-y-1.5 text-sm">
              {fireballsQuery.fireballs.slice(0, 4).map((fb: Fireball, idx: number) => {
                const hasLocation = fb.lat != null && fb.lon != null;
                return (
                  <div
                    key={idx}
                    className={`flex justify-between items-start border-b border-[#1e2937] pb-1.5 last:border-b-0 last:pb-0 rounded transition-colors${hasLocation ? " cursor-pointer hover:bg-[#1e2937]" : ""}`}
                    onClick={hasLocation ? () => setSelectedFireball(fb) : undefined}
                    role={hasLocation ? "button" : undefined}
                  >
                    <div className="min-w-0">
                      <div className="tabular-nums text-[#cbd5e1] text-[13px]">{formatFireballDate(fb.date)}</div>
                      <div className="text-[11px] text-[#64748b] truncate">{formatFireballLocation(fb)}</div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3 tabular-nums">
                      {fb.energy != null && (
                        <div className="text-[#94a3b8]">{fb.energy} kt</div>
                      )}
                      {fb.alt != null && (
                        <div className="text-[10px] text-[#64748b]">{fb.alt} km alt</div>
                      )}
                      {fb.energy == null && fb.alt == null && (
                        <div className="text-[10px] text-[#64748b]">—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
