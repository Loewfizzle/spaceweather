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
        // Global floor — raised after rounds 4-6 of coverage work + LocationPicker tests.
        // Actuals as of this commit: ~48.9% stmt/lines, ~91.9% branches, ~85.7% functions.
        // Functions actual is capped by the many "use client" hooks/components that are
        // legitimately hard to unit-test in jsdom; threshold set ~3 pp below actual.
        statements: 46,
        lines: 46,
        branches: 89,
        functions: 83,
        // Critical pure-logic files: lock in high existing coverage
        'lib/aurora/solar.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'lib/aurora/kp.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // branches at 85.71% actual; threshold set 5 pp below that
        'lib/aurora/ovation.ts': { statements: 90, branches: 80, functions: 90, lines: 90 },
        'lib/utils/retry.ts': { statements: 85, branches: 85, functions: 85, lines: 85 },
        // New component tests — minimum coverage floors.
        // CurrentConditions: the MetricInfoModal code paths (4 card types) are
        // partially covered; functions/branches stay below 70% because many
        // modal code paths require separate opens per card.
        'components/CurrentConditions.tsx': { statements: 70, branches: 35, functions: 40, lines: 70 },
        'components/ViewingWindow.tsx': { statements: 70, branches: 60, functions: 60, lines: 70 },
        // Hook tests added — lock in the coverage these tests provide
        'lib/hooks/useUserLocation.ts': { statements: 80, branches: 70, functions: 85, lines: 80 },
        // viewingWindow: 100% actual after branch-gap tests; floor at 95
        'lib/utils/viewingWindow.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
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
        'lib/aurora/location.ts':  { statements: 95, branches: 88, functions: 95, lines: 95 },
        'lib/aurora/fireballs.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'lib/aurora/meteors.ts':   { statements: 95, branches: 95, functions: 95, lines: 95 },
        // ErrorState: both standalone variants + onRetry tested; floor at 90
        'components/ErrorState.tsx': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // KpForecast: all loading/error/empty states + stormDays branches tested; floor at 90
        'components/KpForecast.tsx': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // ViewingWindowModal: all cloud cover branches + cities=0 fallback covered; floor at 90
        'components/solar/ViewingWindowModal.tsx': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // HeroOutlook: 20 tests covering all major flows; functions floor at 58 because
        // several optional-callback handlers (isFetching, locationLabel=null) are uncovered
        'components/HeroOutlook.tsx': { statements: 90, branches: 84, functions: 55, lines: 90 },
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
      },
    },
  },
})
