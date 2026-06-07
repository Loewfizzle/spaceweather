"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

type Point = { position: [number, number]; prob: number };

function probToRGB(prob: number): [number, number, number] {
  if (prob < 10)  return [ 22, 101,  52];
  if (prob < 25)  return [ 34, 197,  94];
  if (prob < 45)  return [234, 179,   8];
  if (prob < 65)  return [249, 115,  22];
  return                 [167, 139, 250];
}

class OvationCanvasLayerImpl extends L.Layer {
  // Named _layerMap (not _map) to avoid shadowing Leaflet's own protected _map: L.Map field
  private _layerMap: L.Map | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _rafId: number | null = null;
  private _points: Point[];

  constructor(points: Point[]) {
    super();
    this._points = points;
  }

  onAdd(map: L.Map): this {
    const canvas = L.DomUtil.create('canvas', 'ovation-canvas-layer') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    map.getPanes().overlayPane!.appendChild(canvas);
    this._canvas = canvas;
    this._layerMap = map;
    map.on('moveend zoomend', this._draw, this);
    map.on('move zoom', this._scheduleDraw, this);
    this._draw();
    return this;
  }

  onRemove(map: L.Map): this {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    map.off('moveend zoomend', this._draw, this);
    map.off('move zoom', this._scheduleDraw, this);
    if (this._canvas?.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    this._canvas = null;
    this._layerMap = null;
    return this;
  }

  updatePoints(points: Point[]): void {
    this._points = points;
    if (this._layerMap) this._draw();
  }

  private _scheduleDraw(): void {
    if (this._rafId != null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._draw();
    });
  }

  private _draw(): void {
    const canvas = this._canvas;
    if (!canvas || !this._layerMap) return;

    const size = this._layerMap.getSize();
    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
    }

    const topLeft = this._layerMap.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bounds = this._layerMap.getBounds();
    const bufferDeg = 5;
    const minLat = bounds.getSouth() - bufferDeg;
    const maxLat = bounds.getNorth() + bufferDeg;
    const minLon = bounds.getWest() - bufferDeg;
    const maxLon = bounds.getEast() + bufferDeg;

    const cellDeg = 2.0;
    const originPx = this._layerMap.latLngToContainerPoint([0, 0]);
    const cellPx   = this._layerMap.latLngToContainerPoint([0, cellDeg]);
    const cellSize = Math.max(2, Math.abs(cellPx.x - originPx.x));

    for (const point of this._points) {
      if (point.position[0] < minLat || point.position[0] > maxLat ||
          point.position[1] < minLon || point.position[1] > maxLon) continue;
      const px = this._layerMap.latLngToContainerPoint([point.position[0], point.position[1]]);
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
  }
}

export function OvationCanvasLayer({ points }: { points: Point[] }) {
  const map = useMap();
  const layerRef = useRef<OvationCanvasLayerImpl | null>(null);
  // Always holds the latest points so the setup effect can read them without
  // being a dep — avoids removing and re-adding the layer on every data poll.
  const pointsRef = useRef(points);

  // Keep pointsRef current and push updates into the live layer.
  useEffect(() => {
    pointsRef.current = points;
    layerRef.current?.updatePoints(points);
  }, [points]);

  // Create the layer once per map instance; the points effect above handles updates.
  useEffect(() => {
    const layer = new OvationCanvasLayerImpl(pointsRef.current);
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map]);

  return null;
}
