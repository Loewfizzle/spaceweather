"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 1, // 1 minute default; individual hooks override for freshness needs
            refetchInterval: 1000 * 60 * 5, // 5 minutes — balanced for live NOAA feel
            refetchOnWindowFocus: true,
            retry: 0, // Per-hook override for critical vs non-critical (see use-noaa-data.ts)
            gcTime: 1000 * 60 * 10, // 10 min default cache retention
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
