# SkyGlow

Real-time aurora and space weather dashboard for the United States and northern North America. Live NOAA SWPC + NASA data, location-aware aurora probability, interactive map, browser notifications.

## Features

- **Aurora Outlook** — Tonight's status (Excellent / Good / Moderate / Low / Very Low) derived from Kp, Bz, OVATION, solar wind speed, CMEs, and flares; city-by-city probability table
- **Location-Aware Probability** — GPS or manual city search; personalized aurora % for your exact coordinates; local sky conditions (cloud cover via Open-Meteo)
- **Tonight's Viewing Window** — Best hours to look up based on Kp forecast; last-night peak recap
- **Interactive Aurora Map** — Leaflet + OVATION heatmap; probability filter slider; user location marker; recenters (Great Lakes, US, NA)
- **Current Conditions** — Solar wind speed/density, IMF Bz, planetary Kp, max OVATION % over NA; info modals for each metric
- **Kp Forecast Chart** — 36h history + 36h NOAA forecast; tonight shading; Chart.js with animated Kp-tier pills in header
- **Solar Activity** — Latest X-ray flares, recent CMEs, sunspot count, coronal hole summary; detail modals
- **Meteor Activity** — Next major shower card + "Add to Calendar"; NASA JPL Fireball Tracker with map
- **Browser Alerts** — Notification permission flow, On/Off toggle, three sensitivity presets (Sensitive/Balanced/Strong), throttled to once per 30 min
- **PWA** — Installable, service worker, manifest
- Full loading skeletons, per-section error boundaries, and graceful degradation throughout

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript strict |
| Styling | Tailwind CSS 4 — custom dark space theme (`#05070f` bg, emerald/cyan/violet accents) |
| Data fetching | TanStack Query (`@tanstack/react-query`) — per-hook staleTime/refetch |
| Map | Leaflet + react-leaflet, custom OVATION canvas layer |
| Chart | Chart.js + react-chartjs-2 |
| Validation | Zod — all NOAA/NASA responses validated at the edge |
| Icons | Lucide React |
| Dates | date-fns |
| Testing | Vitest + Testing Library (unit), Playwright (E2E) |

## Data Sources

- **NOAA SWPC** — Planetary K-index (3-hourly + 1-min), solar wind plasma/mag, Kp forecast, OVATION aurora model, X-ray flares, CME data, geomagnetic alerts
- **NASA JPL Fireball API** — proxied via `/api/fireballs` (CORS bypass + CDN caching)
- **Open-Meteo** — Cloud cover forecast for user location (no API key required)
- **Nominatim / geocode** — Location search via `/api/location-search`; reverse geocoding via `/api/geocode`

All external responses are validated with Zod schemas at parse time. Invalid or missing fields produce nulls rather than crashes.

## Project Structure

