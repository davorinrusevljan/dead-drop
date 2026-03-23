import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';
import { getDropById } from '../db.js';
import {
  generateRandomDropName,
  normalizeDropName,
  computeDropId,
  validateDropName,
} from '@dead-drop/engine';

/**
 * Maximum attempts to find an unused name
 */
const MAX_ATTEMPTS = 20;

/**
 * Response schema for generate-name endpoint
 */
export const generateNameResponseSchema = z.object({
  name: z
    .string()
    .openapi({ example: 'abacus-abide-ablaze-able', description: 'Generated drop name' }),
  id: z.string().openapi({ example: 'abc123...', description: 'SHA-256 hash of the name' }),
});

/**
 * Generate name route
 * GET /api/drops/generate-name
 */
export const generateNameRoute = createRoute({
  method: 'get',
  path: '/api/drops/generate-name',
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
          schema: z.object({
            error: z.object({
              code: z.string(),
              message: z.string(),
            }),
          }),
        },
      },
      description: 'Failed to generate unique name',
    },
  },
});

/**
 * Generate name handler
 */
export async function generateNameHandler(c: import('hono').Context<AppEnv>) {
  const db = c.env.DB;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Generate a random 4-word name
    const name = generateRandomDropName(4);
    const normalizedName = normalizeDropName(name);

    // Validate the name (should always pass for generated names, but be safe)
    const validation = validateDropName(normalizedName, 12);
    if (!validation.valid) {
      continue;
    }

    // Compute the drop ID
    const id = await computeDropId(normalizedName);

    // Check if it already exists
    const existing = await getDropById(db, id);
    if (!existing) {
      return c.json({ name: normalizedName, id }, 200);
    }
  }

  // Failed to find a unique name after MAX_ATTEMPTS
  return c.json(
    {
      error: {
        code: 'GENERATION_FAILED',
        message: 'Failed to generate a unique drop name. Please try again.',
      },
    },
    500
  );
}
