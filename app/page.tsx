import { Zap } from "lucide-react";
import { LiveHeader } from "../components/LiveHeader";
import { DashboardClient } from "../components/DashboardClient";

// No "use client" — this is a Server Component.
// Static shell (header branding, h1 hero copy, footer) is server-rendered for LCP + SEO.
// LiveHeader and DashboardClient are client islands that hydrate independently.

export default function AuroraWatch() {
  return (
    <div className="min-h-screen pb-12">
      {/* Sticky Header */}
      <header className="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Static branding — server-rendered, visible immediately */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-400 via-cyan-400 to-violet-400 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#05070f]" />
            </div>
            <div>
              <div className="font-semibold tracking-tighter text-lg sm:text-xl">AuroraWatch</div>
              <div className="text-[9px] sm:text-[10px] text-[#64748b] -mt-0.5 leading-none">
                NOAA SWPC<span className="hidden sm:inline"> • Michigan Focus</span>
              </div>
            </div>
          </div>

          {/* Live status pills + refresh — client island */}
          <LiveHeader />
        </div>
      </header>

      {/* Hero copy — server-rendered for LCP + crawlability */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-0">
        <div className="max-w-3xl">
          <div className="uppercase tracking-[2.5px] text-[10px] text-[#64748b] mb-3">
            LIVE • NOAA SWPC DATA
          </div>
          <h1 className="text-6xl sm:text-7xl font-semibold tracking-tighter leading-[0.92] mb-5">
            Aurora &amp; space<br />weather for the<br />United States
          </h1>
          <p className="text-2xl text-[#94a3b8] tracking-tight max-w-2xl">
            Real-time OVATION aurora forecasts and planetary K-index.
            Special attention to Michigan and the Great Lakes.
          </p>
        </div>
      </div>

      {/* All dynamic sections — single client boundary */}
      <DashboardClient />

      {/* Footer — server-rendered */}
      <footer className="border-t border-[#1e2937] pt-8 pb-10 text-xs text-[#64748b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-y-2 justify-between">
            <div>
              Data provided by{" "}
              <a
                href="https://www.swpc.noaa.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                NOAA Space Weather Prediction Center (SWPC)
              </a>
              . OVATION, planetary K-index, and real-time solar wind.
            </div>
            <div className="text-[#475569]">
              Not for navigation • Updates every few minutes • Built for Michigan aurora chasers
            </div>
          </div>
          <div className="mt-4 text-[#475569] text-[10px]">AuroraWatch v0.1.0</div>
        </div>
      </footer>
    </div>
  );
}
