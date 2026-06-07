"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/**
 * Saves the map's current center + zoom to localStorage on every moveend/zoomend.
 * The stored value is read once on AuroraMap mount to restore the user's last view.
 */
export function MapStateTracker() {
  const map = useMap();
  useEffect(() => {
    const save = () => {
      const { lat, lng } = map.getCenter();
      const zoom = map.getZoom();
      try {
        localStorage.setItem(
          "aurora-map-state",
          JSON.stringify({ lat, lng, zoom })
        );
      } catch { /* storage full or unavailable */ }
    };
    map.on("moveend zoomend", save);
    return () => { map.off("moveend zoomend", save); };
  }, [map]);
  return null;
}

// Captures the Leaflet map instance and exposes it to the parent via callback.
// Must be rendered inside MapContainer so useMap() resolves.
export function MapInstanceCapture({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}
