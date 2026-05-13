/**
 * Prune logic for expired free-tier drops
 *
 * Deletes drops where:
 *   tier = 'free' AND expiresAt < (now - toleranceDays)
 *
 * Preserves: audit log entries, deep-tier drops, active drops
 * Cascading: deletes drop_history rows for pruned drops
 */

import { drizzle } from 'drizzle-orm/d1';
import { and, lt, eq, sql, inArray } from 'drizzle-orm';
import { drops, dropHistory } from '@dead-drop/engine/db';

/**
 * Maximum tolerance days allowed
 */
export const MAX_TOLERANCE_DAYS = 2;

/**
 * Batch size for deletes (D1 query size limits)
 */
export const PRUNE_BATCH_SIZE = 100;

/**
 * Calculate the cutoff timestamp for pruning
 * Drops with expiresAt before this timestamp are eligible
 * toleranceDays provides a grace period after expiry (e.g. 2 = prune only drops expired 2+ days ago)
 */
export function calculatePruneCutoff(toleranceDays: number = 0): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - toleranceDays);
  return cutoff;
}

/**
 * Validate tolerance days parameter
 */
export function validateToleranceDays(toleranceDays: unknown): {
  valid: boolean;
  value?: number;
  error?: string;
} {
  if (toleranceDays === undefined || toleranceDays === null) {
    return { valid: true, value: 0 };
  }

  const num = Number(toleranceDays);

  if (isNaN(num) || !Number.isInteger(num)) {
    return { valid: false, error: 'toleranceDays must be an integer' };
  }

  if (num < 0) {
    return { valid: false, error: 'toleranceDays must be >= 0' };
  }

  if (num > MAX_TOLERANCE_DAYS) {
    return { valid: false, error: `toleranceDays must be <= ${MAX_TOLERANCE_DAYS}` };
  }

  return { valid: true, value: num };
}

/**
 * Find expired free-tier drop IDs eligible for pruning
 */
export async function findExpiredFreeDropIds(
  db: D1Database,
  cutoff: Date,
  limit: number = PRUNE_BATCH_SIZE
): Promise<string[]> {
  const orm = drizzle(db);
  const result = await orm
    .select({ id: drops.id })
    .from(drops)
    .where(and(eq(drops.tier, 'free'), lt(drops.expiresAt, cutoff)))
    .limit(limit);

  return result.map((r) => r.id as string);
}

/**
 * Count expired free-tier drops eligible for pruning
 */
export async function countExpiredFreeDrops(db: D1Database, cutoff: Date): Promise<number> {
  const orm = drizzle(db);
  const result = await orm
    .select({ count: sql<number>`count(*)` })
    .from(drops)
    .where(and(eq(drops.tier, 'free'), lt(drops.expiresAt, cutoff)));

  return result[0]?.count ?? 0;
}

/**
 * Prune a batch of drops by IDs
 * Deletes drop_history entries for each drop, then the drops themselves
 * Does NOT delete audit log entries (preserved for analytics)
 */
export async function pruneDropBatch(
  db: D1Database,
  dropIds: string[]
): Promise<{ deleted: number }> {
  if (dropIds.length === 0) return { deleted: 0 };

  const orm = drizzle(db);

  // Delete history entries for these drops
  await orm.delete(dropHistory).where(inArray(dropHistory.dropId, dropIds));

  // Delete the drops
  const result = await orm.delete(drops).where(inArray(drops.id, dropIds));

  return { deleted: dropIds.length };
}

/**
 * Execute full prune operation
 * Processes drops in batches to respect D1 limits
 */
export async function executePrune(
  db: D1Database,
  toleranceDays: number = 0
): Promise<{ prunedCount: number; batches: number }> {
  const cutoff = calculatePruneCutoff(toleranceDays);
  let totalPruned = 0;
  let batches = 0;

  // Keep processing until no more expired drops
  while (true) {
    const dropIds = await findExpiredFreeDropIds(db, cutoff, PRUNE_BATCH_SIZE);

    if (dropIds.length === 0) break;

    await pruneDropBatch(db, dropIds);
    totalPruned += dropIds.length;
    batches++;

    // If we got fewer than batch size, we're done
    if (dropIds.length < PRUNE_BATCH_SIZE) break;
  }

  return { prunedCount: totalPruned, batches };
}
