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
        '.next/',
        'public/sw.js',
        'scripts/',
        'app/opengraph-image.tsx',
        'app/api/pwa-icon/route.tsx',
        'next.config.ts',
      ],
      thresholds: {
        // Global floor — 5 pp below observed baseline (33/89/86/33)
        statements: 28,
        branches: 84,
        functions: 81,
        lines: 28,
        // Critical pure-logic files: lock in high existing coverage
        'lib/aurora/kp.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // branches at 85.71% actual; threshold set 5 pp below that
        'lib/aurora/ovation.ts': { statements: 90, branches: 80, functions: 90, lines: 90 },
        'lib/utils/retry.ts': { statements: 85, branches: 85, functions: 85, lines: 85 },
      },
    },
  },
})
