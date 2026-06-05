"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Mirror AuroraMap's icon fix — safe to run more than once (delete on already-absent prop is a no-op)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface FireballMapProps {
  lat: number;
  lon: number;
  energy: number | null;
}

export default function FireballMap({ lat, lon, energy }: FireballMapProps) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={4}
      style={{ height: "100%", width: "100%", background: "#05070f" }}
      scrollWheelZoom={false}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <CircleMarker
        center={[lat, lon]}
        radius={12}
        pathOptions={{
          color: "#f97316",
          fillColor: "#f97316",
          fillOpacity: 0.35,
          weight: 2,
        }}
      >
        {energy != null && (
          <Tooltip permanent direction="top" offset={[0, -14]}>
            {energy} kt
          </Tooltip>
        )}
      </CircleMarker>
    </MapContainer>
  );
}
