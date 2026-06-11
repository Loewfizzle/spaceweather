"use client";

import { useQuery } from "@tanstack/react-query";
import {
  exponentialBackoff,
  shouldRetryNonCritical,
} from "../utils/retry";
import { fetchFireballs } from "../api/fetchers";
import type { Fireball } from "../api/schemas";

// Fireball tracker (proxied via our /api/fireballs route to avoid CORS issues in production)
export function useFireballs(limit = 5) {
  const query = useQuery<Fireball[]>({
    queryKey: ["fireballs", limit],
    queryFn: () => fetchFireballs(limit),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 4,
    refetchInterval: false,
    retry: shouldRetryNonCritical,
    retryDelay: exponentialBackoff,
  });

  return {
    fireballs: (query.data || []) as Fireball[],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
