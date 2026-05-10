import { Hono } from 'hono';
import { authMiddleware } from '../middleware.js';
import { requireRole } from '../middleware.js';
import type { AppEnv } from '../index.js';
import {
  createPruneRecord,
  updatePruneRecord,
  listPruneRecords,
  isPruneRunning,
} from '../db-prune.js';
import { getLatestBackupRecord } from '../db-backup.js';
import {
  validateToleranceDays,
  countExpiredFreeDrops,
  executePrune,
  calculatePruneCutoff,
} from '../prune-logic.js';

const pruneRoutes = new Hono<AppEnv>();

// All prune routes require superadmin
pruneRoutes.use('*', authMiddleware);
pruneRoutes.use('*', requireRole('superadmin'));

/**
 * GET /preview - Preview how many drops would be pruned
 */
pruneRoutes.get('/preview', async (c) => {
  const coreDb = c.env.CORE_DB;
  const toleranceParam = c.req.query('toleranceDays');

  const validation = validateToleranceDays(
    toleranceParam !== undefined ? Number(toleranceParam) : undefined
  );
  if (!validation.valid) {
    return c.json({ error: { code: 'INVALID_INPUT', message: validation.error } }, 400);
  }

  const toleranceDays = validation.value!;
  const cutoff = calculatePruneCutoff(toleranceDays);
  const count = await countExpiredFreeDrops(coreDb, cutoff);

  // Check if recent backup exists
  const adminDb = c.env.ADMIN_DB;
  const latestBackup = await getLatestBackupRecord(adminDb);
  let backupWarning: string | null = null;

  if (!latestBackup || latestBackup.status !== 'complete') {
    backupWarning = 'No successful backup found. Run a backup before pruning.';
  } else if (latestBackup.completedAt) {
    const hoursSinceBackup =
      (Date.now() - new Date(latestBackup.completedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceBackup > 24) {
      backupWarning = `Last backup was ${Math.round(hoursSinceBackup)} hours ago. Consider running a fresh backup.`;
    }
  }

  return c.json({
    eligibleCount: count,
    toleranceDays,
    cutoff: cutoff.toISOString(),
    backupWarning,
  });
});

/**
 * POST / - Execute prune
 * Body: { toleranceDays?: number }
 */
pruneRoutes.post('/', async (c) => {
  const coreDb = c.env.CORE_DB;
  const adminDb = c.env.ADMIN_DB;
  const user = c.get('user');

  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401);
  }

  // Check if prune already running
  const running = await isPruneRunning(adminDb);
  if (running) {
    return c.json(
      { error: { code: 'PRUNE_IN_PROGRESS', message: 'A prune operation is already in progress' } },
      409
    );
  }

  // Parse body
  let toleranceDays = 0;
  try {
    const body = await c.req.json<{ toleranceDays?: number }>();
    const validation = validateToleranceDays(body.toleranceDays);
    if (!validation.valid) {
      return c.json({ error: { code: 'INVALID_INPUT', message: validation.error } }, 400);
    }
    toleranceDays = validation.value!;
  } catch {
    // Empty body is fine — default to 0
  }

  // Get latest backup for reference
  const latestBackup = await getLatestBackupRecord(adminDb);

  // Create prune record
  const record = await createPruneRecord(adminDb, {
    triggeredBy: user.id,
    toleranceDays,
    backupId: latestBackup?.status === 'complete' ? latestBackup.id : undefined,
  });

  try {
    // Update to running
    await updatePruneRecord(adminDb, record.id, { status: 'running' });

    // Execute prune
    const result = await executePrune(coreDb, toleranceDays);

    // Update record
    await updatePruneRecord(adminDb, record.id, {
      status: 'complete',
      prunedCount: result.prunedCount,
      completedAt: new Date(),
    });

    return c.json({
      id: record.id,
      status: 'complete',
      prunedCount: result.prunedCount,
      toleranceDays,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await updatePruneRecord(adminDb, record.id, {
      status: 'failed',
      errorMessage: message,
      completedAt: new Date(),
    });
    return c.json({ error: { code: 'PRUNE_ERROR', message } }, 500);
  }
});

/**
 * GET /history - List prune history
 */
pruneRoutes.get('/history', async (c) => {
  const adminDb = c.env.ADMIN_DB;
  const records = await listPruneRecords(adminDb);
  return c.json({
    prunes: records.map((r) => ({
      id: r.id,
      toleranceDays: r.toleranceDays,
      prunedCount: r.prunedCount,
      backupId: r.backupId,
      status: r.status,
      errorMessage: r.errorMessage,
      startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
      completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
    })),
  });
});

export { pruneRoutes };
