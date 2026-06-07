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
        // Global floor — raised after adding hook tests for useUserLocation + useAutoAlert.
        // Actuals as of this commit: ~41.9% stmt/lines, ~87% branches, ~80.8% functions.
        // Functions actual is capped by the many "use client" hooks/components that are
        // legitimately hard to unit-test in jsdom; threshold set 1 pp below actual.
        statements: 40,
        lines: 40,
        branches: 86,
        functions: 75,
        // Critical pure-logic files: lock in high existing coverage
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
      },
    },
  },
})
