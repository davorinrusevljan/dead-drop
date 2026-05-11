/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

/**
 * Mock R2Bucket for testing
 */
function createMockR2Bucket() {
  const store = new Map<string, { body: ArrayBuffer; metadata?: Record<string, string> }>();

  return {
    _store: store,
    put: vi.fn(
      async (
        key: string,
        body: ArrayBuffer,
        options?: { customMetadata?: Record<string, string> }
      ) => {
        store.set(key, { body, metadata: options?.customMetadata });
        return {};
      }
    ),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
      return {};
    }),
    list: vi.fn(async () => ({ objects: [] })),
    head: vi.fn(async (key: string) => store.get(key) ?? null),
  } as unknown as R2Bucket & {
    _store: Map<string, { body: ArrayBuffer; metadata?: Record<string, string> }>;
  };
}

/**
 * Create test environment
 */
function createTestEnv() {
  const schemaPath = join(__dirname, '../../../schema.sql');
  const adminDbPath = join(tmpdir(), `test-admin-backup-route-${randomUUID()}.db`);
  const coreDbPath = join(tmpdir(), `test-core-backup-route-${randomUUID()}.db`);

  const adminDb = createLocalD1Database(adminDbPath, schemaPath);
  const coreDb = createLocalD1Database(coreDbPath);
  const r2Bucket = createMockR2Bucket();

  // Seed admin user (id=1, superadmin)
  const jwtSecret = 'test-jwt-secret-minimum-32-characters-long!!';
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

  return {
    env: {
      ADMIN_DB: adminDb,
      CORE_DB: coreDb,
      JWT_SECRET: jwtSecret,
      BACKUP_BUCKET: r2Bucket,
      CLOUDFLARE_API_TOKEN: 'test-cf-token',
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      CLOUDFLARE_CORE_DB_ID: 'test-db-uuid',
    },
    adminDbPath,
    coreDbPath,
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

describe('backup routes', () => {
  let app: ReturnType<typeof createAdminApiApp>;
  let testEnv: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    app = createAdminApiApp();
    testEnv = createTestEnv();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  /**
   * Helper: get auth cookie for a user
   */
  async function getAuthCookie(userId: number, role: 'admin' | 'superadmin'): Promise<string> {
    const token = await signAdminJwt({ userId, role }, testEnv.env.JWT_SECRET);
    return `admin_auth_token=${token}`;
  }

  describe('POST /api/maintenance/backup/start', () => {
    it('should require authentication', async () => {
      const res = await app.request(
        new Request('http://localhost/api/maintenance/backup/start', { method: 'POST' }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(401);
    });

    it('should require superadmin role', async () => {
      const cookie = await getAuthCookie(2, 'admin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/backup/start', {
          method: 'POST',
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(403);
    });

    it('should reject when CF API credentials not configured', async () => {
      const cookie = await getAuthCookie(1, 'superadmin');
      const noCredEnv = {
        ...testEnv.env,
        CLOUDFLARE_API_TOKEN: '',
        CLOUDFLARE_ACCOUNT_ID: '',
        CLOUDFLARE_CORE_DB_ID: '',
      };
      const res = await app.request(
        new Request('http://localhost/api/maintenance/backup/start', {
          method: 'POST',
          headers: { Cookie: cookie },
        }),
        {},
        noCredEnv
      );
      expect(res.status).toBe(503);
      const body = (await res.json()) as Record<string, any>;
      expect(body.error.code).toBe('BACKUP_NOT_CONFIGURED');
    });
  });

  describe('GET /api/maintenance/backup', () => {
    it('should require authentication', async () => {
      const res = await app.request(
        new Request('http://localhost/api/maintenance/backup'),
        {},
        testEnv.env
      );
      expect(res.status).toBe(401);
    });

    it('should require superadmin role', async () => {
      const cookie = await getAuthCookie(2, 'admin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/backup', {
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(403);
    });

    it('should return empty backups list', async () => {
      const cookie = await getAuthCookie(1, 'superadmin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/backup', {
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, any>;
      expect(body.backups).toEqual([]);
    });
  });

  describe('GET /api/maintenance/backup/:id', () => {
    it('should return 404 for non-existent backup', async () => {
      const cookie = await getAuthCookie(1, 'superadmin');
      const res = await app.request(
        new Request('http://localhost/api/maintenance/backup/9999', {
          headers: { Cookie: cookie },
        }),
        {},
        testEnv.env
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, any>;
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
