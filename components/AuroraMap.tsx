"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useOvationData } from "../lib/use-noaa-data";
import { filterOvationCoordinates } from "../lib/noaa";

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

function probToRGB(prob: number): [number, number, number] {
  if (prob < 10)  return [22,  101, 52];
  if (prob < 25)  return [34,  197, 94];
  if (prob < 45)  return [234, 179, 8];
  if (prob < 65)  return [249, 115, 22];
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
        map.on('move zoom moveend zoomend', this._draw, this);
        this._draw();
        return this;
      },
      onRemove(map: L.Map) {
        map.off('move zoom moveend zoomend', this._draw, this);
        if (canvasRef.current?.parentNode) {
          canvasRef.current.parentNode.removeChild(canvasRef.current);
        }
        canvasRef.current = null;
      },
      _draw() {
        const canvas = canvasRef.current;
        if (!canvas || !this._map) return;

        const size = this._map.getSize();
        // Only reset dimensions on resize — assigning canvas.width always clears it.
        if (canvas.width !== size.x || canvas.height !== size.y) {
          canvas.width = size.x;
          canvas.height = size.y;
        }

        // setPosition cancels the pane's CSS transform so that canvas pixel (x,y)
        // corresponds exactly to container pixel (x,y).  We must then draw using
        // latLngToContainerPoint (not latLngToLayerPoint) to stay in the same space.
        const topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(canvas, topLeft);

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // cellSize: pixel span of cellDeg degrees longitude at current zoom.
        // Using a difference so the pane offset cancels out.
        const cellDeg = 2.0;
        const originPx = this._map.latLngToContainerPoint([0, 0]);
        const cellPx   = this._map.latLngToContainerPoint([0, cellDeg]);
        const cellSize = Math.max(2, Math.abs(cellPx.x - originPx.x));

        for (const point of points) {
          // containerPoint matches canvas coords after setPosition cancels pane offset.
          const px = this._map.latLngToContainerPoint([point.position[0], point.position[1]]);
          const alpha = Math.pow(point.prob / 100, 0.6) * 0.9;
          if (alpha < 0.02) continue;
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

export default function AuroraMap({ minProb = 3 }: AuroraMapProps) {
  const { data: ovationData, isLoading, error, refetch } = useOvationData();

  const points = useMemo(() => {
    const raw = filterOvationCoordinates(ovationData?.coordinates, minProb);
    return raw.map((p) => ({
      position: [p.lat, p.lon] as [number, number],
      prob: Math.round(p.prob),
    }));
  }, [ovationData, minProb]);

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
          <OvationCanvasLayer points={safePoints} />
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
          {safePoints.length} areas{minProb > 0 ? ` ≥ ${minProb}%` : ""} · NA
        </div>
      </div>
    </div>
  );
}
