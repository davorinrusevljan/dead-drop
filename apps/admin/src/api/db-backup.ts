import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { backupHistory, type BackupHistoryRecord, type BackupStatus } from './schema.js';

/**
 * Create a new backup history record
 */
export async function createBackupRecord(
  db: D1Database,
  data: {
    triggeredBy: number;
  }
): Promise<BackupHistoryRecord> {
  const orm = drizzle(db);
  const now = new Date();

  const result = await orm
    .insert(backupHistory)
    .values({
      triggeredBy: data.triggeredBy,
      status: 'pending',
      startedAt: now,
    })
    .returning();

  return result[0] as BackupHistoryRecord;
}

/**
 * Update backup history record
 */
export async function updateBackupRecord(
  db: D1Database,
  id: number,
  data: {
    status?: BackupStatus;
    r2Key?: string | null;
    r2SizeBytes?: number | null;
    cfBookmark?: string | null;
    cfExportId?: string | null;
    errorMessage?: string | null;
    completedAt?: Date | null;
  }
): Promise<BackupHistoryRecord | null> {
  const orm = drizzle(db);

  await orm.update(backupHistory).set(data).where(eq(backupHistory.id, id));
  return getBackupRecord(db, id);
}

/**
 * Get a backup record by ID
 */
export async function getBackupRecord(
  db: D1Database,
  id: number
): Promise<BackupHistoryRecord | null> {
  const orm = drizzle(db);
  const result = await orm.select().from(backupHistory).where(eq(backupHistory.id, id)).limit(1);
  return (result[0] as BackupHistoryRecord | undefined) ?? null;
}

/**
 * List backup history records (most recent first)
 */
export async function listBackupRecords(
  db: D1Database,
  limit = 50
): Promise<BackupHistoryRecord[]> {
  const orm = drizzle(db);
  return orm.select().from(backupHistory).orderBy(desc(backupHistory.id)).limit(limit) as Promise<
    BackupHistoryRecord[]
  >;
}

/**
 * Get the most recent backup record
 */
export async function getLatestBackupRecord(db: D1Database): Promise<BackupHistoryRecord | null> {
  const orm = drizzle(db);
  const result = await orm.select().from(backupHistory).orderBy(desc(backupHistory.id)).limit(1);
  return (result[0] as BackupHistoryRecord | undefined) ?? null;
}

/**
 * Check if a backup is currently running
 */
export async function isBackupRunning(db: D1Database): Promise<boolean> {
  const orm = drizzle(db);
  const result = await orm
    .select({ status: backupHistory.status })
    .from(backupHistory)
    .where(eq(backupHistory.status, 'running'))
    .limit(1);
  return result.length > 0;
}