```
app/
  page.tsx                   # Server component — static shell (h1, header, footer)
  layout.tsx                 # Root metadata, Providers wrapper
  loading.tsx                # Full-page skeleton (matches dashboard IA)
  providers.tsx              # QueryClient + top-level ErrorBoundary
  api/
    fireballs/route.ts       # Proxy for NASA JPL (CORS + caching)
    cloud-cover/route.ts     # Open-Meteo proxy
    location-search/route.ts # Nominatim search → normalised results
    geocode/route.ts         # Reverse geocode for GPS coordinates
    pwa-icon/route.tsx       # Dynamic PWA icon generation

components/
  DashboardClient.tsx        # Single "use client" boundary; orchestrates all sections
  LiveHeader.tsx             # Sticky header: Kp pill, risk badge, freshness, refresh
  HeroOutlook.tsx            # Tonight's outlook card + city probability table
  ViewingWindow.tsx          # Best viewing window + last-night peak
  CurrentConditions.tsx      # Metrics row (solar wind, Bz, Kp, OVATION)
  AuroraMapSection.tsx       # Lazy-loaded map wrapper
  AuroraMap.tsx              # Leaflet map + OVATION heatmap (ssr: false)
  KpForecast.tsx             # Chart.js Kp timeline + plain-English guidance
  SolarActivity.tsx          # Flares, CMEs, sunspots, coronal holes
  MeteorActivity.tsx         # Next shower + fireball tracker
  AlertsPanel.tsx            # Browser notification controls + NOAA alert feed
  LocationPicker.tsx         # City search / GPS location input
  FireballMap.tsx            # Mini Leaflet map for fireball events
  ShareButton.tsx            # Web Share API
  InstallPrompt.tsx          # PWA install banner
  LoadingSkeleton.tsx        # Variants: card, metrics, chart, map, list
  ErrorState.tsx             # Reusable error UI with optional retry
  SectionErrorBoundary.tsx   # Per-section error boundary
  map/                       # Map sub-components (OvationCanvasLayer, UserLocationMarker, …)
  solar/                     # Modal components (FlareModal, CmeModal, AuroraMapModal, …)

lib/
  aurora/                    # Pure business logic — no React, no side effects
    kp.ts                    # Kp tier classification, AURORA_TIERS constant
    outlook.ts               # getTonightOutlook, getCityAuroraProbabilities, getLocationAuroraProb
    conditions.ts            # getAuroraGuidance, plain-English condition blurbs
    ovation.ts               # filterOvationCoordinates, maxOvationNorthAmerica, color/radius scales
    solar.ts                 # parseRecentCmes, currentSunspotNumber, flare parsing
    meteors.ts               # getNextMeteorShower, formatters, calendar link
    fireballs.ts             # Fireball formatters
    location.ts              # getNearestCityName, approximateLocation
    visibleCities.ts         # getVisibleCities (Kp-to-latitude aurora visibility)
  api/
    fetchers.ts              # All NOAA/NASA fetch calls + Zod validation
    schemas.ts               # Zod schemas and inferred TypeScript types
  hooks/
    useCurrentConditions.ts  # Composes Kp + OVATION + solar wind → conditions object
    useSolarActivity.ts      # Flares, CMEs, alerts, sunspots
    useFireballs.ts          # NASA JPL fireballs query
    useKpForecast.ts         # (via use-noaa-data) Kp 3-day forecast
    useChartData.ts          # Kp chart data prep (buildChartData pure fn + useMemo hook)
    useNotifications.ts      # Notification permission, localStorage prefs, auto-alert effect
    useAutoAlert.ts          # Fires browser notification when conditions cross threshold
    useCloudCover.ts         # Open-Meteo cloud cover for user location
    useGlobalFreshness.ts    # Latest-update timestamp across all data sources
    useUserLocation.ts       # GPS + manual location state machine
    useIsMobile.ts           # matchMedia hook
    useFocusTrap.ts          # Modal keyboard trap
    useModalState.ts         # Shared open/close state for info modals
    useStableRefetch.ts      # Debounced refetch across queries
  context/
    UserLocationContext.tsx  # UserLocation React context + provider
  utils/
    viewingWindow.ts         # computeViewingWindow, computeLastNightPeak
    alertHelpers.ts          # alertProductLabel, alertFirstLine, formatAlertAge
    retry.ts                 # Exponential-backoff fetch retry

tests/                       # Vitest unit + integration tests
e2e/                         # Playwright end-to-end tests
```

## Data Flow

```
NOAA SWPC / NASA JPL
        │
        ▼
lib/api/fetchers.ts          ← Zod validation at the edge
        │
        ▼
lib/hooks/use*               ← TanStack Query (staleTime, refetch, error handling)
        │
        ▼
components/DashboardClient   ← Composes hooks, derives outlook + user prob
        │
        ├── lib/aurora/outlook.ts  ← getTonightOutlook (pure, no fetching)
        ├── lib/aurora/conditions.ts
        └── components/*           ← Presentational components receive plain props
```

The `lib/aurora/` layer is deliberately dependency-free — it receives plain data and returns plain data. This makes the business logic easy to test and independent of React or fetch concerns.

## Getting Started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build
npm run start      # Serve production build locally
```

No API keys required — all data sources are public.

```bash
ANALYZE=true npm run build    # Bundle analysis
```

## Testing

```bash
npm test                  # Vitest watch mode
npm run test:coverage     # Coverage report
npm run test:e2e          # Playwright (requires npm run build && npm run start first)
```

**Philosophy:** tests cover pure business logic and non-obvious data transformations. The `lib/aurora/` functions (`getTonightOutlook`, `computeViewingWindow`, `getNextMeteorShower`, Kp scoring, OVATION utilities) get thorough coverage because bugs there are invisible — wrong math produces plausible-looking output. API route tests catch input-validation and response-format regressions. Simple UI wiring is covered by Playwright E2E rather than unit tests.

High-value test files:
- `tests/lib/noaa.test.ts` — `getTonightOutlook`, `getAuroraRiskLevel`, OVATION utilities
- `tests/lib/outlook.test.ts` — city probability calculations
- `tests/lib/viewingWindow.test.ts` — viewing window and last-night peak
- `tests/lib/meteors.test.ts` — shower timing, calendar link generation
- `tests/api/routes.test.ts` — all API route handlers (47 tests)
- `e2e/smoke.spec.ts` — full page load, Kp pill, key sections visible

## Deploy

Connected to Vercel. Push to `main` triggers deploy. The `/api/*` routes are serverless functions; `/api/fireballs` benefits from edge caching via `Cache-Control: s-maxage`.

## Credits

Live data from [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/) and NASA JPL. Not for navigation, safety, or operational decisions.
