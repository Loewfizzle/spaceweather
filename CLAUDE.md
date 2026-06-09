# SkyGlow — Project Notes for AI Assistants

## Project Identity

- **App name:** SkyGlow (`skyglow.app`)
- **Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, TanStack Query, Vitest, Playwright
- The root page component is named `AuroraWatch()` and the loading component `AuroraWatchLoading()` — these are **intentionally not renamed** and must stay as-is.

---

## Known False Positives — Do NOT "Fix" These

These patterns have been audited and confirmed correct. Do not change them.

| Pattern | File | Why it's correct |
|---|---|---|
| `useState(Date.now)` | `components/MeteorActivity.tsx`, `components/LiveIndicator.tsx` | Valid React lazy initialization. React calls the function reference once to compute initial state. This is intentional, not a missing `()`. |
| `windowData.windowStart!` / `windowData.windowEnd!` | `components/ViewingWindow.tsx` | Non-null assertions are redundant but harmless — the same expression is already guarded by `windowData.windowStart && windowData.windowEnd ?` on the same line. |
| `dateStr.replace(" ", "T")` | `lib/aurora/fireballs.ts` | NASA CNEOS date format is always `"YYYY-MM-DD HH:MM:SS"` with exactly one space. Replacing only the first space is correct. |
| `parseFloat(fireball.vel).toFixed(1)` | `components/FireballModal.tsx` | Guarded by `{fireball.vel && ...}` — only renders when vel is a truthy string. NASA API always returns numeric strings for vel/alt. |
| `Math.max(...vals)` in `useStormDays` | `components/KpForecast.tsx` | `vals` is never empty — it is populated by `byDay[date].push(val)`, so every key in `byDay` has at least one value. |
| HTML entities (`&amp;`, `&apos;`, `&ldquo;`, etc.) in JSX | various | React correctly interprets HTML entities in JSX text content. These are not double-encoding bugs. |
| `document.execCommand("copy")` fallback | `components/ShareButton.tsx` | Intentional legacy clipboard fallback for private browsing and HTTP origins that block the async Clipboard API. Sequential `try`/`return` chain — no race condition. |

---

## Deliberate Configuration Decisions

- **Nominatim User-Agent email** (`loewfizzle@gmail.com`) in `app/api/location-search/route.ts` — This is **required** by Nominatim's usage policy. A contact email in the User-Agent is mandatory for API access. Do not remove or anonymize it.

- **`va.vercel-scripts.com` in both `script-src` and `connect-src`** in `next.config.ts` — Vercel Analytics is intentionally enabled. Both CSP directives are needed: `script-src` allows the analytics script to load, `connect-src` allows the beacon. Do not remove either.

- **`public/sw.js`** — Intentional service worker for background push notifications. This is a **generated file** — do not edit it directly. Edit `worker/sw.js` and regenerate via `scripts/buildSw.js`.

- **Safari ITP popup** ("reduce advanced privacy protections") — This is an Apple/Safari system UI triggered by Vercel Analytics on iOS 17+. It appears on every major website with third-party analytics. It is not a site error and requires no code change.

---

## Test Philosophy

- Tests live in `tests/` and cover **business logic** (`lib/aurora/`, `lib/utils/`) — not UI wiring or render output.
- Do not add tests that merely re-assert what TypeScript's type system already enforces.
- Do not add tests just to hit a coverage number.
- The baseline is 888 passing tests. New logic should add tests; new components generally should not.
