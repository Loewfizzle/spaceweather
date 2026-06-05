import React from "react";

interface LoadingSkeletonProps {
  variant?: "card" | "map" | "list" | "chart" | "metrics" | "full";
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
