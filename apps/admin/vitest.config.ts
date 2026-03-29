import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        autoUpdate: true,
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
      exclude: [
        // Config files
        '**/*.config.{ts,js,mjs}',
        // Type definition files
        '**/*.d.ts',
        // Test files themselves
        '**/*.{test,spec}.{ts,tsx}',
        // Build outputs
        '**/dist/**',
        '.next/**',
        '.wrangler/**',
        '.vercel/**',
        '**/coverage/**',
        // Node modules
        '**/node_modules/**',
        // Database schema (tested via integration tests)
        '**/db/schema.ts',
        // Dev utilities (local development only)
        '**/src/dev/**',
        // Setup scripts
        'scripts/**',
        // Next.js API routes (tested via integration/e2e tests)
        '**/src/api/**',
        // Next.js app routes/pages (tested via integration/e2e tests)
        '**/src/app/**',
        // Edge worker (tested via integration tests)
        'src/worker.ts',
        // API configuration (no business logic)
        'src/lib/api-config.ts',
      ],
    },
  },
});
