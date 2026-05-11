import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  calculatePruneCutoff,
  validateToleranceDays,
  findExpiredFreeDropIds,
  countExpiredFreeDrops,
  pruneDropBatch,
  executePrune,
  FREE_TIER_EXPIRATION_DAYS,
  MAX_TOLERANCE_DAYS,
} from './prune-logic.js';
import { createLocalD1Database } from '@dead-drop/engine/dev/d1-adapter';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create test DB with drops + drop_history + drop_audit_log tables
 */
function createTestDb(): { db: D1Database; cleanup: () => void } {
  const dbPath = join(tmpdir(), `test-prune-${randomUUID()}.db`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createLocalD1Database(dbPath) as any;

  // Create core schema
  db.exec(`
    CREATE TABLE drops (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      data TEXT,
      r2_key TEXT,
      visibility TEXT NOT NULL DEFAULT 'private',
      salt TEXT NOT NULL,
      iv TEXT,
      encryption_algo TEXT NOT NULL DEFAULT 'pbkdf2-aes256-gcm-v1',
      encryption_params TEXT,
      mime_type TEXT NOT NULL DEFAULT 'text/plain',
      admin_hash TEXT NOT NULL,
      hash_algo TEXT DEFAULT 'sha-256' NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free',
      payment_status TEXT NOT NULL DEFAULT 'none',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE drop_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drop_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      data TEXT,
      r2_key TEXT,
      iv TEXT,
      encryption_algo TEXT,
      encryption_params TEXT,
      mime_type TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE drop_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drop_id TEXT NOT NULL,
      action TEXT NOT NULL,
      version INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  return {
    db,
    cleanup: () => {
      try {
        db.close();
        if (existsSync(dbPath)) unlinkSync(dbPath);
      } catch {
        // Ignore
      }
    },
  };
}

/**
 * Insert a test drop
 */
function insertDrop(
  db: D1Database,
  opts: {
    id: string;
    tier?: 'free' | 'deep';
    expiresAt: Date;
    visibility?: 'private' | 'public';
  }
) {
  db.prepare(
    `INSERT INTO drops (id, tier, expires_at, visibility, salt, admin_hash) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      opts.id,
      opts.tier ?? 'free',
      Math.floor(opts.expiresAt.getTime() / 1000),
      opts.visibility ?? 'private',
      'salt',
      'hash'
    )
    .run();
}

/**
 * Insert a drop history entry
 */
function insertDropHistory(db: D1Database, dropId: string, version: number) {
  db.prepare(`INSERT INTO drop_history (drop_id, version, data) VALUES (?, ?, ?)`)
    .bind(dropId, version, 'data')
    .run();
}

/**
 * Insert an audit log entry
 */
function insertAuditLog(db: D1Database, dropId: string, action: string) {
  db.prepare(`INSERT INTO drop_audit_log (drop_id, action) VALUES (?, ?)`)
    .bind(dropId, action)
    .run();
}

/**
 * Count remaining drops
 */
async function countDrops(db: D1Database): Promise<number> {
  const result = await db.prepare('SELECT count(*) as cnt FROM drops').first<{ cnt: number }>();
  return result?.cnt ?? 0;
}

async function countHistory(db: D1Database): Promise<number> {
  const result = await db
    .prepare('SELECT count(*) as cnt FROM drop_history')
    .first<{ cnt: number }>();
  return result?.cnt ?? 0;
}

async function countAuditLog(db: D1Database): Promise<number> {
  const result = await db
    .prepare('SELECT count(*) as cnt FROM drop_audit_log')
    .first<{ cnt: number }>();
  return result?.cnt ?? 0;
}

describe('prune-logic', () => {
  describe('calculatePruneCutoff', () => {
    it('should return cutoff 7 days ago by default', () => {
      const cutoff = calculatePruneCutoff(0);
      const expected = new Date();
      expected.setDate(expected.getDate() - 7);
      // Allow 1 second tolerance
      expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it('should include tolerance days', () => {
      const cutoff = calculatePruneCutoff(2);
      const expected = new Date();
      expected.setDate(expected.getDate() - 9);
      expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(1000);
    });
  });

  describe('validateToleranceDays', () => {
    it('should accept undefined (default to 0)', () => {
      const result = validateToleranceDays(undefined);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(0);
    });

    it('should accept null (default to 0)', () => {
      const result = validateToleranceDays(null);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(0);
    });

    it('should accept 0', () => {
      const result = validateToleranceDays(0);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(0);
    });

    it('should accept 1', () => {
      const result = validateToleranceDays(1);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(1);
    });

    it('should accept max tolerance', () => {
      const result = validateToleranceDays(MAX_TOLERANCE_DAYS);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(MAX_TOLERANCE_DAYS);
    });

    it('should reject negative', () => {
      const result = validateToleranceDays(-1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('>= 0');
    });

    it('should reject above max', () => {
      const result = validateToleranceDays(MAX_TOLERANCE_DAYS + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`<= ${MAX_TOLERANCE_DAYS}`);
    });

    it('should reject non-integer', () => {
      const result = validateToleranceDays(1.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('integer');
    });

    it('should reject NaN', () => {
      const result = validateToleranceDays(NaN);
      expect(result.valid).toBe(false);
    });

    it('should reject string', () => {
      const result = validateToleranceDays('abc');
      expect(result.valid).toBe(false);
    });
  });

  describe('findExpiredFreeDropIds + countExpiredFreeDrops', () => {
    let db: D1Database;
    let cleanup: () => void;

    beforeEach(() => {
      const test = createTestDb();
      db = test.db;
      cleanup = test.cleanup;

      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10);

      const activeDate = new Date();
      activeDate.setDate(activeDate.getDate() + 5);

      // Expired free-tier drops
      insertDrop(db, { id: 'expired-1', tier: 'free', expiresAt: expiredDate });
      insertDrop(db, { id: 'expired-2', tier: 'free', expiresAt: expiredDate });

      // Active free-tier drop
      insertDrop(db, { id: 'active-1', tier: 'free', expiresAt: activeDate });

      // Expired deep-tier drop (should NOT be found)
      insertDrop(db, { id: 'deep-expired', tier: 'deep', expiresAt: expiredDate });
    });

    afterEach(() => cleanup());

    it('should find only expired free-tier drops', async () => {
      const cutoff = calculatePruneCutoff(0);
      const ids = await findExpiredFreeDropIds(db, cutoff);
      expect(ids).toContain('expired-1');
      expect(ids).toContain('expired-2');
      expect(ids).not.toContain('active-1');
      expect(ids).not.toContain('deep-expired');
    });

    it('should count correctly', async () => {
      const cutoff = calculatePruneCutoff(0);
      const count = await countExpiredFreeDrops(db, cutoff);
      expect(count).toBe(2);
    });
  });

  describe('pruneDropBatch', () => {
    let db: D1Database;
    let cleanup: () => void;

    beforeEach(() => {
      const test = createTestDb();
      db = test.db;
      cleanup = test.cleanup;
    });

    afterEach(() => cleanup());

    it('should delete drops and their history, preserve audit logs', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10);

      insertDrop(db, { id: 'drop-a', expiresAt: expiredDate });
      insertDrop(db, { id: 'drop-b', expiresAt: expiredDate });
      insertDropHistory(db, 'drop-a', 1);
      insertDropHistory(db, 'drop-b', 1);
      insertAuditLog(db, 'drop-a', 'created');
      insertAuditLog(db, 'drop-b', 'created');

      const result = await pruneDropBatch(db, ['drop-a', 'drop-b']);
      expect(result.deleted).toBe(2);

      // Drops deleted
      expect(await countDrops(db)).toBe(0);

      // History deleted
      expect(await countHistory(db)).toBe(0);

      // Audit log preserved
      expect(await countAuditLog(db)).toBe(2);
    });

    it('should handle empty batch', async () => {
      const result = await pruneDropBatch(db, []);
      expect(result.deleted).toBe(0);
    });
  });

  describe('executePrune', () => {
    let db: D1Database;
    let cleanup: () => void;

    beforeEach(() => {
      const test = createTestDb();
      db = test.db;
      cleanup = test.cleanup;
    });

    afterEach(() => cleanup());

    it('should prune expired free drops, keep everything else', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10);

      const activeDate = new Date();
      activeDate.setDate(activeDate.getDate() + 5);

      // 3 expired free drops
      insertDrop(db, { id: 'expired-1', tier: 'free', expiresAt: expiredDate });
      insertDrop(db, { id: 'expired-2', tier: 'free', expiresAt: expiredDate });
      insertDrop(db, { id: 'expired-3', tier: 'free', expiresAt: expiredDate });

      // 1 active free drop
      insertDrop(db, { id: 'active-1', tier: 'free', expiresAt: activeDate });

      // 1 expired deep drop
      insertDrop(db, { id: 'deep-1', tier: 'deep', expiresAt: expiredDate });

      const result = await executePrune(db, 0);
      expect(result.prunedCount).toBe(3);
      expect(await countDrops(db)).toBe(2); // active-1 + deep-1
    });

    it('should be idempotent', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10);

      insertDrop(db, { id: 'expired-1', tier: 'free', expiresAt: expiredDate });

      const result1 = await executePrune(db, 0);
      expect(result1.prunedCount).toBe(1);

      const result2 = await executePrune(db, 0);
      expect(result2.prunedCount).toBe(0);
    });

    it('should handle empty database', async () => {
      const result = await executePrune(db, 0);
      expect(result.prunedCount).toBe(0);
      expect(result.batches).toBe(0);
    });

    it('should respect tolerance days', async () => {
      // Drop expired 8 days ago (within tolerance of +1)
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const nineDaysAgo = new Date();
      nineDaysAgo.setDate(nineDaysAgo.getDate() - 9);

      // Expired 8 days ago — NOT pruned with tolerance=1 (cutoff = 8 days ago)
      insertDrop(db, { id: 'tolerance-1', tier: 'free', expiresAt: eightDaysAgo });

      // Expired 9 days ago — IS pruned with tolerance=1 (cutoff = 8 days ago)
      insertDrop(db, { id: 'old-1', tier: 'free', expiresAt: nineDaysAgo });

      const result = await executePrune(db, 1);
      expect(result.prunedCount).toBe(1);
      expect(await countDrops(db)).toBe(1);
    });
  });
});
