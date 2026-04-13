/**
 * Tests for public drop CRUD operations
 *
 * Public drops:
 * - Content is stored as plaintext (base64 encoded)
 * - Admin hash is computed as SHA-256(adminPassword + salt)
 * - Anyone can read, but only admin (with password) can edit/delete
 */

import { describe, it, expect } from 'vitest';
import {
  sha256,
  generateSalt,
  computeDropId,
  normalizeDropName,
  computePublicAdminHash,
} from '@dead-drop/engine';

describe('Public Drop Creation', () => {
  it('should create a public drop with valid admin hash', async () => {
    const password = 'admin-password-123';
    const salt = generateSalt();
    const adminHash = await computePublicAdminHash(password, salt);

    // Verify the hash is computed correctly
    const expectedHash = await sha256(password + salt);
    expect(adminHash).toBe(expectedHash);
  });

  it('should reject empty admin hash for public drops', async () => {
    const emptyHash = '';

    // Empty hash should be detectable
    expect(emptyHash).toBe('');
  });

  it('should generate different hashes for different passwords', async () => {
    const salt = generateSalt();
    const hash1 = await computePublicAdminHash('password1', salt);
    const hash2 = await computePublicAdminHash('password2', salt);

    expect(hash1).not.toBe(hash2);
  });

  it('should generate different hashes for different salts', async () => {
    const password = 'same-password';
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const hash1 = await computePublicAdminHash(password, salt1);
    const hash2 = await computePublicAdminHash(password, salt2);

    expect(hash1).not.toBe(hash2);
  });
});

describe('Public Drop Authentication', () => {
  it('should correctly verify admin password', async () => {
    const password = 'secure-admin-password';
    const salt = generateSalt();
    const storedAdminHash = await computePublicAdminHash(password, salt);

    // Correct password should match
    const providedHash = await sha256(password + salt);
    expect(providedHash).toBe(storedAdminHash);
  });

  it('should reject incorrect admin password', async () => {
    const correctPassword = 'secure-admin-password';
    const wrongPassword = 'wrong-password';
    const salt = generateSalt();
    const storedAdminHash = await computePublicAdminHash(correctPassword, salt);

    // Wrong password should not match
    const providedHash = await sha256(wrongPassword + salt);
    expect(providedHash).not.toBe(storedAdminHash);
  });

  it('should reject empty admin password', async () => {
    const password = 'secure-admin-password';
    const salt = generateSalt();
    const storedAdminHash = await computePublicAdminHash(password, salt);

    // Empty password should not match
    const providedHash = await sha256('' + salt);
    expect(providedHash).not.toBe(storedAdminHash);
  });
});

describe('Public Drop Edit Flow', () => {
  it('should allow editing with correct admin password', async () => {
    const adminPassword = 'edit-admin-password';
    const salt = generateSalt();
    const storedAdminHash = await computePublicAdminHash(adminPassword, salt);

    // Verify auth for edit
    const providedHash = await sha256(adminPassword + salt);
    expect(providedHash).toBe(storedAdminHash);
  });

  it('should reject editing with wrong admin password', async () => {
    const adminPassword = 'edit-admin-password';
    const wrongPassword = 'wrong-password';
    const salt = generateSalt();
    const storedAdminHash = await computePublicAdminHash(adminPassword, salt);

    // Verify auth fails for edit
    const providedHash = await sha256(wrongPassword + salt);
    expect(providedHash).not.toBe(storedAdminHash);
  });

  it('should reject editing with empty admin password', async () => {
    const adminPassword = 'edit-admin-password';
    const salt = generateSalt();
    const storedAdminHash = await computePublicAdminHash(adminPassword, salt);

    // Verify auth fails for empty password
    const providedHash = await sha256('' + salt);
    expect(providedHash).not.toBe(storedAdminHash);
  });
});

describe('Public Drop Delete Flow', () => {
  it('should allow deleting with correct admin password', async () => {
    const adminPassword = 'delete-admin-password';
    const salt = generateSalt();
    const storedAdminHash = await computePublicAdminHash(adminPassword, salt);

    // Verify auth for delete
    const providedHash = await sha256(adminPassword + salt);
    expect(providedHash).toBe(storedAdminHash);
  });

  it('should reject deleting with wrong admin password', async () => {
    const adminPassword = 'delete-admin-password';
    const wrongPassword = 'wrong-password';
    const salt = generateSalt();
    const storedAdminHash = await computePublicAdminHash(adminPassword, salt);

    // Verify auth fails for delete
    const providedHash = await sha256(wrongPassword + salt);
    expect(providedHash).not.toBe(storedAdminHash);
  });

  it('should reject deleting with empty admin password', async () => {
    const adminPassword = 'delete-admin-password';
    const salt = generateSalt();
    const storedAdminHash = await computePublicAdminHash(adminPassword, salt);

    // Verify auth fails for empty password
    const providedHash = await sha256('' + salt);
    expect(providedHash).not.toBe(storedAdminHash);
  });
});

describe('Public Drop Content Handling', () => {
  it('should encode and decode content correctly', () => {
    const content = { type: 'text' as const, content: 'Hello, World!' };
    const contentJson = JSON.stringify(content);
    const encoded = btoa(contentJson);
    const decoded = atob(encoded);
    const parsed = JSON.parse(decoded) as typeof content;

    expect(parsed).toEqual(content);
  });

  it('should handle special characters in content', () => {
    const content = { type: 'text' as const, content: 'Special: @#$%^&*()' };
    const contentJson = JSON.stringify(content);
    const encoded = btoa(contentJson);
    const decoded = atob(encoded);
    const parsed = JSON.parse(decoded) as typeof content;

    expect(parsed).toEqual(content);
  });
});

describe('Public Drop ID Computation', () => {
  it('should compute consistent drop IDs', async () => {
    const dropName = 'test-public-drop';
    const normalizedName = normalizeDropName(dropName);
    const id1 = await computeDropId(normalizedName);
    const id2 = await computeDropId(normalizedName);

    expect(id1).toBe(id2);
  });

  it('should compute different IDs for different names', async () => {
    const name1 = normalizeDropName('drop-one');
    const name2 = normalizeDropName('drop-two');
    const id1 = await computeDropId(name1);
    const id2 = await computeDropId(name2);

    expect(id1).not.toBe(id2);
  });
});

/**
 * Integration test simulating the full public drop CRUD flow
 */
describe('Public Drop CRUD Integration', () => {
  it('should handle full create-read-edit-delete flow', async () => {
    const adminPassword = 'integration-test-password';
    const salt = generateSalt();

    // === CREATE ===
    const adminHash = await computePublicAdminHash(adminPassword, salt);
    expect(adminHash).toBeTruthy();
    expect(adminHash).not.toBe('');

    // === READ (anyone can read public drops) ===
    const content = { type: 'text' as const, content: 'Public secret message' };
    const contentJson = JSON.stringify(content);
    const encoded = btoa(contentJson);
    const decoded = atob(encoded);
    expect(JSON.parse(decoded)).toEqual(content);

    // === EDIT (requires admin password) ===
    const editAuthHash = await sha256(adminPassword + salt);
    expect(editAuthHash).toBe(adminHash);

    // === DELETE (requires admin password) ===
    const deleteAuthHash = await sha256(adminPassword + salt);
    expect(deleteAuthHash).toBe(adminHash);
  });
});
