"use client";

import { useRef } from "react";
import { X, ChevronRight, Zap } from "lucide-react";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";

interface FireballsModalProps {
  onClose: () => void;
}

export function FireballsModal({ onClose }: FireballsModalProps) {
  useBodyScrollLock();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fireballs-modal-title"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          className="bg-[#0d1425] border border-[#1e2937] rounded-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#94a3b8]" />
              <span id="fireballs-modal-title" className="uppercase tracking-[2px] text-[10px] text-[#94a3b8]">
                Fireball Tracker
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

            {/* 1 — What is a fireball */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-1.5">What is a fireball?</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                A fireball is a meteor that burns brighter than Venus — roughly magnitude −4 or brighter.
                They&apos;re often visible in daylight, frequently accompanied by a sonic boom, and
                sometimes leave a glowing trail that persists for minutes. These are not the shooting
                stars you see on a clear summer night.
              </p>
              <p className="text-sm text-[#94a3b8] leading-relaxed mt-2">
                Those everyday shooting stars are specks of comet dust — typically the size of a grain
                of sand — burning up harmlessly at high altitude. Fireballs are larger objects, anywhere
                from fist-sized to car-sized, that release enormous energy as they disintegrate in the
                atmosphere.
              </p>
            </div>

            {/* 2 — Why only major events appear */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-1.5">Why only major events appear here</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                This tracker shows events detected by the{" "}
                <span className="text-[#94a3b8]">US government sensor network</span> — a global array
                of infrasound stations and optical sensors originally built to monitor nuclear tests.
                An event must release roughly{" "}
                <span className="text-[#94a3b8]">0.1 kilotons of TNT equivalent</span> or more to
                register, which filters out the thousands of smaller meteors that burn up every day.
              </p>
              <p className="text-sm text-[#94a3b8] leading-relaxed mt-2">
                Globally, fewer than about 1,000 events per year cross this threshold. What you see
                here is genuinely rare — the most energetic impacts Earth experiences on a regular basis.
              </p>
            </div>

            {/* 3 — Why data arrives late */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-1.5">Why the data arrives late</div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                NASA JPL CNEOS processes raw sensor data after each event — calculating the trajectory,
                velocity, altitude, and energy release. This analysis takes time, and events typically
                appear in the database{" "}
                <span className="text-[#94a3b8]">days to weeks after they occur</span>. This is not
                a real-time feed.
              </p>
              <p className="text-sm text-[#94a3b8] leading-relaxed mt-2">
                If a major fireball was widely reported in the news today, it may not appear here for
                several days. &ldquo;Recent&rdquo; in this context means within the last 30 days of
                confirmed and published data.
              </p>
            </div>

            {/* 4 — Reading the energy scale */}
            <div>
              <div className="text-sm font-semibold text-[#cbd5e1] mb-2">Reading the energy scale</div>
              <div className="space-y-2">
                <div className="flex gap-3 text-[12px]">
                  <span className="flex items-center gap-1.5 flex-shrink-0 w-[80px]">
                    <span className="h-2 w-2 rounded-full flex-shrink-0 bg-[#a78bfa]" />
                    <span className="font-semibold text-[#a78bfa]">≥ 3 kt</span>
                  </span>
                  <span className="text-[#94a3b8] leading-relaxed">
                    Rare, major impact — energy equivalent to a small nuclear weapon. These events are
                    globally significant and widely reported.
                  </span>
                </div>
                <div className="flex gap-3 text-[12px]">
                  <span className="flex items-center gap-1.5 flex-shrink-0 w-[80px]">
                    <span className="h-2 w-2 rounded-full flex-shrink-0 bg-[#ef4444]" />
                    <span className="font-semibold text-[#ef4444]">≥ 1 kt</span>
                  </span>
                  <span className="text-[#94a3b8] leading-relaxed">
                    Significant fireball — several times per year globally. Often visible across
                    hundreds of kilometers and may produce meteorites.
                  </span>
                </div>
                <div className="flex gap-3 text-[12px]">
                  <span className="flex items-center gap-1.5 flex-shrink-0 w-[80px]">
                    <span className="h-2 w-2 rounded-full flex-shrink-0 bg-[#eab308]" />
                    <span className="font-semibold text-[#eab308]">≥ 0.1 kt</span>
                  </span>
                  <span className="text-[#94a3b8] leading-relaxed">
                    The minimum detection threshold. Still a notable event — roughly the energy of
                    hundreds of tons of TNT, far beyond any conventional explosion.
                  </span>
                </div>
                <div className="flex gap-3 text-[12px]">
                  <span className="flex items-center gap-1.5 flex-shrink-0 w-[80px]">
                    <span className="h-2 w-2 rounded-full flex-shrink-0 bg-[#64748b]" />
                    <span className="font-semibold text-white">&lt; 0.1 kt</span>
                  </span>
                  <span className="text-[#94a3b8] leading-relaxed">
                    Below the threshold but still recorded. Energy was estimated but fell under the
                    detection floor.
                  </span>
                </div>
              </div>
              <p className="text-sm text-[#94a3b8] leading-relaxed mt-2.5">
                kt = kilotons of TNT equivalent. One kiloton is approximately the energy in 1,000
                metric tons of TNT — the standard unit for measuring large explosive yields.
              </p>
            </div>

            {/* NASA CNEOS link */}
            <a
              href="https://cneos.jpl.nasa.gov/fireballs/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors pt-3 border-t border-[#1e2937]"
            >
              <span>Fireball &amp; Bolide Reports on NASA CNEOS</span>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
