import React from "react";
import { RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Reusable error state component with optional retry.
 * Consistent calm error presentation across the dashboard.
 */
export function ErrorState({
  message = "Something went wrong while loading data.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div className={`card p-6 text-center ${className}`}>
      <div className="text-red-400 text-sm mb-2">Error</div>
      <p className="text-[#cbd5e1] text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="button inline-flex items-center gap-2 text-xs px-4 py-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}
