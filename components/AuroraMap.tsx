"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useOvationData } from "../lib/use-noaa-data";

// Fix Leaflet default icon issue in Next.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  minProb?: number;
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

export default function AuroraMap({ target, minProb = 3 }: AuroraMapProps) {
  const { data: ovationData, isLoading, error } = useOvationData();

  // Filter for North America performance + relevance + user min prob
  // lon: -170 to -50, lat: 20 to 75, prob >= minProb
  const points = useMemo(() => {
    if (!ovationData?.coordinates) return [];
    return ovationData.coordinates
      .filter(([lon, lat, prob]) => {
        return (
          lon >= -170 &&
          lon <= -50 &&
          lat >= 20 &&
          lat <= 75 &&
          prob >= minProb
        );
      })
      .map(([lon, lat, prob]) => ({
        position: [lat, lon] as [number, number], // Leaflet is [lat, lon]
        prob: Math.round(prob),
      }));
  }, [ovationData, minProb]);

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
          <div className="h-4 w-32 bg-[#1e2937] rounded animate-pulse mb-2 mx-auto" />
          <div className="text-[#64748b] text-sm">Loading live OVATION data…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-placeholder h-[420px] sm:h-[480px] flex items-center justify-center">
        <div className="text-center text-red-400 text-sm">
          Failed to load aurora data.<br />
          <button onClick={() => window.location.reload()} className="underline mt-1">Try refreshing</button>
        </div>
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
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#22c55e" }} /> Low
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#eab308" }} /> Med
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#a78bfa" }} /> High
        </div>
        <div className="mt-1 text-[9px] text-[#64748b]">
          min {minProb}% • {points.length} points shown (NA)
        </div>
      </div>
    </div>
  );
}
