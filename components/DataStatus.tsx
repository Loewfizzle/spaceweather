"use client";

/**
 * DataStatus — compact data-source health indicator for the LiveHeader.
 *
 * Silent when all sources are healthy (returns null to keep the header clean).
 * Shows an amber/red animated dot + short label when any source is degraded or down.
 * Clicking opens a panel listing per-source status with last-seen timestamps.
 *
 * Reactivity: subscribes to the 'aurorawatch:health' DOM event dispatched by
 * logDataError() and recordDataSuccess() — no polling required.
 */

import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  getDataHealth,
  getOverallHealthStatus,
  type DataHealthRecord,
  type DataSource,
  type HealthStatus,
} from "../lib/utils/retry";

// ─── Display metadata ─────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<DataSource, string> = {
  'kp':            'Kp Index',
  'ovation':       'OVATION Aurora',
  'plasma':        'Solar Wind Plasma',
  'mag':           'Magnetic Field',
  'kp-forecast':   'Kp Forecast',
  'xray-flares':   'X-Ray Flares',
  'alerts':        'NOAA Alerts',
  'solar-regions': 'Solar Regions',
  'fireballs':     'Fireballs',
  'cloud-cover':   'Cloud Cover',
};

// Render order: critical sources first so they're immediately visible in the panel
const SOURCE_ORDER: DataSource[] = [
  'kp', 'ovation', 'plasma', 'mag', 'kp-forecast',
  'xray-flares', 'alerts', 'solar-regions', 'fireballs', 'cloud-cover',
];

const STATUS_COLOR: Record<HealthStatus, string> = {
  healthy:  '#22c55e',
  degraded: '#eab308',
  down:     '#ef4444',
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy:  'All sources OK',
  degraded: 'Some sources delayed',
  down:     'Critical data unavailable',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceRow({ record }: { record: DataHealthRecord }) {
  const isError  = record.consecutiveErrors >= 1;
  const dotColor = isError ? '#ef4444' : '#22c55e';
  const refTime  = isError ? record.lastError : record.lastSuccess;

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <span className="truncate text-[11px] text-[#94a3b8]">
          {SOURCE_LABELS[record.source]}
        </span>
        {isError && record.lastErrorMessage && (
          <span className="hidden sm:block max-w-[110px] truncate text-[9px] text-[#475569]">
            {record.lastErrorMessage}
          </span>
        )}
      </div>
      <span className="shrink-0 tabular-nums text-[10px] text-[#64748b]">
        {refTime ? formatDistanceToNow(refTime, { addSuffix: true }) : '—'}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DataStatus() {
  const [status,  setStatus]  = useState<HealthStatus>('healthy');
  const [records, setRecords] = useState<DataHealthRecord[]>([]);
  const [open,    setOpen]    = useState(false);
  const panelRef   = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Subscribe to health-change events emitted by logDataError / recordDataSuccess.
  // Function is defined inside the effect so setState calls happen only from
  // event handlers, satisfying the react-hooks/purity constraint.
  useEffect(() => {
    function refresh() {
      setStatus(getOverallHealthStatus());
      const map = getDataHealth();
      setRecords(
        SOURCE_ORDER
          .map((s) => map.get(s))
          .filter((r): r is DataHealthRecord => r !== undefined)
      );
    }
    refresh();
    window.addEventListener('aurorawatch:health', refresh);
    return () => window.removeEventListener('aurorawatch:health', refresh);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // Close on Escape, return focus to trigger
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Only surface the indicator when there's a problem — the live-dot in the
  // header already signals "everything is fine."
  if (status === 'healthy') return null;

  const color = STATUS_COLOR[status];
  const label = STATUS_LABEL[status];

  const errored = records.filter((r) => r.consecutiveErrors >= 1);
  const ok      = records.filter((r) => r.consecutiveErrors === 0 && r.lastSuccess !== null);

  return (
    <div className="relative">
      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Data health: ${label}. Click for details.`}
        title={label}
        className="flex items-center gap-1.5 text-[10px] transition-opacity hover:opacity-80"
      >
        {/* Animated status dot */}
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ backgroundColor: color }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
        </span>
        {/* Short text label — only visible on sm+ to avoid header crowding on mobile */}
        <span className="hidden font-medium sm:inline" style={{ color }}>
          {status === 'down' ? 'Unavailable' : 'Delayed'}
        </span>
      </button>

      {/* ── Detail panel ── */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Data source health details"
          className="absolute right-0 top-full z-50 mt-2 w-[260px] rounded-xl border border-[#1e2937] bg-[#0c1222] p-3 shadow-xl shadow-black/50"
        >
          {/* Header row */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[2px] text-[#475569]">
              Data Sources
            </span>
            <span className="text-[10px] font-medium" style={{ color }}>
              {label}
            </span>
          </div>

          {/* Errored sources first */}
          {errored.length > 0 && (
            <div>
              {errored.map((r) => <SourceRow key={r.source} record={r} />)}
            </div>
          )}

          {/* Divider between errored and healthy rows */}
          {errored.length > 0 && ok.length > 0 && (
            <div className="my-2 border-t border-[#1e2937]" />
          )}

          {/* Healthy sources */}
          {ok.length > 0 && (
            <div>
              {ok.map((r) => <SourceRow key={r.source} record={r} />)}
            </div>
          )}

          {records.length === 0 && (
            <p className="py-1 text-[11px] text-[#64748b]">
              No data tracked yet this session.
            </p>
          )}

          <div className="mt-2.5 border-t border-[#1e2937] pt-2 text-[9px] text-[#334155]">
            Health resets on page reload · Data from NOAA SWPC + NASA
          </div>
        </div>
      )}
    </div>
  );
}
