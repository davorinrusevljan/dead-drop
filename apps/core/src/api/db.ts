import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and } from 'drizzle-orm';
import { drops, dropHistory, dropAuditLog } from '@dead-drop/engine/db';
import type { DropTier, DropVisibility } from '@dead-drop/engine';

/**
 * Drop record type from database
 */
export interface DropRecord {
  id: string;
  version: number;
  data: string | null;
  r2Key: string | null;
  visibility: 'protected' | 'public';
  salt: string;
  iv: string | null;
  adminHash: string;
  tier: 'free' | 'deep';
  paymentStatus: 'none' | 'pending' | 'completed';
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Drop history record type from database
 */
export interface DropHistoryRecord {
  id: number;
  dropId: string;
  version: number;
  data: string | null;
  r2Key: string | null;
  iv: string | null;
  createdAt: Date;
}

/**
 * Create a new drop
 */
export async function createDrop(
  db: D1Database,
  data: {
    id: string;
    visibility: DropVisibility;
    data: string | null;
    r2Key: string | null;
    salt: string;
    iv: string | null;
    adminHash: string;
    tier: DropTier;
    expiresAt: Date;
  }
): Promise<DropRecord> {
  const orm = drizzle(db);
  const now = new Date();

  await orm.insert(drops).values({
    id: data.id,
    version: 1,
    data: data.data,
    r2Key: data.r2Key,
    visibility: data.visibility,
    salt: data.salt,
    iv: data.iv,
    adminHash: data.adminHash,
    tier: data.tier,
    paymentStatus: 'none',
    expiresAt: data.expiresAt,
    createdAt: now,
  });

  // Create audit log entry
  await orm.insert(dropAuditLog).values({
    dropId: data.id,
    action: 'created',
    version: 1,
    createdAt: now,
  });
  return getDropById(db, data.id) as Promise<DropRecord>;
}

/**
 * Get a drop by ID
 */
export async function getDropById(db: D1Database, id: string): Promise<DropRecord | null> {
  const orm = drizzle(db);
  const result = await orm.select().from(drops).where(eq(drops.id, id)).limit(1);
  return (result[0] as DropRecord | undefined) ?? null;
}

/**
 * Update a drop (creates history entry)
 */
export async function updateDrop(
  db: D1Database,
  id: string,
  data: {
    data: string | null;
    r2Key: string | null;
    iv: string | null;
    adminHash: string;
  }
): Promise<DropRecord | null> {
  const orm = drizzle(db);
  const existing = await getDropById(db, id);
  if (!existing) return null;
  const newVersion = existing.version + 1;
  const now = new Date();
  // Archive current version to history
  await orm.insert(dropHistory).values({
    dropId: id,
    version: existing.version,
    data: existing.data,
    r2Key: existing.r2Key,
    iv: existing.iv,
    createdAt: existing.createdAt,
  });
  // Update the drop
  await orm
    .update(drops)
    .set({
      version: newVersion,
      data: data.data,
      r2Key: data.r2Key,
      iv: data.iv,
      adminHash: data.adminHash,
      createdAt: now,
    })
    .where(eq(drops.id, id));
  // Create audit log entry
  await orm.insert(dropAuditLog).values({
    dropId: id,
    action: 'edited',
    version: newVersion,
    createdAt: now,
  });
  return getDropById(db, id);
}

/**
 * Delete a drop and all its history
 */
export async function deleteDrop(db: D1Database, id: string): Promise<boolean> {
  const orm = drizzle(db);
  const existing = await getDropById(db, id);
  if (!existing) return false;
  const now = new Date();
  // Create audit log entry before deletion
  await orm.insert(dropAuditLog).values({
    dropId: id,
    action: 'deleted',
    version: null,
    createdAt: now,
  });
  // Delete history entries
  await orm.delete(dropHistory).where(eq(dropHistory.dropId, id));
  // Delete the drop
  await orm.delete(drops).where(eq(drops.id, id));
  return true;
}

/**
 * Get drop history list
 */
export async function getDropHistoryList(
  db: D1Database,
  id: string
): Promise<{ version: number; createdAt: Date }[]> {
  const orm = drizzle(db);
  const result = await orm
    .select({ version: dropHistory.version, createdAt: dropHistory.createdAt })
    .from(dropHistory)
    .where(eq(dropHistory.dropId, id))
    .orderBy(desc(dropHistory.version));
  return result;
}

/**
 * Get a specific historical version
 */
export async function getDropHistoryVersion(
  db: D1Database,
  id: string,
  version: number
): Promise<DropHistoryRecord | null> {
  const orm = drizzle(db);
  const result = await orm
    .select()
    .from(dropHistory)
    .where(eq(dropHistory.dropId, id))
    .where(eq(dropHistory.version, version))
    .limit(1);
  return (result[0] as DropRecord | undefined) ?? null;
}

/**
 * Count history versions for a drop
 */
export async function countDropVersions(db: D1Database, id: string): Promise<number> {
  const orm = drizzle(db);
  const history = await orm
    .select({ version: dropHistory.version })
    .from(dropHistory)
    .where(eq(dropHistory.dropId, id));
  // +1 for current version
  return history.length + 1;
}

/**
 * Upgrade a drop to Deep tier
 */
export async function upgradeDrop(
  db: D1Database,
  id: string
): Promise<DropRecord | null> {
  const orm = drizzle(db);
  const existing = await getDropById(db, id);
  if (!existing) return null;
  // Extend expiration to 90 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);
  await orm
    .update(drops)
    .set({
      tier: 'deep',
      expiresAt,
    })
    .where(eq(drops.id, id));
  return getDropById(db, id);
}

/**
 * Tier version limits
 */
export const TIER_VERSION_LIMITS: Record<DropTier, number> = {
  free: 5,
  deep: 20,
};

/**
 * Tier phrase length minimums
 */
export const TIER_PHRASE_MIN_LENGTHS: Record<DropTier, number> = {
  free: 8,
  deep: 3,
};

/**
 * Tier max payload sizes (in bytes)
 */
export const TIER_MAX_PAYLOAD_SIZES: Record<DropTier, number> = {
  free: 10 * 1024, // 10 KB
  deep: 4 * 1024 * 1024, // 4 MB
};

/**
 * Tier expiration days
 */
export const TIER_EXPIRATION_DAYS: Record<DropTier, number> = {
  free: 7,
  deep: 90,
};
