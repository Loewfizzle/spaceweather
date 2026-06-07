"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useUserLocation, type UserLocationState, type LocationSource } from "../hooks/useUserLocation";

export interface UserLocationContextValue {
  state: UserLocationState;
  requestGpsLocation: () => void;
  setManualLocation: (lat: number, lon: number, label: string) => void;
  clearLocation: () => void;
  userLat: number | null;
  userLon: number | null;
  userLocationLabel: string | null;
  locationSource: LocationSource | null;
  isLocating: boolean;
  locationTimedOut: boolean;
  onRequestLocation: (() => void) | undefined;
}

const UserLocationContext = createContext<UserLocationContextValue | null>(null);

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const { state, requestGpsLocation, setManualLocation, clearLocation } = useUserLocation();

  const value = useMemo<UserLocationContextValue>(() => ({
    state,
    requestGpsLocation,
    setManualLocation,
    clearLocation,
    userLat: state.status === "set" ? state.lat : null,
    userLon: state.status === "set" ? state.lon : null,
    userLocationLabel: state.status === "set" ? state.label : null,
    locationSource: state.status === "set" ? state.source : null,
    isLocating: state.status === "gps-loading",
    locationTimedOut: state.status === "gps-timeout",
    onRequestLocation:
      state.status === "idle" ||
      state.status === "gps-timeout" ||
      state.status === "gps-unavailable"
        ? requestGpsLocation
        : undefined,
  }), [state, requestGpsLocation, setManualLocation, clearLocation]);

  return (
    <UserLocationContext.Provider value={value}>
      {children}
    </UserLocationContext.Provider>
  );
}

export function useUserLocationContext(): UserLocationContextValue {
  const ctx = useContext(UserLocationContext);
  if (!ctx) throw new Error("useUserLocationContext must be used inside UserLocationProvider");
  return ctx;
}
