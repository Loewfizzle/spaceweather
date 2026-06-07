"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { logDataError } from "../lib/utils/retry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((resetError: () => void) => ReactNode);
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logDataError('ErrorBoundary', error, { componentStack: errorInfo.componentStack }, true);
  }

  render() {
    if (this.state.hasError) {
      const resetError = () => this.setState({ hasError: false });

      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(resetError);
      }

      if (this.props.fallback != null) {
        return this.props.fallback;
      }

      return (
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-[#94a3b8] mb-4 text-sm">
            The dashboard encountered an unexpected error. Please refresh the page.
          </p>
          <button onClick={resetError} className="button">
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
