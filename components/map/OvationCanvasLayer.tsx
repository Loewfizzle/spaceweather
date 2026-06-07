"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

function probToRGB(prob: number): [number, number, number] {
  if (prob < 10)  return [ 22, 101,  52];
  if (prob < 25)  return [ 34, 197,  94];
  if (prob < 45)  return [234, 179,   8];
  if (prob < 65)  return [249, 115,  22];
  return                 [167, 139, 250];
}

export function OvationCanvasLayer({ points }: { points: { position: [number, number]; prob: number }[] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!points || points.length === 0) return;

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

        const bounds = this._map.getBounds();
        const bufferDeg = 5;
        const minLat = bounds.getSouth() - bufferDeg;
        const maxLat = bounds.getNorth() + bufferDeg;
        const minLon = bounds.getWest() - bufferDeg;
        const maxLon = bounds.getEast() + bufferDeg;

        const cellDeg = 2.0;
        const originPx = this._map.latLngToContainerPoint([0, 0]);
        const cellPx   = this._map.latLngToContainerPoint([0, cellDeg]);
        const cellSize = Math.max(2, Math.abs(cellPx.x - originPx.x));

        for (const point of points) {
          if (point.position[0] < minLat || point.position[0] > maxLat ||
              point.position[1] < minLon || point.position[1] > maxLon) continue;
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
