import { Hono } from 'hono';
import {
  getOverviewStats,
  getAllPeriodCounts,
  getDistributionStats,
  getStorageStats,
  getActivityTimeline,
  getRecentActivity,
  type TimePeriod,
} from '../db-stats.js';
import { authMiddleware } from '../middleware.js';
import type { AppEnv } from '../index.js';

const statsRoutes = new Hono<AppEnv>();

// All stats routes require authentication
statsRoutes.use('*', authMiddleware);

/**
 * GET /api/stats/overview - Get overview statistics
 */
statsRoutes.get('/overview', async (c) => {
  const stats = await getOverviewStats(c.env.CORE_DB);
  return c.json(stats);
});

/**
 * GET /api/stats/by-period - Get event counts for all time periods
 */
statsRoutes.get('/by-period', async (c) => {
  const counts = await getAllPeriodCounts(c.env.CORE_DB);
  return c.json(counts);
});

/**
 * GET /api/stats/distribution - Get drop distribution by tier and visibility
 */
statsRoutes.get('/distribution', async (c) => {
  const stats = await getDistributionStats(c.env.CORE_DB);
  return c.json(stats);
});

/**
 * GET /api/stats/storage - Get storage statistics
 */
statsRoutes.get('/storage', async (c) => {
  const stats = await getStorageStats(c.env.CORE_DB);
  return c.json(stats);
});

/**
 * GET /api/stats/activity - Get activity timeline and recent activity
 * Query params:
 *   - period: hour | day | threeDays | week | month | year (default: week)
 */
statsRoutes.get('/activity', async (c) => {
  const periodParam = c.req.query('period') as TimePeriod | undefined;
  const validPeriods: TimePeriod[] = ['hour', 'day', 'threeDays', 'week', 'month', 'year'];
  const period: TimePeriod = validPeriods.includes(periodParam!) ? periodParam! : 'week';

  const [buckets, recent] = await Promise.all([
    getActivityTimeline(c.env.CORE_DB, period),
    getRecentActivity(c.env.CORE_DB, 50),
  ]);

  return c.json({
    buckets,
    recent: recent.map((r) => ({
      action: r.action,
      dropId: r.dropId,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
  });
});

export { statsRoutes };
