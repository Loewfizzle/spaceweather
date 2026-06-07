"use client";

import { useCallback, useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Home } from "lucide-react";
import { useOvationData } from "../lib/use-noaa-data";
import { filterOvationCoordinates, type OvationPoint } from "../lib/aurora/ovation";
import { OvationCanvasLayer } from "./map/OvationCanvasLayer";
import { TileErrorDetector } from "./map/TileErrorDetector";
import { UserLocationMarker } from "./map/UserLocationMarker";
import { MapStateTracker, MapInstanceCapture } from "./map/MapStateTracker";

interface AuroraMapProps {
  minProb?: number;
  /** Granted geolocation latitude; undefined/null → no pin rendered. */
  userLat?: number | null;
  /** Granted geolocation longitude; undefined/null → no pin rendered. */
  userLon?: number | null;
  /** Pre-computed aurora probability at the user's location (0–100, or null). */
  userProb?: number | null;
  /** Pre-filtered NA OvationPoint[] from useCurrentConditions. When provided,
   *  skips the 65k-entry filterOvationCoordinates scan and applies minProb in O(k). */
  ovationPoints?: OvationPoint[];
}

export default function AuroraMap({
  minProb = 3,
  userLat,
  userLon,
  userProb,
  ovationPoints: ovationPointsProp,
}: AuroraMapProps) {
  const { data: ovationData, isLoading, error, refetch } = useOvationData();
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const onTileError = useCallback(() => setTilesFailed(true), []);

  // Restore the user's last map position from localStorage (runs once on mount).
  // Validates every field so a corrupted entry can't break the map.
  const [mapInitialState] = useState<{ center: [number, number]; zoom: number }>(() => {
    const defaults = { center: [48, -100] as [number, number], zoom: 3 };
    if (typeof window === "undefined") return defaults;
    try {
      const raw = localStorage.getItem("aurora-map-state");
      if (raw) {
        const { lat, lng, zoom } = JSON.parse(raw) as {
          lat: number; lng: number; zoom: number;
        };
        if (
          isFinite(lat) && isFinite(lng) && isFinite(zoom) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180 &&
          zoom >= 1 && zoom <= 18
        ) {
          return { center: [lat, lng], zoom: Math.round(zoom) };
        }
      }
    } catch { /* parse error or storage unavailable */ }
    return defaults;
  });

  const points = useMemo(() => {
    // If the parent passes pre-filtered NA points, skip the 65k-entry scan entirely.
    // minProb is still applied, but over ~5k points instead of 65k raw entries.
    const source = ovationPointsProp
      ? ovationPointsProp.filter((p) => p.prob >= minProb)
      : filterOvationCoordinates(ovationData?.coordinates, minProb);
    return source.map((p) => ({
      position: [p.lat, p.lon] as [number, number],
      prob: Math.round(p.prob),
    }));
  }, [ovationPointsProp, ovationData, minProb]);

  // Secondary safety guard: drop any point whose coordinates would confuse Leaflet's
  // canvas renderer (e.g. stray NaN/Infinity, lat/lon swapped, dateline edge cases).
  const safePoints = useMemo(
    () =>
      points.filter(
        (p) =>
          isFinite(p.position[0]) &&
          isFinite(p.position[1]) &&
          p.position[0] >= -90 &&
          p.position[0] <= 90 &&
          p.position[1] >= -180 &&
          p.position[1] <= 180
      ),
    [points]
  );

  const isEmpty = !isLoading && !error && safePoints.length === 0;

  // Whether we have a valid location to render a pin for
  const hasUserLocation =
    userLat != null && userLon != null &&
    isFinite(userLat) && isFinite(userLon);

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
          <button
            onClick={() => refetch()}
            className="text-[#64748b] underline underline-offset-2 hover:text-white transition-colors"
          >
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
          center={mapInitialState.center}
          zoom={mapInitialState.zoom}
          style={{ height: "100%", width: "100%", background: "#05070f" }}
          className="z-0"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <TileErrorDetector onError={onTileError} />
          <OvationCanvasLayer points={safePoints} />
          {/* Persist center/zoom so the map remembers the user's last view */}
          <MapStateTracker />
          <MapInstanceCapture onMap={setMapInstance} />
          {/* User location pin — only rendered when geolocation has been granted */}
          {hasUserLocation && (
            <UserLocationMarker
              lat={userLat!}
              lon={userLon!}
              prob={userProb ?? null}
            />
          )}
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

      {tilesFailed && (
        <div className="absolute top-2 left-2 z-[20] pointer-events-none">
          <div className="bg-[#0a0e1a]/85 backdrop-blur-sm border border-[#1e2937] rounded-lg px-3 py-1.5 text-[10px] text-amber-400/80">
            Map tiles unavailable — aurora data still shown
          </div>
        </div>
      )}

      {/* Reset button — outside MapContainer so overflow-hidden doesn't clip it */}
      {mapInstance && (
        <button
          onClick={(e) => { e.stopPropagation(); mapInstance.setView([48, -100], 3); }}
          className="absolute bottom-3 left-3 z-[20] flex items-center justify-center rounded-lg border border-[#1e2937] bg-[#0f1425]/95 p-1.5 shadow backdrop-blur-sm hover:bg-[#1e2937] transition-colors"
          title="Reset view"
          aria-label="Reset map view"
        >
          <Home className="h-3.5 w-3.5 text-[#cbd5e1]" />
        </button>
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
          {safePoints.length} areas{minProb > 0 ? ` ≥ ${minProb}%` : ""} · NA
        </div>
      </div>
    </div>
  );
}
