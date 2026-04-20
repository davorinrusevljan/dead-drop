import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../types.js';
import { checkAvailabilityResponseSchema } from '../openapi.js';
import { getDropById, deleteDrop as deleteDropFromDb } from '../../db.js';

export const checkAvailabilityRoute = createRoute({
  method: 'get',
  path: '/drops/check/{id}',
  tags: ['Drops'],
  summary: 'Check if a drop name is available',
  description:
    'Check if a drop with the given ID exists. Returns 200 with availability status regardless of whether the drop exists.',
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      description: 'SHA-256 hash of the drop name',
      schema: { type: 'string' },
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: checkAvailabilityResponseSchema,
        },
      },
      description: 'Availability status',
    },
  },
});

export function registerCheckAvailabilityRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(checkAvailabilityRoute, async (c) => {
    const { id } = c.req.param();
    const db = c.env.DB;
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ id, available: true }, 200);
    }
    if (new Date() > drop.expiresAt) {
      c.executionCtx?.waitUntil?.(deleteDropFromDb(db, id));
      return c.json({ id, available: true }, 200);
    }
    return c.json({ id, available: false }, 200);
  });
}
