import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
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
        // Node modules
        '**/node_modules/**',
        // Database schema (tested via integration tests)
        '**/db/schema.ts',
        // Dev utilities (local development only)
        '**/src/dev/**',
        // Setup scripts
        'scripts/**',
        // API configuration (no business logic)
        'src/lib/api-config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@dead-drop/engine': resolve(__dirname, '../../packages/engine/dist'),
      '@dead-drop/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
});
