# AuroraWatch

Premium, calm, mobile-first real-time aurora and space weather dashboard focused on the United States, with extra attention to Michigan and the Great Lakes.

Live data from NOAA SWPC + NASA (proxied). Clean, professional, high-quality experience — no emojis, restrained aurora-inspired accents, excellent typography and spacing.

## Current Features

- Sticky header with live color-coded Kp pill + Michigan risk badge + global freshness timestamp + Refresh
- Prominent hero with "Tonight’s Michigan Outlook" card (dynamic status, reasons, drivers from Kp + Bz + OVATION + solar)
- Current Conditions metrics row (solar wind speed/density, Bz, Kp, max OVATION prob NA)
- **Interactive Aurora Map** (Leaflet + react-leaflet + leaflet.heat): OVATION model, North America focus, probability filter slider, one-click recenters (Great Lakes, Michigan, US, NA), hybrid heatmap + markers
- Kp Outlook + Michigan Forecast (Chart.js timeline + trend + plain-English guidance)
- Solar Activity (latest flares, recent CMEs, sunspot number, coronal hole notes — Michigan-relevant)
- **Meteor Activity** (new):
  - Next Meteor Shower card with peak date/range, description, activity level, and "Add to Calendar" (Google Calendar link)
  - Fireball Tracker: recent NASA JPL fireballs (date/time UTC, energy kt, location, altitude) — proxied for CORS
- Understanding the Data (expandable educational section, collapsed by default)
- Notifications/Alerts v2 (browser push with sensitivity presets, live risk badge, throttled)
- Clean footer with NOAA credits and timestamps
- Full loading skeletons, error states, empty states
- Fully mobile-first and thumb-friendly

## Data Sources

- NOAA SWPC public JSON:
  - OVATION Aurora: https://services.swpc.noaa.gov/json/ovation_aurora_latest.json
  - Planetary K-index, solar wind (plasma/mag), flares, alerts, solar regions
