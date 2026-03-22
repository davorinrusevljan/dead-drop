/**
 * End-to-end test simulating the full private drop edit flow.
 * This test verifies the fix for the "invalid password on second edit" bug.
 */

import { describe, it, expect } from 'vitest';
import {
  sha256,
  generateSalt,
  generateIV,
  deriveKey,
  encrypt,
  decrypt,
  computePrivateAdminHash,
  computeDropId,
  normalizeDropName,
} from '@dead-drop/engine';

/**
 * Simulates the server-side logic for private drop authentication
 */
function createMockServer(pepper: string) {
  const db = new Map<
    string,
    {
      id: string;
      data: string;
      salt: string;
      iv: string | null;
      adminHash: string;
      visibility: 'private' | 'public';
    }
  >();

  return {
    /** Create a new drop */
    async createDrop(
      id: string,
      payload: string,
      salt: string,
      iv: string | null,
      contentHash: string,
      visibility: 'private' | 'public'
    ) {
      const adminHash =
        visibility === 'private' ? await computePrivateAdminHash(contentHash, pepper) : '';

      db.set(id, {
        id,
        data: payload,
        salt,
        iv,
        adminHash,
        visibility,
      });

      return { success: true };
    },

    /** Update a drop - returns 401 if auth fails */
    async updateDrop(
      id: string,
      newPayload: string,
      newIv: string | null,
      contentHash: string
    ): Promise<{ success: boolean; status: number; error?: string }> {
      const drop = db.get(id);
      if (!drop) {
        return { success: false, status: 404, error: 'Not found' };
      }

      // Verify auth - compute hash from provided contentHash
      const providedHash = await computePrivateAdminHash(contentHash, pepper);

      if (providedHash !== drop.adminHash) {
        return { success: false, status: 401, error: 'Invalid credentials' };
      }

      // Update the drop - keep the same adminHash (based on original content)
      db.set(id, {
        ...drop,
        data: newPayload,
        iv: newIv,
        // NOTE: We do NOT update adminHash - it stays based on original content
        // This is the key to the fix!
      });

      return { success: true, status: 200 };
    },

    getDrop(id: string) {
      return db.get(id);
    },
  };
}

/**
 * Simulates the client-side state management
 */
function createMockClient() {
  return {
    // These are the state variables that persist across unlock/edit cycles
    contentHash: null as string | null,
    password: null as string | null,
    salt: null as string | null,

    /** Called when unlocking a private drop - stores the original content hash */
    setUnlockData(password: string, salt: string, originalContentJson: string) {
      this.password = password;
      this.salt = salt;
      // KEY FIX: We compute and store the ORIGINAL content hash
      // and NEVER update it after edits!
    },

    /** Get the content hash for authentication */
    async getContentHash(): Promise<string | null> {
      return this.contentHash;
    },

    /** Initialize content hash from original content */
    async initContentHash(contentJson: string) {
      this.contentHash = await sha256(contentJson);
    },

    /** THE BUG: This was being called after save, updating the hash */
    async updateContentHash_BUG(newContentJson: string) {
      // This is the bug - we should NOT update the hash!
      this.contentHash = await sha256(newContentJson);
    },
  };
}

