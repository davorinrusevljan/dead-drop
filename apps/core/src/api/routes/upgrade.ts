import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import { getDropById, upgradeDrop } from '../db.js';

/**
 * Upgrade routes
 */
const upgrade = new Hono<AppEnv>();

/**
 * POST /api/drops/:id/upgrade - Upgrade a drop to Deep tier
 */
upgrade.post('/api/drops/:id/upgrade', async (c) => {
  const { id } = c.req.param();
  const db = c.env.DB;
  const expectedToken = c.env.UPGRADE_TOKEN;

  const drop = await getDropById(db, id);
  if (!drop) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Drop not found',
        },
      },
      404
    );
  }

  if (drop.tier !== 'free') {
    return c.json(
      {
        error: {
          code: 'ALREADY_UPGRADED',
          message: 'Drop is already upgraded',
        },
      },
      400
    );
  }

  const body = await c.req.json<{ token: string }>();

  if (body.token !== expectedToken) {
    return c.json(
      {
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid upgrade token',
        },
      },
      401
    );
  }

  const updated = await upgradeDrop(db, id);

  return c.json(
    {
      success: true,
      tier: 'deep',
      expiresAt: updated?.expiresAt.toISOString() ?? '',
    },
    200
  );
});

export { upgrade as upgradeRoutes };
