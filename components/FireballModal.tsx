"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { Fireball } from "../lib/use-noaa-data";
import { formatFireballDate, formatFireballLocation } from "../lib/use-noaa-data";

const FireballMap = dynamic(() => import("./FireballMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] sm:h-[300px] animate-pulse bg-[#0a0e1a]" />
  ),
});

// NASA API stores lat/lon as positive magnitudes; direction indicates sign.
function toSignedLat(lat: number, dir: string | null): number {
  return dir === "S" ? -lat : lat;
}
function toSignedLon(lon: number, dir: string | null): number {
  return dir === "W" ? -lon : lon;
}

interface FireballModalProps {
  fireball: Fireball;
  onClose: () => void;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm border-b border-[#1e2937] pb-2 last:border-b-0 last:pb-0">
      <span className="text-[#64748b]">{label}</span>
      <span className="text-[#cbd5e1] tabular-nums ml-4 text-right">{value}</span>
    </div>
  );
}

export function FireballModal({ fireball, onClose }: FireballModalProps) {
  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const signedLat = toSignedLat(fireball.lat!, fireball.latDir);
  const signedLon = toSignedLon(fireball.lon!, fireball.lonDir);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#05070f]/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Fireball impact detail"
    >
      <div
        className="relative w-full sm:max-w-lg overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[#1e2937] bg-[#0f1425]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button overlaid top-right, above the map */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#05070f]/75 backdrop-blur-sm border border-[#1e2937] text-[#94a3b8] hover:text-white transition-colors text-lg leading-none"
        >
          ×
        </button>

        {/* Map */}
        <div className="h-[250px] sm:h-[300px] overflow-hidden">
          <FireballMap lat={signedLat} lon={signedLon} energy={fireball.energy} />
        </div>

        {/* Metadata panel */}
        <div className="px-5 py-4">
          <div className="uppercase tracking-[1.5px] text-[10px] text-[#64748b] mb-3">
            FIREBALL IMPACT
          </div>
          <div className="space-y-2">
            <MetaRow label="Date / Time" value={formatFireballDate(fireball.date)} />
            <MetaRow label="Location" value={formatFireballLocation(fireball)} />
            {fireball.energy != null && (
              <MetaRow label="Energy" value={`${fireball.energy} kt`} />
            )}
            {fireball.alt != null && (
              <MetaRow label="Altitude" value={`${fireball.alt} km`} />
            )}
            {fireball.vel != null && (
              <MetaRow label="Velocity" value={`${fireball.vel} km/s`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
