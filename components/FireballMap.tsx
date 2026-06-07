"use client";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";


interface FireballMapProps {
  lat: number;
  lon: number;
}

export default function FireballMap({ lat, lon }: FireballMapProps) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={4}
      style={{ height: "100%", width: "100%", background: "#05070f" }}
      scrollWheelZoom={false}
      zoomControl={false}
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
      />
    </MapContainer>
  );
}
