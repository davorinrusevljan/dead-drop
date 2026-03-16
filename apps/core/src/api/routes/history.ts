import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import { getDropById, getDropHistoryList, getDropHistoryVersion } from '../db.js';
import { TIER_VERSION_LIMITS } from '../db.js';

/**
 * History routes
 */
const history = new Hono<AppEnv>();

/**
 * GET /api/drops/:id/history - List drop history
 */
history.get('/api/drops/:id/history', async (c) => {
  const { id } = c.req.param();
  const db = c.env.DB;

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

  const historyList = await getDropHistoryList(db, id);

  // Include current version in the list
  const versions = [
    { version: drop.version, createdAt: drop.createdAt.toISOString() },
    ...historyList.map((h) => ({
      version: h.version,
      createdAt: h.createdAt.toISOString(),
    })),
  ];

  return c.json(
    {
      versions,
      current: drop.version,
      maxVersions: TIER_VERSION_LIMITS[drop.tier],
    },
    200
  );
});

/**
 * GET /api/drops/:id/history/:version - Get specific version
 */
history.get('/api/drops/:id/history/:version', async (c) => {
  const { id, version } = c.req.param();
  const db = c.env.DB;
  const versionNum = parseInt(version, 10);

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

  // If requesting current version, return from drop
  if (versionNum === drop.version) {
    return c.json(
      {
        version: drop.version,
        payload: drop.data ?? '',
        iv: drop.iv,
        createdAt: drop.createdAt.toISOString(),
      },
      200
    );
  }

  // Otherwise, look up in history
  const historyVersion = await getDropHistoryVersion(db, id, versionNum);
  if (!historyVersion) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Version not found',
        },
      },
      404
    );
  }

  return c.json(
    {
      version: historyVersion.version,
      payload: historyVersion.data ?? '',
      iv: historyVersion.iv,
      createdAt: historyVersion.createdAt.toISOString(),
    },
    200
  );
});

export { history as historyRoutes };
