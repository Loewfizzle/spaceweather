// app/loading.tsx
// Full-page skeleton for improved initial load experience and perceived performance.
// Matches the premium dark theme, layout structure, and animate-pulse style of existing skeletons.

export default function AuroraWatchLoading() {
  return (
    <div className="min-h-screen pb-12">
      {/* Sticky Header skeleton */}
      <header className="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1e2937] animate-pulse" />
            <div>
              <div className="h-5 w-28 bg-[#1e2937] rounded animate-pulse" />
              <div className="h-2.5 w-36 bg-[#1e2937] rounded animate-pulse mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Kp pill skeleton */}
            <div className="h-8 w-20 bg-[#1e2937] rounded-full animate-pulse" />
            {/* Risk pill skeleton */}
            <div className="h-5 w-14 bg-[#1e2937] rounded-full animate-pulse" />
            {/* Time skeleton (hidden on mobile) */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="h-3 w-3 bg-[#1e2937] rounded animate-pulse" />
              <div className="h-3 w-20 bg-[#1e2937] rounded animate-pulse" />
            </div>
            {/* Refresh button skeleton */}
            <div className="h-8 w-20 bg-[#1e2937] rounded-full animate-pulse" />
          </div>
        </div>
      </header>

      {/* Hero + Tonight’s Outlook + Sky skeleton (mirrors real prominent decision cluster at top) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        <div className="max-w-3xl">
          <div className="h-3 w-40 bg-[#1e2937] rounded animate-pulse mb-3" />
          <div className="space-y-2 mb-5">
            <div className="h-14 w-full max-w-md bg-[#1e2937] rounded animate-pulse" />
            <div className="h-14 w-3/4 max-w-sm bg-[#1e2937] rounded animate-pulse" />
          </div>
          <div className="h-6 w-80 bg-[#1e2937] rounded animate-pulse" />
        </div>

        {/* Tonight’s Michigan Outlook card skeleton */}
        <div className="mt-8 card p-6 max-w-3xl border-l-4 border-l-[#22c55e]">
          <div className="space-y-3">
            <div className="h-3 w-48 bg-[#1e2937] rounded animate-pulse" />
            <div className="flex items-baseline gap-3">
              <div className="h-8 w-32 bg-[#1e2937] rounded animate-pulse" />
              <div className="h-4 w-24 bg-[#1e2937] rounded animate-pulse" />
            </div>
            <div className="h-4 w-full bg-[#1e2937] rounded animate-pulse" />
            <div className="h-3 w-5/6 bg-[#1e2937] rounded animate-pulse" />
          </div>
        </div>

        {/* Sky Conditions grid skeleton (3 locations) */}
        <div className="mt-6 max-w-3xl">
          <div className="h-3 w-44 bg-[#1e2937] rounded animate-pulse mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="metric p-4">
                <div className="h-3 w-20 bg-[#1e2937] rounded animate-pulse mb-2" />
                <div className="h-6 w-12 bg-[#1e2937] rounded animate-pulse mb-1" />
                <div className="h-3 w-24 bg-[#1e2937] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Row skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="section-title flex items-baseline justify-between">
          <span>CURRENT CONDITIONS</span>
          <div className="h-3 w-40 bg-[#1e2937] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="metric">
              <div className="h-3 w-16 bg-[#1e2937] rounded animate-pulse mb-3" />
              <div className="h-8 w-14 bg-[#1e2937] rounded animate-pulse mb-1" />
              <div className="h-3 w-20 bg-[#1e2937] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Map Section skeleton (moved higher to match real IA — primary visual early) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
          <div>
            <div className="section-title">AURORA MAP — OVATION MODEL</div>
            <div className="h-4 w-64 bg-[#1e2937] rounded animate-pulse" />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-20 bg-[#1e2937] rounded-full animate-pulse" />
            ))}
            <div className="h-8 w-28 bg-[#1e2937] rounded-full animate-pulse ml-2" />
          </div>
        </div>

        {/* Map placeholder skeleton */}
        <div className="map-placeholder h-[420px] sm:h-[480px] md:h-[520px] flex items-center justify-center">
          <div className="text-center">
            <div className="h-4 w-32 bg-[#1e2937] rounded animate-pulse mb-2 mx-auto" />
            <div className="text-[#64748b] text-sm">Preparing live aurora map…</div>
          </div>
        </div>
      </div>

      {/* KP OUTLOOK skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="section-title">KP OUTLOOK + MICHIGAN FORECAST</div>
        <div className="card p-6">
          <div className="h-56 bg-[#1e2937] rounded-xl animate-pulse flex items-center justify-center">
            <div className="text-[#64748b] text-sm">Loading Kp history…</div>
          </div>
          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            <div className="h-4 w-3/4 bg-[#1e2937] rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-[#1e2937] rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* SOLAR ACTIVITY skeleton (after Kp to match reorganized page) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="section-title flex items-baseline justify-between">
          <span>SOLAR ACTIVITY</span>
          <div className="h-3 w-56 bg-[#1e2937] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="metric">
              <div className="h-3 w-16 bg-[#1e2937] rounded animate-pulse mb-3" />
              <div className="h-8 w-14 bg-[#1e2937] rounded animate-pulse mb-1" />
              <div className="h-3 w-20 bg-[#1e2937] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Alerts skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-[#1e2937] rounded animate-pulse" />
              <div className="h-4 w-full bg-[#1e2937] rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-[#1e2937] rounded animate-pulse" />
            </div>
            <div className="h-10 w-40 bg-[#1e2937] rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <footer className="border-t border-[#1e2937] pt-8 pb-10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-3 w-full max-w-md bg-[#1e2937] rounded animate-pulse" />
          <div className="mt-4 h-3 w-48 bg-[#1e2937] rounded animate-pulse" />
        </div>
      </footer>
    </div>
  );
}
