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

/**
 * Canvas heatmap layer (using leaflet.heat).
 * High performance even with thousands of OVATION points.
 * Provides the smooth, glowing aurora probability field.
 * Intensity + gradient tuned for premium dark theme + aurora aesthetics.
 */
function HeatmapLayer({ points }: { points: { position: [number, number]; prob: number }[] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('leaflet.heat');
    // Cleanup previous layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!points || points.length === 0) {
      return;
    }

    // Prepare data: [lat, lon, intensity 0-1]. Use pow scaling for better visual pop on higher probs while keeping low-end subtle.
    const heatData = points.map((p) => [
      p.position[0],
      p.position[1],
      Math.max(0.05, Math.pow(p.prob / 100, 0.7)),
    ] as [number, number, number]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heat = (L as any).heatLayer(heatData, {
      radius: 20, // base size of heat blobs; good balance on mobile + desktop
      blur: 16,
      maxZoom: 5,
      minOpacity: 0.25,
      gradient: {
        "0.0": "rgba(22, 101, 52, 0.12)", // very subtle dark green for faint background
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

export default function AuroraMap({ target, minProb = 3 }: AuroraMapProps) {
  const { data: ovationData, isLoading, error } = useOvationData();

  // Use shared utility (filtering logic moved out of component for separation of concerns + DRY)
  const points = useMemo(() => {
    // ovationData may be undefined while loading; coordinates optional per schema.
    const raw = filterOvationCoordinates(ovationData?.coordinates, minProb);
    return raw.map((p) => ({
      position: [p.lat, p.lon] as [number, number], // Leaflet is [lat, lon]
      prob: Math.round(p.prob),
    }));
  }, [ovationData, minProb]);

  // High probability markers for precise interaction + visual pop on top of the heatmap field
  const highProbThreshold = Math.max(minProb, 10);
  const highProbPoints = useMemo(
    () => points.filter((p) => p.prob >= highProbThreshold),
    [points, highProbThreshold]
  );

  const observationTime = ovationData?.["Observation Time"];

  const formatObservationTime = (iso?: string) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " UTC";
    } catch {
      return null;
    }
  };

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
        <div className="text-center text-red-400 text-sm">
          Failed to load aurora data.<br />
          <button onClick={() => window.location.reload()} className="underline mt-1">Try refreshing</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1e2937] bg-[#05070f]">
      {/* Responsive height container; map fills it. Improved polish vs fixed inline style. */}
      <div className="h-[420px] sm:h-[480px] md:h-[520px]">
        <MapContainer
          center={[48, -100]}
          zoom={3}
          style={{ height: "100%", width: "100%", background: "#05070f" }}
          className="z-0"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController target={target} />

          {/* Smooth, performant canvas heatmap - the primary visualization for the aurora probability field */}
          <HeatmapLayer points={points} />

          {/* Hybrid: only render CircleMarkers for higher-prob "peaks" (precise tooltips + visual emphasis).
              The heatmap handles the smooth low-to-mid field for all points >= minProb. */}
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

      {/* Improved premium legend with gradient bar, better info, data freshness, and quiet-state guidance */}
      <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-[#1e2937] bg-[#0f1425]/95 px-3 py-2 text-[10px] text-[#cbd5e1] shadow backdrop-blur-sm">
        <div className="mb-1 font-medium tracking-wide">Aurora Probability (OVATION)</div>

        {/* Smooth gradient bar matching the heatmap stops */}
        <div
          className="h-2 w-36 rounded-full mb-1 border border-[#1e2937]/50"
          style={{
            background:
              "linear-gradient(to right, #166534, #22c55e, #eab308, #f97316, #a78bfa, #c084fc)",
          }}
        />
        <div className="flex justify-between text-[9px] text-[#64748b] w-36 mb-1 tabular-nums">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100%</span>
        </div>

        <div className="text-[9px] text-[#64748b]">
          {minProb > 0 ? `≥ ${minProb}% • ` : ""}
          {points.length} areas (NA)
        </div>

        {observationTime && (
          <div className="mt-0.5 text-[8px] text-[#475569]">
            as of {formatObservationTime(observationTime)}
          </div>
        )}

        {/* Quiet / empty state guidance (very useful for real low-activity NOAA data) */}
        {points.length === 0 && !isLoading && (
          <div className="mt-1.5 text-[9px] text-[#eab308]">
            No areas ≥ {minProb}%. Lower the filter slider or conditions are quiet.
          </div>
        )}
      </div>
    </div>
  );
}
