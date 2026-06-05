"use client";

import type { TonightOutlook } from "../lib/use-noaa-data";

interface HeroOutlookProps {
  outlook: TonightOutlook;
  isLoading?: boolean;
  error?: Error | null;
  isFetching?: boolean;
}

/**
 * HeroOutlook
 * The prominent "Tonight’s Michigan Outlook" card.
 * Receives pre-computed outlook (from getTonightOutlook pure fn) + loading/error flags.
 * Exact markup, border accent via inline style, reasons dots, drivers, pulse, and error message preserved 100%.
 */
export function HeroOutlook({ outlook, isLoading, error, isFetching }: HeroOutlookProps) {
  return (
    <div
      className="mt-8 card p-6 max-w-3xl border-l-4"
      style={{ borderLeftColor: outlook.accentColor }}
    >
      <div>
        <div className="uppercase tracking-[2.5px] text-[10px] text-[#64748b] mb-2">
          TONIGHT’S MICHIGAN OUTLOOK
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
          <div
            className="text-4xl font-semibold tracking-tighter"
            style={{ color: outlook.accentColor }}
          >
            {outlook.status}
          </div>
          {outlook.drivers && outlook.status !== "Loading" && (
            <div className="text-sm text-[#64748b] tabular-nums font-medium">
              {outlook.drivers}
            </div>
          )}
        </div>

        <p className="text-[#cbd5e1] text-[15px] leading-relaxed mb-3">
          {outlook.message}
        </p>

        {outlook.reasons.length > 0 && (
          <div className="space-y-1 mb-1">
            {outlook.reasons.map((reason, idx) => (
              <div key={idx} className="text-sm text-[#94a3b8] flex items-start gap-2">
                <span
                  className="mt-1.5 block h-1 w-1 rounded-full flex-shrink-0"
                  style={{ backgroundColor: outlook.accentColor }}
                />
                {reason}
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="mt-3 h-4 w-2/3 bg-[#1e2937] rounded animate-pulse" />
      )}
      {error && (
        <div className="mt-2 text-xs text-amber-400">
          Some data sources unavailable — displaying last known values.
          {isFetching && ' (retrying…)'}
        </div>
      )}
    </div>
  );
}
