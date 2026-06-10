import { BrandIcon } from "../components/BrandIcon";
import { LiveHeader } from "../components/LiveHeader";
import { LiveIndicator } from "../components/LiveIndicator";
import { IosInstallPromptLoader } from "../components/IosInstallPromptLoader";
import { DashboardClient } from "../components/DashboardClient";

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
            <BrandIcon />
            <div>
              {/* Slightly larger title for more presence */}
              <div className="font-semibold tracking-tighter text-4xl leading-tight">
                SkyGlow
              </div>
              {/* Subtitle + live dot on one line */}
              <div className="flex items-center gap-1.5 text-sm text-[#94a3b8] leading-none">
                <span>Aurora · solar · sky events</span>
                <LiveIndicator />
              </div>
            </div>
          </div>

          {/* Right: Kp pill, health indicator, refresh — client island */}
          <LiveHeader />
        </div>
      </header>

      {/* iOS install nudge — mobile only, right-aligned, sits directly below header */}
      <div className="sm:hidden flex justify-end max-w-7xl mx-auto px-4 pt-2">
        <IosInstallPromptLoader />
      </div>

      <main id="main-content">
        {/* Hero copy — server-rendered for LCP + crawlability */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-0">
          <div className="max-w-3xl">
            <div className="uppercase tracking-[2.5px] text-[10px] text-[#94a3b8] mb-3">
              LIVE • NOAA SWPC DATA
            </div>
            <h1 className="text-6xl sm:text-7xl font-semibold tracking-tighter leading-[0.92] mb-5">
              Space &amp; Sky Events
            </h1>
            <p className="text-2xl text-[#94a3b8] tracking-tight max-w-2xl">
              Live aurora forecasts, solar weather, meteor activity, and more across the United States.
            </p>
          </div>
        </div>

        {/* All dynamic sections — single client boundary */}
        <DashboardClient />
      </main>

      {/* Footer — server-rendered */}
      <footer className="border-t border-[#1e2937] pt-8 pb-10 text-xs text-[#94a3b8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-[#94a3b8] mb-6">
            Questions, bug reports, or inquiries —{" "}
            <a
              href="mailto:contact@skyglow.app"
              className="underline hover:text-white transition-colors"
            >
              contact@skyglow.app
            </a>
          </div>
          <div className="flex flex-col gap-y-2">
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
            <div className="text-[#64748b]">
              Not for navigation • Updates every few minutes
            </div>
          </div>
          <div className="mt-4 text-[#64748b] text-[10px]">
            SkyGlow v0.1.0 ·{" "}
            <a
              href="https://skyglow.app"
              className="hover:text-[#94a3b8] transition-colors"
            >
              skyglow.app
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
