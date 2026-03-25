/**
 * Local database module using better-sqlite3
 * Provides the same interface as db.ts but for local development
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, desc, and } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { drops, dropHistory, dropAuditLog } from '@dead-drop/engine/db';
import type {
  DropTier,
  DropVisibility,
  EncryptionAlgorithm,
  EncryptionParams,
  MimeType,
} from '@dead-drop/engine';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Drop record type from database
 */
export interface DropRecord {
  id: string;
  version: number;
  data: string | null;
  r2Key: string | null;
  visibility: 'private' | 'public';
  salt: string;
  iv: string | null;
  encryptionAlgo: EncryptionAlgorithm;
  encryptionParams: string | null;
  mimeType: MimeType;
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
  encryptionAlgo: EncryptionAlgorithm | null;
  encryptionParams: string | null;
  mimeType: MimeType | null;
  createdAt: Date;
}

/**
 * Local database wrapper
 */
export class LocalDatabase {
  private sqlite: Database.Database;
  public orm: ReturnType<typeof drizzle>;

  constructor(dbPath: string, schemaPath?: string) {
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.sqlite = new Database(dbPath);
    this.sqlite.pragma('foreign_keys = ON');

    // Initialize schema if provided and database is new
    if (schemaPath && !existsSync(dbPath)) {
      const schema = readFileSync(schemaPath, 'utf-8');
      this.sqlite.exec(schema);
    } else if (schemaPath) {
      // Always run schema to ensure tables exist (uses IF NOT EXISTS)
      const schema = readFileSync(schemaPath, 'utf-8');
      this.sqlite.exec(schema);
    }

    this.orm = drizzle(this.sqlite);
  }

  async createDrop(data: {
    id: string;
    visibility: DropVisibility;
    data: string | null;
    r2Key: string | null;
    salt: string;
    iv: string | null;
    encryptionAlgo?: EncryptionAlgorithm;
    encryptionParams?: EncryptionParams | null;
    mimeType?: MimeType;
    adminHash: string;
    tier: DropTier;
    expiresAt: Date;
  }): Promise<DropRecord> {
    const now = new Date();

    await this.orm.insert(drops).values({
      id: data.id,
      version: 1,
      data: data.data,
      r2Key: data.r2Key,
      visibility: data.visibility,
      salt: data.salt,
      iv: data.iv,
      encryptionAlgo: data.encryptionAlgo ?? 'pbkdf2-aes256-gcm-v1',
      encryptionParams: data.encryptionParams ? JSON.stringify(data.encryptionParams) : null,
      mimeType: data.mimeType ?? 'text/plain',
      adminHash: data.adminHash,
      tier: data.tier,
      paymentStatus: 'none',
      expiresAt: data.expiresAt,
      createdAt: now,
    });

    // Create audit log entry
    await this.orm.insert(dropAuditLog).values({
      dropId: data.id,
      action: 'created',
      version: 1,
      createdAt: now,
    });

    return this.getDropById(data.id) as Promise<DropRecord>;
  }

  async getDropById(id: string): Promise<DropRecord | null> {
    const result = await this.orm.select().from(drops).where(eq(drops.id, id)).limit(1);
    return (result[0] as DropRecord | undefined) ?? null;
  }

  async updateDrop(
    id: string,
    data: {
      data: string | null;
      r2Key: string | null;
      iv: string | null;
      mimeType?: MimeType;
      adminHash: string;
    }
  ): Promise<DropRecord | null> {
    const existing = await this.getDropById(id);
    if (!existing) return null;

    const newVersion = existing.version + 1;
    const now = new Date();

    // Archive current version to history
    await this.orm.insert(dropHistory).values({
      dropId: id,
      version: existing.version,
      data: existing.data,
      r2Key: existing.r2Key,
      iv: existing.iv,
      encryptionAlgo: existing.encryptionAlgo,
      encryptionParams: existing.encryptionParams,
      mimeType: existing.mimeType,
      createdAt: existing.createdAt,
    });

    // Update the drop
    await this.orm
      .update(drops)
      .set({
        version: newVersion,
        data: data.data,
        r2Key: data.r2Key,
        iv: data.iv,
        mimeType: data.mimeType ?? existing.mimeType,
        adminHash: data.adminHash,
        createdAt: now,
      })
      .where(eq(drops.id, id));

    // Create audit log entry
    await this.orm.insert(dropAuditLog).values({
      dropId: id,
      action: 'edited',
      version: newVersion,
      createdAt: now,
    });

    return this.getDropById(id);
  }

  async deleteDrop(id: string): Promise<boolean> {
    const existing = await this.getDropById(id);
    if (!existing) return false;

    const now = new Date();

    // Create audit log entry before deletion
    await this.orm.insert(dropAuditLog).values({
      dropId: id,
      action: 'deleted',
      version: null,
      createdAt: now,
    });

    // Delete history entries
    await this.orm.delete(dropHistory).where(eq(dropHistory.dropId, id));

    // Delete the drop
    await this.orm.delete(drops).where(eq(drops.id, id));

    return true;
  }

  async getDropHistoryList(id: string): Promise<{ version: number; createdAt: Date }[]> {
    const result = await this.orm
      .select({ version: dropHistory.version, createdAt: dropHistory.createdAt })
      .from(dropHistory)
      .where(eq(dropHistory.dropId, id))
      .orderBy(desc(dropHistory.version));
    return result;
  }

  async getDropHistoryVersion(id: string, version: number): Promise<DropHistoryRecord | null> {
    const result = await this.orm
      .select()
      .from(dropHistory)
      .where(and(eq(dropHistory.dropId, id), eq(dropHistory.version, version)))
      .limit(1);
    return (result[0] as DropHistoryRecord | undefined) ?? null;
  }

  async countDropVersions(id: string): Promise<number> {
    const history = await this.orm
      .select({ version: dropHistory.version })
      .from(dropHistory)
      .where(eq(dropHistory.dropId, id));
    // +1 for current version
    return history.length + 1;
  }

  async upgradeDrop(id: string): Promise<DropRecord | null> {
    const existing = await this.getDropById(id);
    if (!existing) return null;

    // Extend expiration to 90 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await this.orm
      .update(drops)
      .set({
        tier: 'deep',
        expiresAt,
      })
      .where(eq(drops.id, id));

    return this.getDropById(id);
  }

  close(): void {
    this.sqlite.close();
  }
}

/**
 * Tier limits (same as db.ts)
 */
export const TIER_VERSION_LIMITS: Record<DropTier, number> = {
  free: 5,
  deep: 20,
};

export const TIER_NAME_MIN_LENGTHS: Record<DropTier, number> = {
  free: 12,
  deep: 3,
};

export const TIER_MAX_PAYLOAD_SIZES: Record<DropTier, number> = {
  free: 10 * 1024, // 10 KB
  deep: 4 * 1024 * 1024, // 4 MB
};

export const TIER_EXPIRATION_DAYS: Record<DropTier, number> = {
  free: 7,
  deep: 90,
};
