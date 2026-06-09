import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'e2e/',
        '.next/',
        'public/sw.js',
        'scripts/',
        'app/opengraph-image.tsx',
        'app/api/pwa-icon/route.tsx',
        'next.config.ts',
      ],
      thresholds: {
        // Global floor — raised after round 10 of coverage work.
        // Actuals: ~53% stmt/lines, ~94.62% branches, ~93.53% functions.
        // Functions actual is capped by untested "use client" hooks/components (useCloudCover,
        // useNotifications, etc.) that are integration-tested via E2E; threshold ~3 pp below actual.
        statements: 50,
        lines: 50,
        branches: 92,
        functions: 90,
        // Critical pure-logic files: lock in high existing coverage
        'lib/aurora/solar.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'lib/aurora/kp.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // branches at 85.71% actual; threshold set 5 pp below that
        'lib/aurora/ovation.ts': { statements: 88, branches: 80, functions: 90, lines: 90 },
        'lib/utils/retry.ts': { statements: 85, branches: 82, functions: 85, lines: 85 },
        // CurrentConditions: BzSparkline (added in round 11) is untested — its SVG body
        // (lines 185-198) and the stopPropagation handler (line 122) are the only gaps.
        // Thresholds set ~2 pp below actual (59.18% stmt, 81.96% branch, 62.5% func, 59.45% lines).
        // Raise once BzSparkline gets a render test.
        'components/CurrentConditions.tsx': { statements: 57, branches: 80, functions: 60, lines: 57 },
        // ViewingWindow: last-night section, modal open, time-range null, tier labels tested
        'components/ViewingWindow.tsx': { statements: 90, branches: 92, functions: 77, lines: 90 },
        // Hook tests added — lock in the coverage these tests provide
        'lib/hooks/useUserLocation.ts': { statements: 80, branches: 70, functions: 85, lines: 80 },
        // viewingWindow: 100% actual after branch-gap tests; floor at 95
        'lib/utils/viewingWindow.ts': { statements: 95, branches: 93, functions: 95, lines: 95 },
        // useFocusTrap and useSolarActivity: 100% actual at time of writing; floor at 95
        'lib/hooks/useFocusTrap.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'lib/hooks/useSolarActivity.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        // conditions.ts: all 8 blurb functions fully tested; floor at 95
        'lib/aurora/conditions.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        // visibleCities.ts: pure function, fully tested; floor at 95
        'lib/aurora/visibleCities.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        // outlook.ts: all three exported functions tested, all branches covered; floor at 90
        'lib/aurora/outlook.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // location.ts: mostly tested; 1 unreachable "return ''" branch suppressed with
        // v8 ignore. Antimeridian branch in getNearestCityName now covered; floor at 88.
        'lib/aurora/location.ts':  { statements: 95, branches: 88, functions: 95, lines: 94 },
        'lib/aurora/fireballs.ts': { statements: 95, branches: 95, functions: 95, lines: 94 },
        'lib/aurora/meteors.ts':   { statements: 95, branches: 93, functions: 95, lines: 95 },
        // ErrorState: both standalone variants + onRetry tested; floor at 90
        'components/ErrorState.tsx': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // KpForecast: all loading/error/empty states + stormDays branches tested; floor at 90
        'components/KpForecast.tsx': { statements: 90, branches: 89, functions: 90, lines: 90 },
        // ViewingWindowModal: all cloud cover branches + cities=0 fallback covered; floor at 90
        'components/solar/ViewingWindowModal.tsx': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // HeroOutlook: 20 tests covering all major flows; functions floor at 58 because
        // several optional-callback handlers (isFetching, locationLabel=null) are uncovered
        'components/HeroOutlook.tsx': { statements: 77, branches: 88, functions: 66, lines: 76 },
        // AuroraMapModal: tested, 100% stmt/func/lines; one branch uncovered (line 17)
        'components/solar/AuroraMapModal.tsx': { statements: 95, branches: 83, functions: 95, lines: 95 },
        // CurrentConditionsModal: fully covered by dedicated test suite
        'components/solar/CurrentConditionsModal.tsx': { statements: 95, branches: 95, functions: 95, lines: 95 },
        // useAutoAlert: 100% stmt/func/lines; one branch at line 56
        'lib/hooks/useAutoAlert.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
        // useCurrentConditions: 100% stmt/func/lines; branches at lines 73-78 uncovered
        'lib/hooks/useCurrentConditions.ts': { statements: 95, branches: 87, functions: 95, lines: 95 },
        // noaa.ts: 100% coverage across 197 tests; floor at 95
        'lib/noaa.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        // LocationPicker: 14 tests — lat/lon shortcut, API success/error/loading; one uncovered
        // branch at line 28 (empty-query early return unreachable while button is disabled)
        'components/LocationPicker.tsx': { statements: 95, branches: 93, functions: 95, lines: 95 },
        // location-search route: all buildLabel branches + request path tested; 4 branches on
        // lines 35/68-71 are the postcode-filter sub-expression and slice(0,5) guard (unreachable
        // via Nominatim which always honours limit=5) — floor 3 pp below actual 86.66%
        'app/api/location-search/route.ts': { statements: 95, branches: 84, functions: 95, lines: 95 },
        // AlertsPanel: simplified to read-only NOAA feed + risk pill; no notification controls.
        'components/AlertsPanel.tsx': { statements: 95, branches: 90, functions: 95, lines: 95 },
        // useChartData: all CHART_OPTIONS callbacks + plugin beforeDraw/afterDraw + hook tested;
        // 3 remaining branches are diff>12 ternary in etOffsetHours (non-US timezone),
        // !chartArea guard in afterDraw (splitIdx>0 path), and a ?? in buildChartData
        'lib/hooks/useChartData.ts': { statements: 99, branches: 94, functions: 100, lines: 100 },
      },
    },
  },
})