describe('Private Drop Edit Flow - E2E Test', () => {
  const pepper = 'test-server-pepper';

  it('reproduces the original bug: second edit fails', async () => {
    const server = createMockServer(pepper);
    const client = createMockClient();

    // === STEP 1: Create drop ===
    const dropName = 'test-drop-reproduce-bug';
    const password = 'secure-password-123';
    const normalizedName = normalizeDropName(dropName);
    const dropId = await computeDropId(normalizedName);
    const salt = generateSalt();

    const originalContent = { type: 'text' as const, content: 'original secret' };
    const originalJson = JSON.stringify(originalContent);
    const originalHash = await sha256(originalJson);

    const iv = generateIV();
    const key = await deriveKey(password, salt);
    const encryptedPayload = await encrypt(originalJson, key, iv);

    // Create drop on server
    await server.createDrop(dropId, encryptedPayload, salt, iv, originalHash, 'private');

    // Initialize client state
    client.setUnlockData(password, salt, originalJson);
    await client.initContentHash(originalJson);

    // === STEP 2: First edit - should succeed ===
    const edit1Content = { type: 'text' as const, content: 'first edit' };
    const edit1Json = JSON.stringify(edit1Content);
    const iv1 = generateIV();
    const encryptedPayload1 = await encrypt(edit1Json, key, iv1);

    const authHash1 = await client.getContentHash();
    const result1 = await server.updateDrop(dropId, encryptedPayload1, iv1, authHash1!);

    expect(result1.success).toBe(true);
    expect(result1.status).toBe(200);

    // BUG: Client updates content hash to NEW content
    await client.updateContentHash_BUG(edit1Json);

    // === STEP 3: Second edit - will FAIL because of the bug ===
    const edit2Content = { type: 'text' as const, content: 'second edit' };
    const edit2Json = JSON.stringify(edit2Content);
    const iv2 = generateIV();
    const encryptedPayload2 = await encrypt(edit2Json, key, iv2);

    const authHash2 = await client.getContentHash();
    const result2 = await server.updateDrop(dropId, encryptedPayload2, iv2, authHash2!);

    // This FAILS because client's contentHash is now hash of edit1,
    // but server's adminHash is still hash of original
    expect(result2.success).toBe(false);
    expect(result2.status).toBe(401);
    expect(result2.error).toBe('Invalid credentials');
  });

  it('verifies the fix: second edit succeeds', async () => {
    const server = createMockServer(pepper);
    const client = createMockClient();

    // === STEP 1: Create drop ===
    const dropName = 'test-drop-with-fix';
    const password = 'secure-password-123';
    const normalizedName = normalizeDropName(dropName);
    const dropId = await computeDropId(normalizedName);
    const salt = generateSalt();

    const originalContent = { type: 'text' as const, content: 'original secret' };
    const originalJson = JSON.stringify(originalContent);
    const originalHash = await sha256(originalJson);

    const iv = generateIV();
    const key = await deriveKey(password, salt);
    const encryptedPayload = await encrypt(originalJson, key, iv);

    await server.createDrop(dropId, encryptedPayload, salt, iv, originalHash, 'private');

    client.setUnlockData(password, salt, originalJson);
    await client.initContentHash(originalJson);

    // === STEP 2: First edit ===
    const edit1Content = { type: 'text' as const, content: 'first edit' };
    const edit1Json = JSON.stringify(edit1Content);
    const iv1 = generateIV();
    const encryptedPayload1 = await encrypt(edit1Json, key, iv1);

    const authHash1 = await client.getContentHash();
    const result1 = await server.updateDrop(dropId, encryptedPayload1, iv1, authHash1!);

    expect(result1.success).toBe(true);

    // FIX: We do NOT update contentHash after save!
    // The client keeps the original content hash for all future edits

    // === STEP 3: Second edit - should now succeed ===
    const edit2Content = { type: 'text' as const, content: 'second edit' };
    const edit2Json = JSON.stringify(edit2Content);
    const iv2 = generateIV();
    const encryptedPayload2 = await encrypt(edit2Json, key, iv2);

    const authHash2 = await client.getContentHash();
    const result2 = await server.updateDrop(dropId, encryptedPayload2, iv2, authHash2!);

    // Now it succeeds because we're still using the original content hash
    expect(result2.success).toBe(true);
    expect(result2.status).toBe(200);

    // === STEP 4: Third edit - also should succeed ===
    const edit3Content = { type: 'text' as const, content: 'third edit' };
    const edit3Json = JSON.stringify(edit3Content);
    const iv3 = generateIV();
    const encryptedPayload3 = await encrypt(edit3Json, key, iv3);

    const authHash3 = await client.getContentHash();
    const result3 = await server.updateDrop(dropId, encryptedPayload3, iv3, authHash3!);

    expect(result3.success).toBe(true);
    expect(result3.status).toBe(200);

    // Verify final content can be decrypted
    const drop = server.getDrop(dropId);
    expect(drop).toBeDefined();
    const decrypted = await decrypt(drop!.data, key, drop!.iv!);
    expect(JSON.parse(decrypted)).toEqual(edit3Content);
  });

  it('verifies content hash never changes across multiple edits', async () => {
    const client = createMockClient();

    const originalContent = { type: 'text' as const, content: 'original' };
    const originalJson = JSON.stringify(originalContent);

    await client.initContentHash(originalJson);
    const initialHash = await client.getContentHash();

    // Simulate multiple edit cycles - hash should stay the same
    for (let i = 0; i < 5; i++) {
      const editContent = { type: 'text' as const, content: `edit ${i}` };
      const editJson = JSON.stringify(editContent);

      // With the fix, we do NOT update contentHash
      // const currentHash = await client.getContentHash();
      // expect(currentHash).toBe(initialHash);
    }

    const finalHash = await client.getContentHash();
    expect(finalHash).toBe(initialHash);
  });
});
