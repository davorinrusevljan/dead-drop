import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBackupRecord,
  updateBackupRecord,
  getBackupRecord,
  listBackupRecords,
  getLatestBackupRecord,
  isBackupRunning,
} from './db-backup.js';
import { createLocalD1Database, type D1Database } from '@dead-drop/engine/dev/d1-adapter';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create a test D1-compatible database with schema
 * Uses the same adapter as local dev (better-sqlite3 wrapping D1 interface)
 */
function createTestDb(): { db: D1Database; cleanup: () => void } {
  const schemaPath = join(__dirname, '../../schema.sql');
  const dbPath = join(tmpdir(), `test-backup-${randomUUID()}.db`);

  const db = createLocalD1Database(dbPath, schemaPath);

  // Seed test admin user
  db.prepare(
    "INSERT INTO admin_users (username, password_hash, salt, role) VALUES ('admin', 'hash', 'salt', 'superadmin')"
  )
    .bind()
    .run();

  return {
    db,
    cleanup: () => {
      try {
        db.close();
        if (existsSync(dbPath)) unlinkSync(dbPath);
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

describe('db-backup', () => {
  let db: D1Database;
  let cleanup: () => void;

  beforeEach(() => {
    const test = createTestDb();
    db = test.db;
    cleanup = test.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  describe('createBackupRecord', () => {
    it('should create a record with pending status', async () => {
      const record = await createBackupRecord(db, { triggeredBy: 1 });
      expect(record).toBeDefined();
      expect(record.triggeredBy).toBe(1);
      expect(record.status).toBe('pending');
      expect(record.r2Key).toBeNull();
      expect(record.startedAt).toBeDefined();
    });
  });

  describe('updateBackupRecord', () => {
    it('should update status to running', async () => {
      const record = await createBackupRecord(db, { triggeredBy: 1 });
      const updated = await updateBackupRecord(db, record.id, { status: 'running' });
      expect(updated?.status).toBe('running');
    });

    it('should update to complete with R2 key', async () => {
      const record = await createBackupRecord(db, { triggeredBy: 1 });
      const updated = await updateBackupRecord(db, record.id, {
        status: 'complete',
        r2Key: 'backups/20250509_143045_full.sql',
        r2SizeBytes: 12345,
        completedAt: new Date(),
      });
      expect(updated?.status).toBe('complete');
      expect(updated?.r2Key).toBe('backups/20250509_143045_full.sql');
      expect(updated?.r2SizeBytes).toBe(12345);
      expect(updated?.completedAt).toBeDefined();
    });

    it('should update to failed with error message', async () => {
      const record = await createBackupRecord(db, { triggeredBy: 1 });
      const updated = await updateBackupRecord(db, record.id, {
        status: 'failed',
        errorMessage: 'Connection timeout',
        completedAt: new Date(),
      });
      expect(updated?.status).toBe('failed');
      expect(updated?.errorMessage).toBe('Connection timeout');
    });

    it('should update CF bookmark', async () => {
      const record = await createBackupRecord(db, { triggeredBy: 1 });
      const updated = await updateBackupRecord(db, record.id, {
        cfBookmark: 'bookmark-123',
      });
      expect(updated?.cfBookmark).toBe('bookmark-123');
    });

    it('should return null for non-existent record', async () => {
      const updated = await updateBackupRecord(db, 9999, { status: 'running' });
      expect(updated).toBeNull();
    });
  });

  describe('getBackupRecord', () => {
    it('should return record by ID', async () => {
      const record = await createBackupRecord(db, { triggeredBy: 1 });
      const fetched = await getBackupRecord(db, record.id);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(record.id);
    });

    it('should return null for non-existent ID', async () => {
      const fetched = await getBackupRecord(db, 9999);
      expect(fetched).toBeNull();
    });
  });

  describe('listBackupRecords', () => {
    it('should return records ordered by most recent first', async () => {
      await createBackupRecord(db, { triggeredBy: 1 });
      await createBackupRecord(db, { triggeredBy: 1 });
      await createBackupRecord(db, { triggeredBy: 1 });

      const records = await listBackupRecords(db);
      expect(records.length).toBe(3);
      expect(records[0].id).toBeGreaterThan(records[1].id);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await createBackupRecord(db, { triggeredBy: 1 });
      }
      const records = await listBackupRecords(db, 2);
      expect(records.length).toBe(2);
    });
  });

  describe('getLatestBackupRecord', () => {
    it('should return most recent record', async () => {
      await createBackupRecord(db, { triggeredBy: 1 });
      const second = await createBackupRecord(db, { triggeredBy: 1 });

      const latest = await getLatestBackupRecord(db);
      expect(latest?.id).toBe(second.id);
    });

    it('should return null when no records exist', async () => {
      const latest = await getLatestBackupRecord(db);
      expect(latest).toBeNull();
    });
  });

  describe('isBackupRunning', () => {
    it('should return false when no backups are running', async () => {
      expect(await isBackupRunning(db)).toBe(false);
    });

    it('should return true when a backup is running', async () => {
      await createBackupRecord(db, { triggeredBy: 1 });
      // Directly set status to running
      await db.exec("UPDATE backup_history SET status = 'running' WHERE id = 1");
      expect(await isBackupRunning(db)).toBe(true);
    });

    it('should return false when backup is complete', async () => {
      await createBackupRecord(db, { triggeredBy: 1 });
      await db.exec("UPDATE backup_history SET status = 'complete' WHERE id = 1");
      expect(await isBackupRunning(db)).toBe(false);
    });

    it('should return false when backup failed', async () => {
      await createBackupRecord(db, { triggeredBy: 1 });
      await db.exec("UPDATE backup_history SET status = 'failed' WHERE id = 1");
      expect(await isBackupRunning(db)).toBe(false);
    });
  });
});
