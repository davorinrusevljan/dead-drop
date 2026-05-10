import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAdminApiApp } from '../index.js';
import { createLocalD1Database, type D1Database } from '@dead-drop/engine/dev/d1-adapter';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { signAdminJwt } from '../../lib/jwt.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createMockR2Bucket() {
  const store = new Map<string, { body: ArrayBuffer }>();
  return {
    _store: store,
    put: async (key: string, body: ArrayBuffer) => {
      store.set(key, { body });
      return {};
    },
    get: async (key: string) => store.get(key) ?? null,
    delete: async () => ({}),
    list: async () => ({ objects: [] }),
    head: async () => null,
  } as unknown as R2Bucket;
}

function createTestEnv() {
  const schemaPath = join(__dirname, '../../../schema.sql');
  const adminDbPath = join(tmpdir(), `test-admin-prune-route-${randomUUID()}.db`);
  const coreDbPath = join(tmpdir(), `test-core-prune-route-${randomUUID()}.db`);

  const adminDb = createLocalD1Database(adminDbPath, schemaPath);
  const coreDb = createLocalD1Database(coreDbPath);
  const r2Bucket = createMockR2Bucket();

  const jwtSecret = 'test-jwt-secret-minimum-32-characters-long!!';

  // Seed admin users
  adminDb
    .prepare(
      "INSERT INTO admin_users (username, password_hash, salt, role) VALUES ('superadmin', 'hash', 'salt', 'superadmin')"
    )
    .bind()
    .run();
  adminDb
    .prepare(
      "INSERT INTO admin_users (username, password_hash, salt, role) VALUES ('regularadmin', 'hash', 'salt', 'admin')"
    )
    .bind()
    .run();

  // Create core DB schema
  coreDb.exec(`
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
    env: {
      ADMIN_DB: adminDb,
      CORE_DB: coreDb,
      JWT_SECRET: jwtSecret,
      BACKUP_BUCKET: r2Bucket,
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
      CLOUDFLARE_CORE_DB_ID: 'test-db-id',
    },
    adminDbPath,
    coreDbPath,
    adminDb,
    coreDb,
    cleanup: () => {
      try {
        adminDb.close();
        coreDb.close();
        if (existsSync(adminDbPath)) unlinkSync(adminDbPath);
        if (existsSync(coreDbPath)) unlinkSync(coreDbPath);
      } catch {
        // Ignore
      }
    },
  };
}

describe('prune routes', () => {
  let app: ReturnType<typeof createAdminApiApp>;
  let testEnv: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    app = createAdminApiApp();
    testEnv = createTestEnv();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  async function getAuthCookie(userId: number, role: 'admin' | 'superadmin'): Promise<string> {
    const token = await signAdminJwt({ userId, role }, testEnv.env.JWT_SECRET);
    return `admin_auth_token=${token}`;
  }

  function seedExpiredDrop(id: string, daysExpired: number = 10) {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - daysExpired);
    testEnv.coreDb
      .prepare(
        `INSERT INTO drops (id, tier, expires_at, visibility, salt, admin_hash) VALUES (?, 'free', ?, 'private', 'salt', 'hash')`
      )
      .bind(id, Math.floor(expiredDate.getTime() / 1000))
      .run();
  }

  function seedActiveDrop(id: string) {
    const activeDate = new Date();
    activeDate.setDate(activeDate.getDate() + 5);
    testEnv.coreDb
      .prepare(
        `INSERT INTO drops (id, tier, expires_at, visibility, salt, admin_hash) VALUES (?, 'free', ?, 'private', 'salt', 'hash')`
      )
      .bind(id, Math.floor(activeDate.getTime() / 1000))
      .run();
  }

  describe('GET /api/maintenance/prune/preview', () => {
    it('should require authentication', async () => {
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune/preview'),
        {},
        testEnv.env
      );
      expect(res.status).toBe(401);
    });

    it('should require superadmin role', async () => {
      const cookie = await getAuthCookie(2, 'admin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune/preview', {
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(403);
    });

    it('should return eligible count', async () => {
      seedExpiredDrop('expired-1');
      seedExpiredDrop('expired-2');
      seedActiveDrop('active-1');

      const cookie = await getAuthCookie(1, 'superadmin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune/preview', {
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.eligibleCount).toBe(2);
    });

    it('should warn about no backup', async () => {
      seedExpiredDrop('expired-1');

      const cookie = await getAuthCookie(1, 'superadmin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune/preview', {
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.backupWarning).toContain('No successful backup');
    });

    it('should reject invalid toleranceDays', async () => {
      const cookie = await getAuthCookie(1, 'superadmin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune/preview?toleranceDays=5', {
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/maintenance/prune', () => {
    it('should require authentication', async () => {
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune', { method: 'POST' }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(401);
    });

    it('should require superadmin role', async () => {
      const cookie = await getAuthCookie(2, 'admin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune', {
          method: 'POST',
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(403);
    });

    it('should prune expired drops', async () => {
      seedExpiredDrop('expired-1');
      seedExpiredDrop('expired-2');
      seedActiveDrop('active-1');

      const cookie = await getAuthCookie(1, 'superadmin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune', {
          method: 'POST',
          headers: { Cookie: cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ toleranceDays: 0 }),
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.prunedCount).toBe(2);
      expect(body.status).toBe('complete');
    });

    it('should handle empty prune (nothing expired)', async () => {
      seedActiveDrop('active-1');

      const cookie = await getAuthCookie(1, 'superadmin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune', {
          method: 'POST',
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.prunedCount).toBe(0);
    });

    it('should reject invalid toleranceDays in body', async () => {
      const cookie = await getAuthCookie(1, 'superadmin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune', {
          method: 'POST',
          headers: { Cookie: cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ toleranceDays: 5 }),
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/maintenance/prune/history', () => {
    it('should return history after prune', async () => {
      seedExpiredDrop('expired-1');

      const cookie = await getAuthCookie(1, 'superadmin');

      // Execute prune
      await app.request(
        new Request('http://localhost/api/maintenance/prune', {
          method: 'POST',
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );

      // Get history
      const res = await app.request(
        new Request('http://localhost/api/maintenance/prune/history', {
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.prunes.length).toBe(1);
      expect(body.prunes[0].status).toBe('complete');
      expect(body.prunes[0].prunedCount).toBe(1);
    });
  });
});
