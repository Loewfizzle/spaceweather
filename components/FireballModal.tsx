"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useBodyScrollLock } from "../lib/hooks/useBodyScrollLock";
import type { Fireball } from "../lib/use-noaa-data";
import { formatFireballDate, formatFireballLocation, formatFireballEnergy, approximateLocation } from "../lib/use-noaa-data";

const FireballMap = dynamic(() => import("./FireballMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] sm:h-[300px] animate-pulse bg-[#0a0e1a]" />
  ),
});

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

function resolveLocationFallback(fireball: Fireball): string {
  if (fireball.lat == null || fireball.lon == null) return "Unknown";
  return (
    approximateLocation(fireball.lat, fireball.lon) ||
    formatFireballLocation(fireball)
  );
}

export function FireballModal({ fireball, onClose }: FireballModalProps) {
  useBodyScrollLock();
  const [location, setLocation] = useState<string | null>(null);
  // True while the geocode request is in flight — prevents the raw coordinate
  // string from flashing before the city name resolves.
  const [isLoadingLocation, setIsLoadingLocation] = useState(
    fireball.lat != null && fireball.lon != null
  );

  // Geocode on open — abort on unmount or if coordinates change
  useEffect(() => {
    if (fireball.lat == null || fireball.lon == null) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    fetch(`/api/geocode?lat=${fireball.lat}&lon=${fireball.lon}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setLocation(data.location || null);
          setIsLoadingLocation(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoadingLocation(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [fireball.lat, fireball.lon]);

  const hasMap = fireball.lat != null && fireball.lon != null;
  const locationDisplay = isLoadingLocation
    ? "Locating…"
    : (location ?? resolveLocationFallback(fireball));

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-[#05070f]/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Fireball impact detail"
    >
      <div
        className="relative w-full sm:max-w-lg overflow-hidden rounded-2xl border border-[#1e2937] bg-[#0f1425]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#05070f]/75 backdrop-blur-sm border border-[#1e2937] text-[#94a3b8] hover:text-white transition-colors text-lg leading-none"
        >
          ×
        </button>

        {hasMap && (
          <div className="h-[250px] sm:h-[300px] overflow-hidden">
            <FireballMap lat={fireball.lat!} lon={fireball.lon!} />
          </div>
        )}

        <div className="px-5 py-4">
          <div className="uppercase tracking-[1.5px] text-[10px] text-[#64748b] mb-3">
            FIREBALL IMPACT
          </div>
          <div className="space-y-2">
            <MetaRow label="Date / Time"   value={formatFireballDate(fireball.date)} />
            <MetaRow label="Location"      value={locationDisplay} />
            <MetaRow label="Coordinates"   value={formatFireballLocation(fireball)} />
            <MetaRow label="Impact Energy" value={formatFireballEnergy(fireball.impactE)} />
            {fireball.vel && <MetaRow label="Velocity" value={`${parseFloat(fireball.vel).toFixed(1)} km/s`} />}
            {fireball.alt && <MetaRow label="Altitude" value={`${parseFloat(fireball.alt).toFixed(0)} km`} />}
          </div>
        </div>
      </div>
    </div>
  );
}
