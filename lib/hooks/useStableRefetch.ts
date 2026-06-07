"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

// Returns a stable refetchAll callback that always calls the latest version of each
// refetch function without becoming a new reference on every render. TanStack Query
// builds new result objects (and new .refetch closures) each render, so putting query
// results in useCallback deps would recreate refetchAll every time.
export function useStableRefetch(refetches: Record<string, () => unknown>): () => void {
  const _refs = useRef(refetches);
  useLayoutEffect(() => {
    _refs.current = refetches;
  });
  return useCallback(() => {
    Object.values(_refs.current).forEach(fn => fn());
  }, []);
}
