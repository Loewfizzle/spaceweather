interface LoadingSkeletonProps {
  variant?: "card" | "map" | "list" | "chart" | "metrics" | "full" | "page";
  count?: number;
  className?: string;
}

/**
 * Reusable loading skeleton with variants matching the dashboard's design system.
 * Used across all sections for consistent premium loading experience.
 */
export function LoadingSkeleton({
  variant = "card",
  count = 1,
  className = "",
}: LoadingSkeletonProps) {
  const base = "animate-pulse bg-[#1e2937] rounded";

  if (variant === "page") {
    return (
      <div className="min-h-screen pb-12">
        <header className="header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`${base} w-8 h-8 rounded-full`} />
              <div className="space-y-1">
                <div className={`${base} h-4 w-28`} />
                <div className={`${base} h-2 w-20`} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`${base} h-7 w-16 rounded-full`} />
              <div className={`${base} h-5 w-12 rounded-full`} />
              <div className={`${base} h-3 w-16`} />
              <div className={`${base} h-8 w-9 sm:w-20 rounded-full`} />
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-4">
          <div className="max-w-3xl">
            <div className={`${base} h-2.5 w-36 mb-3`} />
            <div className="space-y-3 mb-5">
              <div className={`${base} h-14 w-full`} />
              <div className={`${base} h-14 w-4/5`} />
            </div>
            <div className={`${base} h-5 w-72`} />
          </div>
          <div className="section-title">AURORA OUTLOOK</div>
          <div className="mt-0 card p-6 max-w-3xl">
            <div className={`${base} h-2.5 w-40 mb-3`} />
            <div className={`${base} h-8 w-32 mb-3`} />
            <div className={`${base} h-4 w-full mb-1`} />
            <div className={`${base} h-4 w-5/6`} />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="section-title">AURORA MAP — OVATION MODEL</div>
          <LoadingSkeleton variant="map" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <div className="section-title">LIVE CONDITIONS</div>
          <LoadingSkeleton variant="metrics" count={4} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="section-title">KP OUTLOOK + MICHIGAN FORECAST</div>
          <LoadingSkeleton variant="chart" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <div className="section-title">SOLAR ACTIVITY</div>
          <LoadingSkeleton variant="metrics" count={4} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <LoadingSkeleton variant="card" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="section-title">METEOR ACTIVITY</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LoadingSkeleton variant="card" />
            <LoadingSkeleton variant="list" count={4} />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className={`${base} h-8 w-48`} />
        <div className={`${base} h-64 w-full`} />
      </div>
    );
  }

  if (variant === "map") {
    return (
      <div className={`map-placeholder h-[420px] sm:h-[480px] md:h-[520px] flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className={`${base} h-4 w-32 mb-2 mx-auto`} />
          <div className="text-[#64748b] text-sm">Loading map data…</div>
        </div>
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={`card p-6 ${className}`}>
        <div className={`${base} h-56 w-full`} />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className={`${base} h-4 w-3/4`} />
          <div className={`${base} h-4 w-2/3`} />
        </div>
      </div>
    );
  }

  if (variant === "metrics") {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="metric">
            <div className={`${base} h-3 w-16 mb-3`} />
            <div className={`${base} h-8 w-14 mb-1`} />
            <div className={`${base} h-3 w-20`} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`${base} h-9 w-full`} />
        ))}
      </div>
    );
  }

  // default "card"
  return (
    <div className={`card p-5 space-y-3 ${className}`}>
      <div className={`${base} h-3 w-28`} />
      <div className={`${base} h-6 w-40`} />
      <div className={`${base} h-4 w-full`} />
      <div className={`${base} h-4 w-5/6`} />
    </div>
  );
}
