import { drizzle } from 'drizzle-orm/d1';
import { sql, and, gte, lte } from 'drizzle-orm';
import { drops, dropAuditLog } from '@dead-drop/engine/db';

/**
 * Time period configurations
 */
export const TIME_PERIODS = {
  hour: { minutes: 60, bucketMinutes: 1 },
  day: { minutes: 24 * 60, bucketMinutes: 60 },
  threeDays: { minutes: 3 * 24 * 60, bucketMinutes: 60 },
  week: { minutes: 7 * 24 * 60, bucketMinutes: 24 * 60 },
  month: { minutes: 30 * 24 * 60, bucketMinutes: 24 * 60 },
  year: { minutes: 365 * 24 * 60, bucketMinutes: 7 * 24 * 60 },
} as const;

export type TimePeriod = keyof typeof TIME_PERIODS;

/**
 * Event counts for a time period
 */
export interface PeriodCounts {
  created: number;
  edited: number;
  deleted: number;
}

/**
 * Activity bucket for timeline charts
 */
export interface ActivityBucket {
  date: string;
  created: number;
  edited: number;
  deleted: number;
}

/**
 * Recent audit log entry
 */
export interface RecentActivity {
  action: string;
  dropId: string;
  createdAt: Date;
}

/**
 * Get overview statistics
 */
export async function getOverviewStats(db: D1Database): Promise<{
  totalDrops: number;
  activeDrops: number;
}> {
  const orm = drizzle(db);
  const now = new Date();

  const totalResult = await orm.select({ count: sql<number>`count(*)` }).from(drops);
  const totalDrops = totalResult[0]?.count ?? 0;

  const activeResult = await orm
    .select({ count: sql<number>`count(*)` })
    .from(drops)
    .where(gte(drops.expiresAt, now));
  const activeDrops = activeResult[0]?.count ?? 0;

  return { totalDrops, activeDrops };
}

/**
 * Get event counts for a time period
 */
export async function getPeriodCounts(db: D1Database, period: TimePeriod): Promise<PeriodCounts> {
  const orm = drizzle(db);
  const config = TIME_PERIODS[period];
  const startDate = new Date(Date.now() - config.minutes * 60 * 1000);

  const created = await orm
    .select({ count: sql<number>`count(*)` })
    .from(dropAuditLog)
    .where(and(sql`action = 'created'`, gte(dropAuditLog.createdAt, startDate)));

  const edited = await orm
    .select({ count: sql<number>`count(*)` })
    .from(dropAuditLog)
    .where(and(sql`action = 'edited'`, gte(dropAuditLog.createdAt, startDate)));

  const deleted = await orm
    .select({ count: sql<number>`count(*)` })
    .from(dropAuditLog)
    .where(and(sql`action = 'deleted'`, gte(dropAuditLog.createdAt, startDate)));

  return {
    created: created[0]?.count ?? 0,
    edited: edited[0]?.count ?? 0,
    deleted: deleted[0]?.count ?? 0,
  };
}

/**
 * Get all period counts at once
 */
export async function getAllPeriodCounts(
  db: D1Database
): Promise<Record<TimePeriod, PeriodCounts>> {
  const periods: TimePeriod[] = ['hour', 'day', 'threeDays', 'week', 'month', 'year'];
  const result: Record<string, PeriodCounts> = {};

  await Promise.all(
    periods.map(async (period) => {
      result[period] = await getPeriodCounts(db, period);
    })
  );

  return result as Record<TimePeriod, PeriodCounts>;
}

/**
 * Get distribution statistics
 */
export async function getDistributionStats(db: D1Database): Promise<{
  byTier: { free: number; deep: number };
  byVisibility: { public: number; private: number };
}> {
  const orm = drizzle(db);

  const tierResult = await orm
    .select({
      tier: drops.tier,
      count: sql<number>`count(*)`,
    })
    .from(drops)
    .groupBy(drops.tier);

  const visibilityResult = await orm
    .select({
      visibility: drops.visibility,
      count: sql<number>`count(*)`,
    })
    .from(drops)
    .groupBy(drops.visibility);

  const byTier = { free: 0, deep: 0 };
  const byVisibility = { public: 0, private: 0 };

  for (const row of tierResult) {
    if (row.tier === 'free') byTier.free = row.count;
    else if (row.tier === 'deep') byTier.deep = row.count;
  }

  for (const row of visibilityResult) {
    if (row.visibility === 'public') byVisibility.public = row.count;
    else if (row.visibility === 'private') byVisibility.private = row.count;
  }

  return { byTier, byVisibility };
}

/**
 * Get storage statistics
 */
export async function getStorageStats(db: D1Database): Promise<{
  textBytes: number;
  estimatedR2Bytes: number;
}> {
  const orm = drizzle(db);

  // Sum of data field lengths (text storage)
  const textResult = await orm
    .select({ total: sql<number>`coalesce(sum(length(data)), 0)` })
    .from(drops)
    .where(sql`data IS NOT NULL`);

  // Count of R2-stored drops (for estimation)
  const r2CountResult = await orm
    .select({ count: sql<number>`count(*)` })
    .from(drops)
    .where(sql`r2_key IS NOT NULL`);

  const textBytes = textResult[0]?.total ?? 0;
  // Estimate average 1MB per R2 object (would need actual R2 API for real size)
  const estimatedR2Bytes = (r2CountResult[0]?.count ?? 0) * 1024 * 1024;

  return { textBytes, estimatedR2Bytes };
}

/**
 * Get activity timeline for a period
 */
export async function getActivityTimeline(
  db: D1Database,
  period: TimePeriod
): Promise<ActivityBucket[]> {
  const orm = drizzle(db);
  const config = TIME_PERIODS[period];
  const startDate = new Date(Date.now() - config.minutes * 60 * 1000);

  // Get all audit log entries for the period
  const entries = await orm
    .select()
    .from(dropAuditLog)
    .where(gte(dropAuditLog.createdAt, startDate))
    .orderBy(dropAuditLog.createdAt);

  // Group by bucket
  const bucketMs = config.bucketMinutes * 60 * 1000;
  const buckets: Map<string, PeriodCounts> = new Map();

  // Initialize buckets for the entire period
  const now = Date.now();
  for (let t = Math.floor(now / bucketMs) * bucketMs; t >= startDate.getTime(); t -= bucketMs) {
    const key = new Date(t).toISOString();
    buckets.set(key, { created: 0, edited: 0, deleted: 0 });
  }

  // Fill buckets with actual data
  for (const entry of entries) {
    const bucketTime = Math.floor(new Date(entry.createdAt).getTime() / bucketMs) * bucketMs;
    const key = new Date(bucketTime).toISOString();
    const bucket = buckets.get(key);
    if (bucket && entry.action in bucket) {
      bucket[entry.action as keyof PeriodCounts]++;
    }
  }

  // Convert to array and sort by date
  return Array.from(buckets.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get recent activity entries
 */
export async function getRecentActivity(db: D1Database, limit = 50): Promise<RecentActivity[]> {
  const orm = drizzle(db);

  const result = await orm
    .select({
      action: dropAuditLog.action,
      dropId: dropAuditLog.dropId,
      createdAt: dropAuditLog.createdAt,
    })
    .from(dropAuditLog)
    .orderBy(sql`created_at DESC`)
    .limit(limit);

  return result as RecentActivity[];
}
