import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
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
        // App pages (placeholder, not yet implemented)
        'src/app/**',
      ],
    },
  },
});
