"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import type { LocationSearchResult } from "../app/api/location-search/route";

// Matches "lat, lon" — e.g. "47.6, -122.3" or "-33.8,151.2"
const LATLON_RE = /^(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/;

interface LocationPickerProps {
  onConfirm: (lat: number, lon: number, label: string) => void;
  onCancel: () => void;
}

export function LocationPicker({ onConfirm, onCancel }: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;

    // Direct lat,lon input — no API call needed
    const match = q.match(LATLON_RE);
    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        onConfirm(lat, lon, `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
        return;
      }
    }

    setIsLoading(true);
    setNotFound(false);
    setResults([]);
    try {
      const res = await fetch(`/api/location-search?q=${encodeURIComponent(q)}`);
      const data: { results: LocationSearchResult[] } = await res.json();
      if (data.results.length === 0) {
        setNotFound(true);
      } else {
        setResults(data.results);
      }
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[#1e2937] bg-[#0a0e1a] overflow-hidden">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
        className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e2937]"
      >
        <Search className="h-3.5 w-3.5 text-[#475569] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResults([]);
            setNotFound(false);
          }}
          placeholder="City, state · or lat, lon"
          className="flex-1 bg-transparent text-sm text-[#f1f5f9] placeholder-[#334155] outline-none min-w-0"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="text-xs text-[#22c55e] font-medium hover:text-[#4ade80] transition-colors disabled:opacity-40 shrink-0"
        >
          {isLoading ? "…" : "Search"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-[#475569] hover:text-[#94a3b8] transition-colors"
          aria-label="Cancel location search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </form>

      {notFound && (
        <div className="px-3 py-2.5 text-xs text-[#64748b]">
          No locations found — try a different spelling, or enter{" "}
          <span className="text-[#475569]">lat, lon</span> directly.
        </div>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-[#1e2937]">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onConfirm(r.lat, r.lon, r.label)}
                className="w-full text-left px-3 py-2.5 text-sm text-[#94a3b8] hover:bg-[#1e2937] hover:text-white transition-colors"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
