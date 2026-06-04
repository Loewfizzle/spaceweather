"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useOvationData } from "../lib/use-noaa-data";

// Fix Leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapTarget {
  center: [number, number];
  zoom: number;
}

interface AuroraMapProps {
  target: MapTarget | null;
}

function MapController({ target }: { target: MapTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (target) {
      map.flyTo(target.center, target.zoom, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [target, map]);

  return null;
}

export default function AuroraMap({ target }: AuroraMapProps) {
  const { data: ovationData, isLoading, error } = useOvationData();

  // Filter for North America performance + relevance
  // lon: -170 to -50, lat: 20 to 75, prob > 3
  const points = useMemo(() => {
    if (!ovationData?.coordinates) return [];
    return ovationData.coordinates
      .filter(([lon, lat, prob]) => {
        return (
          lon >= -170 &&
          lon <= -50 &&
          lat >= 20 &&
          lat <= 75 &&
          prob >= 3
        );
      })
      .map(([lon, lat, prob]) => ({
        position: [lat, lon] as [number, number], // Leaflet is [lat, lon]
        prob: Math.round(prob),
      }));
  }, [ovationData]);

  const getColor = (prob: number) => {
    if (prob < 10) return "#22c55e"; // green - low
    if (prob < 25) return "#eab308"; // yellow
    if (prob < 50) return "#f97316"; // orange
    return "#a78bfa"; // violet - high
  };

  const getRadius = (prob: number) => {
    if (prob < 10) return 2.5;
    if (prob < 25) return 3;
    return 3.5;
  };

  if (isLoading) {
    return (
      <div className="map-placeholder h-[420px] sm:h-[480px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-[#64748b]">Loading OVATION data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-placeholder h-[420px] sm:h-[480px] flex items-center justify-center text-red-400">
        Failed to load aurora data. Please try refreshing.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1e2937]">
      <MapContainer
        center={[48, -100]}
        zoom={3}
        style={{ height: "480px", width: "100%", background: "#05070f" }}
        className="z-0"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController target={target} />

        {points.map((p, idx) => (
          <CircleMarker
            key={idx}
            center={p.position}
            radius={getRadius(p.prob)}
            pathOptions={{
              color: getColor(p.prob),
              fillColor: getColor(p.prob),
              fillOpacity: 0.75,
              weight: 0.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
              <div className="text-xs">
                <div className="font-semibold">Aurora probability: {p.prob}%</div>
                <div className="text-[#64748b]">
                  {p.position[0].toFixed(1)}°N, {Math.abs(p.position[1]).toFixed(1)}°W
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-[#1e2937] bg-[#0f1425]/95 px-3 py-2 text-[10px] text-[#cbd5e1] shadow">
        <div className="mb-1 font-medium tracking-wide">Aurora Probability</div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#22c55e" }} /> Low (3-10%)
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#eab308" }} /> Med
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#a78bfa" }} /> High (50%+)
        </div>
        <div className="mt-1 text-[9px] text-[#64748b]">Filtered NA points • {points.length} shown</div>
      </div>
    </div>
  );
}
