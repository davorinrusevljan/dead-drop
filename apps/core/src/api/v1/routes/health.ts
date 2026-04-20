import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../types.js';
import { healthResponseSchema } from '../openapi.js';

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
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

export function registerHealthRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(healthRoute, (c) => {
    return c.json({ status: 'ok' as const, timestamp: new Date().toISOString() }, 200);
  });
}