- Open-Meteo (free, no key) for optional sky conditions (currently not surfaced in UI)
- NASA JPL Fireball API (https://ssd-api.jpl.nasa.gov/fireball.api) — **proxied via /api/fireballs** to solve CORS in production
- Static major meteor shower data (Perseids, Geminids, etc.) with pure date math for "next" calculation

All external data is validated at runtime with Zod schemas.

## Tech Stack

- Next.js 16 (App Router) + TypeScript (strict)
- Tailwind CSS 4 (custom dark space theme: #05070f bg, emerald/cyan/violet accents)
- TanStack Query (@tanstack/react-query) — centralized hooks + Zod-validated fetchers
- Leaflet + react-leaflet + leaflet.heat (interactive map, dynamic import ssr:false)
- Chart.js + react-chartjs-2 (Kp timeline)
- Zod (runtime schemas for NOAA + NASA responses)
- Lucide-react (icons, no emojis)
- date-fns (relative timestamps)
- next/dynamic for code-splitting heavy components

## Testing

Automated testing is set up with **Vitest** + **@testing-library/react**.

```bash
npm test          # Run tests in watch mode
npm run test:ui   # Open Vitest UI
npm run test:coverage
```

Key tests live in `tests/lib/noaa.test.ts` and cover the core business logic:
- `getTonightOutlook` (most critical)
- `getMichiganRiskLevel`
- `currentSunspotNumber`
- Meteor helpers
- OVATION utilities, color scales, CME parsing, etc.

We prioritize testing pure functions and data processing logic (the parts most likely to regress when NOAA data formats change).

## Project Structure

```
app/
  api/fireballs/route.ts   # Server proxy for NASA JPL (CORS bypass + caching)
  layout.tsx               # Root metadata (OG, etc.), Providers wrapper
  loading.tsx              # Full-page skeleton (matches dashboard IA)
  page.tsx                 # High-level orchestration (imports hooks + components)
  providers.tsx            # TanStack QueryClient + top-level ErrorBoundary
components/
  AuroraMap.tsx            # Leaflet + heat map (dynamic import)
  ErrorBoundary.tsx        # Top-level render error catcher
  ErrorState.tsx           # Reusable error UI with optional retry
  EmptyState.tsx
  LoadingSkeleton.tsx      # Variants for card / metrics / chart / map / list
  + extracted presentational: HeroOutlook, CurrentConditions, AuroraMapSection,
    KpForecast, SolarActivity, MeteorActivity, DataUnderstanding, AlertsPanel
lib/
  api/
    fetchers.ts            # Fetching + row parsing + Zod validation (single source for I/O)
    schemas.ts             # All Zod schemas + inferred TS types (defensive nullables)
  constants/
    meteors.ts             # Static major shower data (used by business logic)
  hooks/
    useChartData.ts        # Kp chart data prep (used by KpForecast)
    useGlobalFreshness.ts  # Consolidated last-updated timestamp
    useNotifications.ts    # Alerts permission, localStorage, throttle, auto-alert effect
  noaa.ts                  # Pure business logic + derived data (NO fetching):
                           #   - getTonightOutlook, getMichiganRiskLevel
                           #   - parseRecentCmes, currentSunspotNumber
                           #   - latest(), filterOvationCoordinates, maxOvationNorthAmerica
                           #   - getAuroraColor / getAuroraMarkerRadius
                           #   - meteor helpers (getNextMeteorShower, format*, calendar link)
                           #   - fireball formatters
  use-noaa-data.ts         # React Query hooks + composition only:
                           #   - useCurrentConditions, useSolarActivity, useFireballs, useOvationData, useKpData, useSolarWindData, useSkyConditions (legacy)
                           #   - Re-exports of business logic for UI convenience
  utils/                   # (lightweight / future)
public/
  og-image.jpg, manifest.json, favicon, etc.
```

Data layer split (after refactors):
- lib/api/ = Fetching + Validation (Zod at the edge)
- lib/noaa.ts = Pure business logic and data derivations (no side effects)
- lib/use-noaa-data.ts = TanStack Query hook composition (orchestrates the above)
- components/ + lib/hooks/ = Presentational components and UI-specific extracted logic (chart prep, notifications, freshness, etc.)
```

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

- To analyze bundle: `ANALYZE=true npm run build`
- All data is live/public; no API keys required.

## Development & Production Notes

- **Data fetching**: Mix of client (TanStack Query with per-hook staleTime/refetch) + server proxy for NASA. Fetchers use Zod .parse() (or safeParse+filter for resilience on CSV sources).
- **Error handling**: Critical data (Kp + OVATION for hero outlook) vs. enhancement data (solar wind, regions/sunspots, fireballs). Critical errors bubble for the primary section; non-critical data gracefully degrades to "—" / cached values + subtle warnings. See comments in lib/use-noaa-data.ts. Top-level ErrorBoundary catches render crashes. Per-section components (SolarActivity, MeteorActivity, etc.) use ErrorState or inline warnings with retry where appropriate.
- **Caching**: TanStack staleTime per source (1-60 min). Server proxy uses Next revalidate + Cache-Control. NOAA direct uses no-store + Query.
- **Refresh**: Global button refetches all active queries (conditions, solar, fireballs).
- **Map**: Dynamically imported (ssr: false) with canvas heatmap for performance.
- **Accessibility**: ARIA on slider/map controls, keyboard friendly buttons, semantic structure.
- The NASA proxy solves the production CORS problem that direct browser fetches to ssd-api.jpl.nasa.gov encounter.

## Deploy

Connected to Vercel. Push to main triggers deploy. The /api/fireballs route is serverless and benefits from edge caching where possible.

## Credits

Built with live public data from the NOAA Space Weather Prediction Center and NASA JPL. Not for navigation, safety, or operational decisions.

---

AuroraWatch — Real-time aurora visibility and space weather for the Great Lakes and United States. Calm. Premium. Focused.

