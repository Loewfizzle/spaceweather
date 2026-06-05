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

## Project Structure (Post Step 4 Refactor)

```
app/
  api/fireballs/route.ts   # Server proxy for NASA (CORS + caching)
  layout.tsx               # Root metadata, OG, providers + ErrorBoundary
  loading.tsx              # Full-page skeleton matching new IA
  page.tsx                 # Main dashboard (client for interactivity)
  providers.tsx            # QueryClient + global ErrorBoundary
components/
  AuroraMap.tsx
  ErrorBoundary.tsx
  ErrorState.tsx
  EmptyState.tsx
  LoadingSkeleton.tsx      # Variants: card, list, metrics, chart, map
lib/
  api/
    fetchers.ts            # Centralized, Zod-validated data fetching
    schemas.ts             # Zod schemas for Kp, OVATION, Solar Wind, Fireballs + more
  constants/
    meteors.ts             # Static major shower data
  hooks/                   # (Prepared for future extraction of hooks)
  noaa.ts                  # Pure utilities, business logic (getTonightOutlook, parseRecentCmes, format helpers, re-exports)
  use-noaa-data.ts         # TanStack Query hooks + composed logic (useCurrentConditions, useSolarActivity, useFireballs, etc.)
  utils/                   # (Prepared)
public/
  og-image.jpg, manifest.json, etc.
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

- **Data fetching**: Mix of client (TanStack Query with per-hook staleTime/refetch) + server proxy for NASA. Fetchers use Zod .parse() for safety.
- **Caching**: TanStack staleTime per source (1-60 min). Server proxy uses Next revalidate + Cache-Control. NOAA direct uses no-store + Query.
- **Refresh**: Global button refetches all active queries (conditions, solar, fireballs).
- **Map**: Dynamically imported (ssr: false) with canvas heatmap for performance.
- **Accessibility**: ARIA on slider/map controls, keyboard friendly buttons, semantic structure. More enhancements planned.
- The NASA proxy solves the production CORS problem that direct browser fetches to ssd-api.jpl.nasa.gov encounter.

## Deploy

Connected to Vercel. Push to main triggers deploy. The /api/fireballs route is serverless and benefits from edge caching where possible.

## Credits

Built with live public data from the NOAA Space Weather Prediction Center and NASA JPL. Not for navigation, safety, or operational decisions.

---

AuroraWatch — Real-time aurora visibility and space weather for the Great Lakes and United States. Calm. Premium. Focused.

