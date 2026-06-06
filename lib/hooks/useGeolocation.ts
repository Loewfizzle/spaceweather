"use client";

import { useState, useCallback } from "react";

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "granted"; lat: number; lon: number }
  | { status: "denied"; error: string }
  | { status: "timeout" }
  | { status: "unavailable" };

export function useGeolocation() {
  const [geoState, setGeoState] = useState<GeoState>({ status: "idle" });

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoState({ status: "unavailable" });
      return;
    }
    setGeoState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeoState({
          status: "granted",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      (err) => {
        // code 1 = PERMISSION_DENIED (permanent, cannot retry without user action)
        // code 3 = TIMEOUT (transient, retry is safe)
        if (err.code === 3) {
          setGeoState({ status: "timeout" });
        } else {
          setGeoState({ status: "denied", error: err.message });
        }
      },
      { timeout: 10_000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  return { geoState, requestLocation };
}
