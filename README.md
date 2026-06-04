# AuroraWatch

Premium, mobile-first aurora and space weather dashboard focused on the United States, with extra attention to Michigan and the Great Lakes.

Live data from NOAA SWPC. Clean, professional, calm experience — not flashy.

## Features

- Sticky header with live color-coded Kp status pill
- Strong hero with Michigan-specific visibility guidance
- Current conditions metrics (solar wind, Bz, density, OVATION probability)
- Interactive Leaflet map using NOAA OVATION aurora model (North America focus, one-click recenter on Great Lakes / Michigan)
- Kp forecast timeline (Chart.js) + plain-English Michigan forecasts
- Browser notification alerts (start simple, expandable)
- Clean footer with data credits and timestamps

## Data Sources

All data comes exclusively from public NOAA Space Weather Prediction Center (SWPC) JSON feeds:

- OVATION Aurora (latest): https://services.swpc.noaa.gov/json/ovation_aurora_latest.json
- Planetary K-index: https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
- Real-time solar wind (plasma + mag): https://services.swpc.noaa.gov/products/solar-wind/

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS (premium dark space theme)
- Leaflet.js + react-leaflet (interactive map)
- Chart.js + react-chartjs-2 (timelines)
- TanStack Query (data fetching, caching, refetch)
- Lucide-react (icons)
- date-fns (timestamps)

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

The app is fully mobile-first and thumb-friendly.

## Development Notes

- Live data is fetched client-side via TanStack Query (5-minute refetch by default).
- The interactive map (Leaflet + OVATION grid) and real Chart.js timeline are the next implementation priorities.
- All NOAA endpoints are public and CORS-friendly for client usage.
- No emojis. Calm, high-quality typography and spacing throughout.

## Deploy

This project is connected to Vercel. Push to main to trigger a deployment.

## Credits

Built with live public data from the NOAA Space Weather Prediction Center. Not for navigation or operational decisions.

---

AuroraWatch — Real-time aurora visibility for the Great Lakes and United States.
