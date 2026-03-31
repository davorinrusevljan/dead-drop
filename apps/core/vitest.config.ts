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
      include: ['src/api/**'],
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
        // API types (no business logic)
        'src/api/types.ts',
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
