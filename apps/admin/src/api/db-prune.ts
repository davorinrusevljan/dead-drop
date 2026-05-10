import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { pruneHistory, type PruneHistoryRecord } from './schema.js';

/**
 * Create a new prune history record
 */
export async function createPruneRecord(
  db: D1Database,
  data: {
    triggeredBy: number;
    toleranceDays: number;
    backupId?: number;
  }
): Promise<PruneHistoryRecord> {
  const orm = drizzle(db);
  const now = new Date();

  const result = await orm
    .insert(pruneHistory)
    .values({
      triggeredBy: data.triggeredBy,
      toleranceDays: data.toleranceDays,
      backupId: data.backupId ?? null,
      status: 'pending',
      startedAt: now,
    })
    .returning();

  return result[0] as PruneHistoryRecord;
}

/**
 * Update prune history record
 */
export async function updatePruneRecord(
  db: D1Database,
  id: number,
  data: {
    status?: 'pending' | 'running' | 'complete' | 'failed';
    prunedCount?: number;
    errorMessage?: string | null;
    completedAt?: Date | null;
  }
): Promise<PruneHistoryRecord | null> {
  const orm = drizzle(db);
  await orm.update(pruneHistory).set(data).where(eq(pruneHistory.id, id));
  return getPruneRecord(db, id);
}

/**
 * Get a prune record by ID
 */
export async function getPruneRecord(
  db: D1Database,
  id: number
): Promise<PruneHistoryRecord | null> {
  const orm = drizzle(db);
  const result = await orm.select().from(pruneHistory).where(eq(pruneHistory.id, id)).limit(1);
  return (result[0] as PruneHistoryRecord | undefined) ?? null;
}

/**
 * List prune history records (most recent first)
 */
export async function listPruneRecords(db: D1Database, limit = 50): Promise<PruneHistoryRecord[]> {
  const orm = drizzle(db);
  return orm.select().from(pruneHistory).orderBy(desc(pruneHistory.id)).limit(limit) as Promise<
    PruneHistoryRecord[]
  >;
}

/**
 * Check if a prune is currently running
 */
export async function isPruneRunning(db: D1Database): Promise<boolean> {
  const orm = drizzle(db);
  const result = await orm
    .select({ status: pruneHistory.status })
    .from(pruneHistory)
    .where(eq(pruneHistory.status, 'running'))
    .limit(1);
  return result.length > 0;
}
