import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApiApp } from '../index.js';
import { createLocalD1Database, type D1Database } from '@dead-drop/engine/dev/d1-adapter';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TERMS = 'I_agree_with_terms_and_conditions=true';

interface ErrorResponse {
  error: { code: string; message: string };
}

interface HistoryListResponse {
  versions: { version: number; createdAt: string }[];
  current: number;
  maxVersions: number;
}

interface HistoryVersionResponse {
  version: number;
  payload: string;
  iv: string | null;
  createdAt: string;
}

/**
 * Expiry enforcement on the history endpoints (#8).
 *
 * Before the fix, both handlers checked only drop existence, so expired drops
 * stayed readable (every version) until a manual prune removed the row.
 * The main drop endpoints already 404 on expiry — history must match.
 */
describe('History endpoints - expiry enforcement', () => {
  const app = createApiApp();
  let db: D1Database;
  let dbPath: string;

  const ACTIVE_ID = 'a'.repeat(64);
  const EXPIRED_ID = 'b'.repeat(64);
  const MISSING_ID = 'c'.repeat(64);

  const env = {
    DB: undefined as unknown as D1Database,
    ADMIN_HASH_PEPPER: 'test-pepper',
    UPGRADE_TOKEN: 'test-token',
  };

  beforeAll(() => {
    const schemaPath = join(__dirname, '../../../schema.sql');
    dbPath = join(tmpdir(), `test-history-expiry-${randomUUID()}.db`);
    db = createLocalD1Database(dbPath, schemaPath);
    env.DB = db;

    const nowSec = Math.floor(Date.now() / 1000);
    const hour = 3600;

    // Active drop: version 2 (current) + version 1 archived
    db.prepare(
      `INSERT INTO drops (id, version, data, visibility, salt, iv, admin_hash, tier, expires_at, created_at)
       VALUES (?, 2, 'current-payload', 'private', ?, ?, 'admin-hash', 'free', ?, ?)`
    )
      .bind(ACTIVE_ID, 'd'.repeat(32), 'e'.repeat(24), nowSec + hour, nowSec - 2 * hour)
      .run();
    db.prepare(
      `INSERT INTO drop_history (drop_id, version, data, iv, encryption_algo, mime_type, created_at)
       VALUES (?, 1, 'archived-payload', ?, 'pbkdf2-aes256-gcm-v1', 'text/plain', ?)`
    )
      .bind(ACTIVE_ID, 'f'.repeat(24), nowSec - hour)
      .run();

    // Expired drop: expiry passed an hour ago; version 2 current + version 1 archived
    db.prepare(
      `INSERT INTO drops (id, version, data, visibility, salt, iv, admin_hash, tier, expires_at, created_at)
       VALUES (?, 2, 'expired-current', 'private', ?, ?, 'admin-hash', 'free', ?, ?)`
    )
      .bind(EXPIRED_ID, 'd'.repeat(32), 'e'.repeat(24), nowSec - hour, nowSec - 2 * hour)
      .run();
    db.prepare(
      `INSERT INTO drop_history (drop_id, version, data, iv, encryption_algo, mime_type, created_at)
       VALUES (?, 1, 'expired-archived', ?, 'pbkdf2-aes256-gcm-v1', 'text/plain', ?)`
    )
      .bind(EXPIRED_ID, 'f'.repeat(24), nowSec - hour)
      .run();
  });

  afterAll(() => {
    try {
      if (dbPath && existsSync(dbPath)) unlinkSync(dbPath);
    } catch {
      // best-effort cleanup of the temp sqlite file
    }
  });

  describe('GET /api/v1/drops/{id}/history (list)', () => {
    it('returns 200 with all versions for an active drop', async () => {
      const res = await app.request(`/api/v1/drops/${ACTIVE_ID}/history?${TERMS}`, {}, env);
      expect(res.status).toBe(200);

      const data = (await res.json()) as HistoryListResponse;
      expect(data.current).toBe(2);
      expect(data.maxVersions).toBe(5);
      expect(data.versions.map((v) => v.version).sort()).toEqual([1, 2]);
    });

    it('returns 404 for an expired drop', async () => {
      const res = await app.request(`/api/v1/drops/${EXPIRED_ID}/history?${TERMS}`, {}, env);
      expect(res.status).toBe(404);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for a nonexistent drop', async () => {
      const res = await app.request(`/api/v1/drops/${MISSING_ID}/history?${TERMS}`, {}, env);
      expect(res.status).toBe(404);
    });

    it('returns 403 when terms are not agreed', async () => {
      const res = await app.request(`/api/v1/drops/${ACTIVE_ID}/history`, {}, env);
      expect(res.status).toBe(403);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error.code).toBe('TERMS_NOT_AGREED');
    });
  });

  describe('GET /api/v1/drops/{id}/history/{version}', () => {
    it('returns 200 for the current version of an active drop', async () => {
      const res = await app.request(`/api/v1/drops/${ACTIVE_ID}/history/2?${TERMS}`, {}, env);
      expect(res.status).toBe(200);

      const data = (await res.json()) as HistoryVersionResponse;
      expect(data.version).toBe(2);
      expect(data.payload).toBe('current-payload');
    });

    it('returns 200 for an archived version of an active drop', async () => {
      const res = await app.request(`/api/v1/drops/${ACTIVE_ID}/history/1?${TERMS}`, {}, env);
      expect(res.status).toBe(200);

      const data = (await res.json()) as HistoryVersionResponse;
      expect(data.version).toBe(1);
      expect(data.payload).toBe('archived-payload');
    });

    it('returns 404 for the current version of an expired drop', async () => {
      const res = await app.request(`/api/v1/drops/${EXPIRED_ID}/history/2?${TERMS}`, {}, env);
      expect(res.status).toBe(404);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for an archived version of an expired drop', async () => {
      // The archived path must be blocked too — expiry must gate the whole drop
      const res = await app.request(`/api/v1/drops/${EXPIRED_ID}/history/1?${TERMS}`, {}, env);
      expect(res.status).toBe(404);
    });

    it('returns 404 for a nonexistent drop', async () => {
      const res = await app.request(`/api/v1/drops/${MISSING_ID}/history/1?${TERMS}`, {}, env);
      expect(res.status).toBe(404);
    });

    it('returns 404 for a version that does not exist', async () => {
      const res = await app.request(`/api/v1/drops/${ACTIVE_ID}/history/99?${TERMS}`, {}, env);
      expect(res.status).toBe(404);
    });

    it('returns 403 when terms are not agreed', async () => {
      const res = await app.request(`/api/v1/drops/${ACTIVE_ID}/history/1`, {}, env);
      expect(res.status).toBe(403);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error.code).toBe('TERMS_NOT_AGREED');
    });
  });
});
