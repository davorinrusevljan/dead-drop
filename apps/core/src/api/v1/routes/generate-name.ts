import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../types.js';
import { generateNameResponseSchema, errorResponseSchema } from '../openapi.js';
import { generateRandomDropName, normalizeDropName, validateDropName, computeDropId } from '@dead-drop/engine';
import { getDropById } from '../../db.js';

/**
 * Maximum attempts to find an unused name
 */
const MAX_ATTEMPTS = 20;

export const generateNameRoute = createRoute({
  method: 'get',
  path: '/drops/generate-name',
  tags: ['Drops'],
  summary: 'Generate a random unused drop name',
  description:
    'Generates a random 4-word drop name using the EFF Diceware wordlist and ensures it is not already in use.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: generateNameResponseSchema,
        },
      },
      description: 'A unique random drop name',
    },
    500: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Failed to generate unique name',
    },
  },
});

export function registerGenerateNameRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(generateNameRoute, async (c) => {
    const db = c.env.DB;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const name = generateRandomDropName(4);
      const normalizedName = normalizeDropName(name);
      const validation = validateDropName(normalizedName, 12);
      if (!validation.valid) continue;
      const id = await computeDropId(normalizedName);
      const existing = await getDropById(db, id);
      if (!existing) {
        return c.json({ name: normalizedName, id }, 200);
      }
    }
    return c.json(
      {
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate a unique drop name. Please try again.',
        },
      },
      500
    );
  });
}
