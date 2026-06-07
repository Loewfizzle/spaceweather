"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Home } from "lucide-react";
import { useOvationData } from "../lib/use-noaa-data";
import { filterOvationCoordinates, type OvationPoint } from "../lib/noaa";

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

// ─── Aurora overlay ───────────────────────────────────────────────────────────

function probToRGB(prob: number): [number, number, number] {
  if (prob < 10)  return [ 22, 101,  52];
  if (prob < 25)  return [ 34, 197,  94];
  if (prob < 45)  return [234, 179,   8];
  if (prob < 65)  return [249, 115,  22];
  return                 [167, 139, 250];
}

function OvationCanvasLayer({ points }: { points: { position: [number, number]; prob: number }[] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!points || points.length === 0) return;

    // Create a Leaflet Layer subclass that draws to canvas
    const CanvasLayer = L.Layer.extend({
      onAdd(map: L.Map) {
        const canvas = L.DomUtil.create('canvas', 'ovation-canvas-layer') as HTMLCanvasElement;
        canvas.style.position = 'absolute';
        canvas.style.pointerEvents = 'none';
        map.getPanes().overlayPane!.appendChild(canvas);
        canvasRef.current = canvas;
        this._map = map;
        this._rafId = null;
        map.on('moveend zoomend', this._draw, this);
        map.on('move zoom', this._scheduleDraw, this);
        this._draw();
        return this;
      },
      onRemove(map: L.Map) {
        if (this._rafId != null) {
          cancelAnimationFrame(this._rafId);
          this._rafId = null;
        }
        map.off('moveend zoomend', this._draw, this);
        map.off('move zoom', this._scheduleDraw, this);
        if (canvasRef.current?.parentNode) {
          canvasRef.current.parentNode.removeChild(canvasRef.current);
        }
        canvasRef.current = null;
      },
      _scheduleDraw() {
        if (this._rafId != null) return;
        this._rafId = requestAnimationFrame(() => {
          this._rafId = null;
          this._draw();
        });
      },
      _draw() {
        const canvas = canvasRef.current;
        if (!canvas || !this._map) return;

        const size = this._map.getSize();
        if (canvas.width !== size.x || canvas.height !== size.y) {
          canvas.width = size.x;
          canvas.height = size.y;
        }

        const topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(canvas, topLeft);

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cellDeg = 2.0;
        const originPx = this._map.latLngToContainerPoint([0, 0]);
        const cellPx   = this._map.latLngToContainerPoint([0, cellDeg]);
        const cellSize = Math.max(2, Math.abs(cellPx.x - originPx.x));

        for (const point of points) {
          const px = this._map.latLngToContainerPoint([point.position[0], point.position[1]]);
          const alpha = Math.pow(point.prob / 100, 1.1) * 0.9;
          if (alpha < 0.06) continue;
          const [r, g, b] = probToRGB(point.prob);
          const gradient = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, cellSize * 0.85);
          gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
          gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(px.x, px.y, cellSize * 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = new (CanvasLayer as any)();
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
}

// ─── Tile error detection ─────────────────────────────────────────────────────

function TileErrorDetector({ onError }: { onError: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.on('tileerror', onError);
    return () => { map.off('tileerror', onError); };
  }, [map, onError]);
  return null;
}

// ─── User location pin ────────────────────────────────────────────────────────

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
function UserLocationMarker({
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
    // Remove stale marker before creating a new one (e.g. when coords update)
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    const SIZE = 20; // outer ring diameter in px

    // Probability label: shown when we have a value, styled to match the legend
    // palette. "< 1%" replaces an uninteresting "0%" for locations outside the
    // current aurora oval.
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
      className: "",          // suppress Leaflet's default white background
      iconSize: [SIZE, SIZE],
      iconAnchor: [SIZE / 2, SIZE / 2], // lat/lng maps to the visual centre
    });

    const marker = L.marker([lat, lon], {
      icon,
      interactive: false, // pass-through for pan/zoom gestures
      keyboard: false,
      zIndexOffset: 1000,  // float above any canvas aurora blobs
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

// ─── Map state persistence ────────────────────────────────────────────────────

/**
 * Saves the map's current center + zoom to localStorage on every moveend/zoomend.
 * The stored value is read once on AuroraMap mount to restore the user's last view.
 */
function MapStateTracker() {
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
function MapInstanceCapture({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

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
