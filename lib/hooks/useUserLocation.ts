"use client";

import { useState, useCallback, useEffect } from "react";
import { getNearestCityName } from "../noaa";

export type LocationSource = "gps" | "manual";

export type UserLocationState =
  | { status: "idle" }
  | { status: "gps-loading" }
  | { status: "gps-denied" }
  | { status: "gps-timeout" }
  | { status: "gps-unavailable" }
  | { status: "set"; lat: number; lon: number; label: string; source: LocationSource };

interface PersistedLocation {
  lat: number;
  lon: number;
  label: string;
  source: LocationSource;
}

const LS_KEY = "user-location";

function readSaved(): Extract<UserLocationState, { status: "set" }> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p: PersistedLocation = JSON.parse(raw);
    if (
      typeof p.lat === "number" &&
      typeof p.lon === "number" &&
      typeof p.label === "string" &&
      (p.source === "gps" || p.source === "manual")
    ) {
      return { status: "set", lat: p.lat, lon: p.lon, label: p.label, source: p.source };
    }
  } catch {}
  return null;
}

function persist(loc: PersistedLocation) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(loc)); } catch {}
}

function clear() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({ status: "idle" });

  // Hydrate from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const saved = readSaved();
    if (saved) setState(saved);
  }, []);

  const requestGpsLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "gps-unavailable" });
      return;
    }
    setState({ status: "gps-loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const label = getNearestCityName(lat, lon);
        setState({ status: "set", lat, lon, label, source: "gps" });
        persist({ lat, lon, label, source: "gps" });
      },
      (err) => {
        clear();
        setState(err.code === 3 ? { status: "gps-timeout" } : { status: "gps-denied" });
      },
      { timeout: 10_000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  const setManualLocation = useCallback((lat: number, lon: number, label: string) => {
    setState({ status: "set", lat, lon, label, source: "manual" });
    persist({ lat, lon, label, source: "manual" });
  }, []);

  const clearLocation = useCallback(() => {
    clear();
    setState({ status: "idle" });
  }, []);

  return { state, requestGpsLocation, setManualLocation, clearLocation };
}
