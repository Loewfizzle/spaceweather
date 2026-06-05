import React from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Reusable empty state for when no data is available.
 */
export function EmptyState({
  title = "No data available",
  description = "There's nothing to show right now.",
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`card p-6 text-center ${className}`}>
      <div className="text-[#64748b] text-sm">{title}</div>
      <p className="text-[#94a3b8] text-xs mt-1">{description}</p>
    </div>
  );
}
