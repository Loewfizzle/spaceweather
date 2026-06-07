"use client";

import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  message: string;
  /** Wrapper className — override only the bottom-padding when the default doesn't fit. */
  className?: string;
}

/**
 * Thin wrapper around ErrorBoundary that provides the standard dashboard
 * section shell: constrained-width padding div + ErrorState fallback.
 * Removes the repeated inline fallback pattern from DashboardClient.
 */
export function SectionErrorBoundary({
  children,
  message,
  className = "max-w-7xl mx-auto px-4 sm:px-6 pb-12",
}: SectionErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(reset) => (
        <div className={className}>
          <ErrorState message={message} onRetry={reset} />
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
