"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function TileErrorDetector({ onError }: { onError: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.on('tileerror', onError);
    return () => { map.off('tileerror', onError); };
  }, [map, onError]);
  return null;
}
