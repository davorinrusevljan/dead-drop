import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      exclude: [
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        '**/*.{test,spec}.{ts,tsx}',
        '**/dist/**',
        '**/node_modules/**',
        // Re-export only
        'src/index.ts',
      ],
    },
  },
});
