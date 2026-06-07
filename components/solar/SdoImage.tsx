"use client";

import { useState, useEffect } from "react";

export const SDO_DATA_URL = "https://sdo.gsfc.nasa.gov/data/";
const SDO_MAX_AUTO_FAILS = 3;

export function SdoImage({ src, alt }: { src: string; alt: string }) {
  const [imgState, setImgState] = useState<"loading" | "loaded" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  const autoRefreshPaused = consecutiveFails >= SDO_MAX_AUTO_FAILS;

  // NASA SDO updates every ~15 min. Pause auto-refresh after repeated failures.
  useEffect(() => {
    if (autoRefreshPaused) return;
    const id = setInterval(() => {
      setAttempt((n) => n + 1);
      setImgState("loading");
    }, 1000 * 60 * 15);
    return () => clearInterval(id);
  }, [autoRefreshPaused]);

  const onLoad = () => {
    setImgState("loaded");
    setConsecutiveFails(0);
  };
  const onError = () => {
    setImgState("failed");
    setConsecutiveFails((n) => n + 1);
    console.warn("[AuroraWatch] SDO image failed to load:", src);
  };
  const retry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConsecutiveFails(0);
    setImgState("loading");
    setAttempt((n) => n + 1);
  };
  const openSdo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(SDO_DATA_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative w-full aspect-square overflow-hidden bg-black">
      {imgState === "loading" && (
        <div className="absolute inset-0 animate-pulse bg-[#0f1425]" />
      )}
      {imgState === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="text-[#475569] text-xs leading-relaxed">
            {autoRefreshPaused
              ? "NASA SDO temporarily unreachable"
              : "Image temporarily unavailable"}
          </span>
          <button
            onClick={openSdo}
            className="text-[10px] text-[#64748b] hover:text-white underline underline-offset-2 transition-colors"
          >
            View on NASA SDO ↗
          </button>
          <button
            onClick={retry}
            className="text-[10px] text-[#475569] hover:text-[#64748b] transition-colors"
          >
            Retry
          </button>
          {autoRefreshPaused && (
            <span className="text-[9px] text-[#334155]">Auto-refresh paused</span>
          )}
        </div>
      )}
      {/* Using <img> intentionally — Next.js <Image> caches aggressively and breaks live SDO refreshes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={onLoad}
        onError={onError}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          imgState === "loaded" ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
