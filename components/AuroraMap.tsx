"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useOvationData } from "../lib/use-noaa-data";
import { filterOvationCoordinates, getAuroraColor, getAuroraMarkerRadius } from "../lib/noaa";

// leaflet.heat augments Leaflet with L.heatLayer (canvas-based, high performance for dense point data)
declare module "leaflet" {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: Record<string, string>;
    }
  ): L.Layer;
}

// Fix Leaflet default icon issue in Next.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface AuroraMapProps {
  minProb?: number;
}

function HeatmapLayer({ points }: { points: { position: [number, number]; prob: number }[] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('leaflet.heat');
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!points || points.length === 0) return;

    // [lat, lon, intensity 0-1]. Power scaling gives visual pop at high probs while keeping low-end subtle.
    const heatData = points.map((p) => [
      p.position[0],
      p.position[1],
      Math.max(0.05, Math.pow(p.prob / 100, 0.7)),
    ] as [number, number, number]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heat = (L as any).heatLayer(heatData, {
      radius: 20,
      blur: 16,
      maxZoom: 5,
      minOpacity: 0.25,
      gradient: {
        "0.0": "rgba(22, 101, 52, 0.12)",
        "0.15": "#22c55e",
        "0.4": "#eab308",
        "0.6": "#f97316",
        "0.82": "#a78bfa",
        "1.0": "#c084fc",
      },
    });

    heat.addTo(map);
    layerRef.current = heat;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
}

export default function AuroraMap({ minProb = 3 }: AuroraMapProps) {
  const { data: ovationData, isLoading, error, refetch } = useOvationData();

  const points = useMemo(() => {
    const raw = filterOvationCoordinates(ovationData?.coordinates, minProb);
    return raw
      .map((p) => ({
        position: [p.lat, p.lon] as [number, number],
        prob: Math.round(p.prob),
      }))
      .filter(
        (p) =>
          isFinite(p.position[0]) && isFinite(p.position[1]) &&
          p.position[0] >= -90 && p.position[0] <= 90 &&
          p.position[1] >= -180 && p.position[1] <= 180
      );
  }, [ovationData, minProb]);

  // Only render CircleMarkers for genuine peaks — the heatmap handles the full low-to-mid field.
  // Threshold at 25: below that, the oval produces dense horizontal bands of markers at Kp 5–6.
  const highProbThreshold = Math.max(minProb, 25);
  const highProbPoints = useMemo(
    () => points.filter((p) => p.prob >= highProbThreshold),
    [points, highProbThreshold]
  );

  const isEmpty = !isLoading && !error && points.length === 0;

  if (isLoading) {
    return (
      <div className="map-placeholder h-[420px] sm:h-[480px] md:h-[520px] flex items-center justify-center">
        <div className="text-center">
          <div className="h-4 w-32 bg-[#1e2937] rounded animate-pulse mb-2 mx-auto" />
          <div className="text-[#64748b] text-sm">Syncing OVATION aurora data…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-placeholder h-[420px] sm:h-[480px] md:h-[520px] flex items-center justify-center">
        <div className="text-center text-sm">
          <div className="text-[#94a3b8] mb-2">Aurora data temporarily unavailable.</div>
          <button onClick={() => refetch()} className="text-[#64748b] underline underline-offset-2 hover:text-white transition-colors">
            Try refreshing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1e2937] bg-[#05070f]">
      <div className="h-[420px] sm:h-[480px] md:h-[520px]">
        <MapContainer
          center={[48, -100]}
          zoom={3}
          style={{ height: "100%", width: "100%", background: "#05070f" }}
          className="z-0"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <HeatmapLayer points={points} />
          {highProbPoints.map((p, idx) => (
            <CircleMarker
              key={idx}
              center={p.position}
              radius={getAuroraMarkerRadius(p.prob)}
              pathOptions={{
                color: getAuroraColor(p.prob),
                fillColor: getAuroraColor(p.prob),
                fillOpacity: 0.85,
                weight: 0.8,
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
      </div>

      {/* Empty state: centered overlay when no aurora areas pass the current filter.
          pointer-events-none so the map stays pannable/zoomable beneath it. */}
      {isEmpty && (
        <div className="absolute inset-0 z-[10] flex items-center justify-center pointer-events-none">
          <div className="bg-[#0a0e1a]/85 backdrop-blur-sm border border-[#1e2937] rounded-xl px-5 py-4 text-center mx-6 max-w-[260px]">
            <div className="text-[#94a3b8] text-sm font-medium mb-1.5">
              {minProb > 3 ? "No areas above threshold" : "Geomagnetically quiet"}
            </div>
            <div className="text-[10px] text-[#64748b] leading-relaxed">
              {minProb > 3
                ? `No aurora areas ≥ ${minProb}% visible. Lower the filter slider to see more of the oval.`
                : "The aurora oval is currently positioned away from North America. Conditions may improve when Kp rises."}
            </div>
          </div>
        </div>
      )}

      {/* Legend — z-[20] keeps it above the empty state overlay */}
      <div className="absolute bottom-3 right-3 z-[20] rounded-lg border border-[#1e2937] bg-[#0f1425]/95 px-3 py-2 text-[10px] text-[#cbd5e1] shadow backdrop-blur-sm">
        <div className="mb-1 font-medium tracking-wide">Aurora Probability</div>
        <div
          className="h-2 w-32 rounded-full mb-1 border border-[#1e2937]/50"
          style={{
            background:
              "linear-gradient(to right, #166534, #22c55e, #eab308, #f97316, #a78bfa, #c084fc)",
          }}
        />
        <div className="flex justify-between text-[9px] text-[#64748b] w-32 mb-1 tabular-nums">
          <span>0</span>
          <span>50</span>
          <span>100%</span>
        </div>
        <div className="text-[9px] text-[#475569] tabular-nums">
          {points.length} areas{minProb > 0 ? ` ≥ ${minProb}%` : ""} · NA
        </div>
      </div>
    </div>
  );
}
