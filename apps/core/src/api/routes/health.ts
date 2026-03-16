import { createRoute } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';
import { healthResponseSchema } from '../openapi.js';

/**
 * Health check route
 * GET /api/health
 */
export const healthRoute = createRoute({
  method: 'get',
  path: '/api/health',
  tags: ['Health'],
  summary: 'Health check',
  description: 'Returns the health status of the API',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: healthResponseSchema,
        },
      },
      description: 'API is healthy',
    },
  },
});

/**
 * Health check handler
 */
export function healthHandler(c: import('hono').Context<AppEnv>) {
  return c.json(
    {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    },
    200
  );
}
