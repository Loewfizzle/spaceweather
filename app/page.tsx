import { Zap } from "lucide-react";
import { LiveHeader } from "../components/LiveHeader";
import { LiveIndicator } from "../components/LiveIndicator";
import dynamic from "next/dynamic";

// ssr: false — DashboardClient reads localStorage for location state on first render.
// Disabling SSR ensures server and client both start from the same empty state,
// eliminating the hydration mismatch. Dashboard data is all API-fetched anyway.
const DashboardClient = dynamic(
  () => import("../components/DashboardClient").then((m) => ({ default: m.DashboardClient })),
  { ssr: false }
);

// No "use client" — this is a Server Component.
// Static shell (header branding, h1 hero copy, footer) is server-rendered for LCP + SEO.
// LiveHeader and DashboardClient are client islands that hydrate independently.

export default function AuroraWatch() {
  return (
    <div className="min-h-screen pb-12">
      {/* Sticky Header */}
      <header className="header">
        {/*
          py-3.5 instead of h-16: the branding now has three lines (title,
          subtitle, live indicator) so we let height be content-driven with
          symmetric padding rather than a fixed 64 px constraint.
        */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between py-3.5">
          {/* Static branding — server-rendered, visible immediately.
              LiveIndicator is a tiny "use client" island that hydrates
              independently and sits below the subtitle. */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 via-cyan-400 to-violet-400 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-[#05070f]" />
            </div>
            <div>
              {/* Slightly larger title for more presence */}
              <div className="font-semibold tracking-tighter text-xl sm:text-2xl leading-tight">
                AuroraWatch
              </div>
              {/* Subtitle + live dot on one line */}
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#64748b] leading-none">
                <span>NOAA SWPC<span className="hidden sm:inline"> • Northern US</span></span>
                <LiveIndicator />
              </div>
            </div>
          </div>

          {/* Right: Kp pill, health indicator, refresh — client island */}
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
            Particularly strong coverage for the Great Lakes region and the northern United States.
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
              Not for navigation • Updates every few minutes • Built for northern US aurora chasers
            </div>
          </div>
          <div className="mt-4 text-[#475569] text-[10px]">AuroraWatch v0.1.0</div>
        </div>
      </footer>
    </div>
  );
}
