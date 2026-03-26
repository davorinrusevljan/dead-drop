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
    },
  },
});
