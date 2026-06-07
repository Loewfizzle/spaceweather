"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/**
 * Renders a subtle location dot at the user's granted coordinates.
 *
 * Visual design:
 *   • 20 px outer ring  — semi-transparent accent-blue circle
 *   • 6 px inner dot    — white with a soft blue glow
 *   • Probability badge — small dark pill above the ring (hidden if prob is null)
 *
 * Uses L.divIcon + L.marker because it needs to sit in Leaflet's markerPane
 * (above the overlayPane where the canvas aurora blobs live).
 * The marker is non-interactive so map clicks/pans pass through normally.
 */
export function UserLocationMarker({
  lat,
  lon,
  prob,
}: {
  lat: number;
  lon: number;
  prob: number | null;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    const SIZE = 20;

    const probBadge =
      prob !== null
        ? `<div style="
            position:absolute;
            bottom:${SIZE + 5}px;
            left:50%;
            transform:translateX(-50%);
            white-space:nowrap;
            background:rgba(15,20,37,0.92);
            border:1px solid rgba(30,41,55,0.9);
            border-radius:4px;
            padding:2px 7px;
            font-size:9px;
            color:#94a3b8;
            font-family:ui-monospace,monospace;
            letter-spacing:0.03em;
            pointer-events:none;
          ">${prob > 0 ? prob + "%" : "< 1%"}</div>`
        : "";

    const icon = L.divIcon({
      html: `
        <div style="width:${SIZE}px;height:${SIZE}px;position:relative;">
          ${probBadge}
          <!-- outer ring -->
          <div style="
            position:absolute;inset:0;border-radius:50%;
            background:rgba(59,130,246,0.12);
            border:1.5px solid rgba(59,130,246,0.65);
          "></div>
          <!-- inner dot -->
          <div style="
            position:absolute;
            top:50%;left:50%;
            width:6px;height:6px;
            margin:-3px 0 0 -3px;
            border-radius:50%;
            background:#f1f5f9;
            box-shadow:0 0 6px rgba(59,130,246,0.5);
          "></div>
        </div>
      `,
      className: "",
      iconSize: [SIZE, SIZE],
      iconAnchor: [SIZE / 2, SIZE / 2],
    });

    const marker = L.marker([lat, lon], {
      icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    });
    marker.addTo(map);
    markerRef.current = marker;

    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [map, lat, lon, prob]);

  return null;
}
