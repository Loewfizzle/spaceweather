"use client";

import { useState, useCallback } from "react";

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "granted"; lat: number; lon: number }
  | { status: "denied"; error: string }
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
      (err) => setGeoState({ status: "denied", error: err.message }),
      { timeout: 10_000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  return { geoState, requestLocation };
}
