import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      exclude: [
        // Config files
        '**/*.config.{ts,js}',
        // Type definition files
        '**/*.d.ts',
        // Test files themselves
        '**/*.{test,spec}.{ts,tsx}',
        // Build outputs
        '**/dist/**',
        '**/.next/**',
        // Node modules (explicit patterns)
        'node_modules/**',
        '../../node_modules/**',
        // App code (tested via E2E)
        '**/app/**',
        // API routes (tested via integration tests)
        '**/api/routes/**',
        '**/api/db.ts',
        // Client-side code (requires browser environment)
        '**/lib/drop-client.ts',
        // Types
        '**/api/types.ts',
        // Worker entry point (requires Cloudflare environment)
        '**/worker.ts',
        // Config
        '**/lib/config.ts',
        // Dev utilities (local development only)
        '**/dev/**',
      ],
    },
  },
});
