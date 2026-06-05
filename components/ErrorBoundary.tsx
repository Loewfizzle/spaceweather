"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Top-level Error Boundary for the dashboard.
 * Catches render errors in child components (e.g. map, charts) gracefully.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AuroraWatch ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="card p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-[#94a3b8] mb-4 text-sm">
              The dashboard encountered an unexpected error. Please refresh the page.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="button"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
