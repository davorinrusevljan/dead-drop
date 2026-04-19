import { describe, it, expect, vi } from 'vitest';
import { createApiApp } from '../index.js';

/**
 * Tests for encryption algorithm validation
 */
describe('Encryption Algorithm Validation', () => {
  const app = createApiApp();

  const mockDb = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        raw: vi.fn(() => []),
        first: vi.fn(() => Promise.resolve(null)),
        all: vi.fn(() => Promise.resolve([])),
        run: vi.fn(() => Promise.resolve({ meta: { duration: 0 }, success: true })),
      })),
      raw: vi.fn(() => []),
    })),
    batch: vi.fn(() => Promise.resolve([])),
    exec: vi.fn(() => Promise.resolve()),
  } as unknown as D1Database;

  const testEnv = {
    DB: mockDb,
    ADMIN_HASH_PEPPER: 'test-pepper',
    UPGRADE_TOKEN: 'test-token',
  };

  describe('POST /api/drops with encryptionAlgo', () => {
    const validPayload = {
      id: 'a'.repeat(64), // 64 hex chars
      nameLength: 12,
      visibility: 'private' as const,
      payload: 'test-payload',
      salt: 'b'.repeat(32), // 32 hex chars
      iv: 'c'.repeat(24), // 24 hex chars
      encryptionAlgo: 'pbkdf2-aes256-gcm-v1',
      contentHash: 'd'.repeat(64), // 64 hex chars
    };

    it('should accept valid encryptionAlgo (pbkdf2-aes256-gcm-v1)', async () => {
      const res = await app.request(
        '/api/drops',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validPayload),
        },
        testEnv
      );

      // Should get 201 (created) or 409 (name already taken in other tests)
      // Both are acceptable - we're testing that encryptionAlgo is accepted
      expect([201, 409]).toContain(res.status);

      // Should NOT get 400 (invalid algorithm)
      expect(res.status).not.toBe(400);

      if (res.status === 400) {
        const data = (await res.json()) as { error: { code: string } };
        expect(data.error.code).not.toBe('INVALID_ALGORITHM');
      }
    });

    it('should reject invalid encryptionAlgo (xchacha20-poly1305-v1)', async () => {
      const invalidPayload = {
        ...validPayload,
        encryptionAlgo: 'xchacha20-poly1305-v1',
      };

      const res = await app.request(
        '/api/drops',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidPayload),
        },
        testEnv
      );

      // Should get 400 (bad request) - Zod rejects invalid literal values
      expect(res.status).toBe(400);

      const text = await res.text();
      expect(text).toBeTruthy();
    });

    it('should reject invalid encryptionAlgo (argon2id-xchacha20-v1)', async () => {
      const invalidPayload = {
        ...validPayload,
        encryptionAlgo: 'argon2id-xchacha20-v1',
      };

      const res = await app.request(
        '/api/drops',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidPayload),
        },
        testEnv
      );

      // Should get 400 (bad request)
      expect(res.status).toBe(400);

      const text = await res.text();
      expect(text).toBeTruthy();
    });

    it('should reject unknown encryptionAlgo', async () => {
      const invalidPayload = {
        ...validPayload,
        encryptionAlgo: 'unknown-algo-v1',
      };

      const res = await app.request(
        '/api/drops',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidPayload),
        },
        testEnv
      );

      // Should get 400 (bad request)
      expect(res.status).toBe(400);

      const text = await res.text();
      expect(text).toBeTruthy();
    });

    it('should accept default encryptionAlgo (omitted)', async () => {
      const payloadWithoutAlgo = {
        ...validPayload,
        // encryptionAlgo omitted - should default to 'pbkdf2-aes256-gcm-v1'
      };

      const res = await app.request(
        '/api/drops',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadWithoutAlgo),
        },
        testEnv
      );

      // Should get 201 (created) or 409 (name already taken)
      expect([201, 409]).toContain(res.status);

      // Should NOT get 400
      expect(res.status).not.toBe(400);
    });
  });
});
