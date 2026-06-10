"use client";

import { TrendingUp, X, ChevronRight } from "lucide-react";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";

export function CoronalModal({ onClose }: { onClose: () => void }) {
  useBodyScrollLock();
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Coronal holes details"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#94a3b8]" />
              <span className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
                Coronal Holes
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[#64748b] hover:text-[#94a3b8] transition-colors p-1 -mr-1 focus:outline-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 pt-4 space-y-5">
            {/* What they are */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">What they are</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                Coronal holes are regions of the Sun&apos;s atmosphere where the magnetic field
                opens outward into space rather than looping back to the surface. In SDO imagery
                they appear as dark patches because they are cooler and less dense than surrounding
                regions.
              </p>
            </div>

            {/* Why they matter */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">Why they matter for aurora</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                Coronal holes emit a continuous stream of fast-moving solar wind — typically
                500–800 km/s compared to the normal 400 km/s. When this high-speed stream reaches
                Earth it compresses the magnetosphere and enhances geomagnetic activity, often
                producing aurora even during otherwise quiet periods with low Kp.
              </p>
            </div>

            {/* 2–4 day window */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">The 2–4 day arrival window</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                Unlike CMEs — which are sudden explosive events — coronal hole solar wind streams
                are sustained and predictable. Once an Earth-facing coronal hole is identified,
                aurora enhancement typically arrives in 2–4 days and can persist for 1–3 days as
                Earth passes through the stream.
              </p>
            </div>

            {/* What to look for */}
            <div className="rounded-lg border border-[#1e2937] bg-[#0a0f1e] px-4 py-3">
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">What to look for in the image</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                Equatorial coronal holes — dark patches near the center of the solar disk — are
                the most relevant to watch. Polar coronal holes at the top and bottom of the disk
                are permanent features with less direct Earth impact. A large dark patch rotating
                toward the center of the disk is the key signal.
              </p>
            </div>

            {/* AIA 193Å explained */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">AIA 193Å explained</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                This image is captured by NASA&apos;s Solar Dynamics Observatory using the AIA
                instrument at the 193 Angstrom wavelength — an extreme ultraviolet (EUV) filter
                that reveals the Sun&apos;s corona. At this wavelength, hot plasma appears bright
                and coronal holes appear dark, making them easy to identify.
              </p>
            </div>

            {/* SDO link */}
            <a
              href="https://sdo.gsfc.nasa.gov/data/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors pt-3 border-t border-[#1e2937]"
            >
              <span>View SDO imagery on NASA</span>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
