/**
 * End-to-end test simulating the full private drop edit flow.
 * This test verifies the fix for the "invalid password on second edit" bug.
 *
 * FIX STRATEGY:
 * - Client sends BOTH the OLD content hash (for auth) AND the NEW content hash
 * - Server verifies using OLD hash, then updates adminHash to NEW hash
 * - Client updates its stored hash to NEW hash after successful edit
 * - This allows multiple edits from different tabs/sessions
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

    /** Update a drop - verifies with old hash, stores new hash */
    async updateDrop(
      id: string,
      newPayload: string,
      newIv: string | null,
      oldContentHash: string,
      newContentHash?: string
    ): Promise<{ success: boolean; status: number; error?: string }> {
      const drop = db.get(id);
      if (!drop) {
        return { success: false, status: 404, error: 'Not found' };
      }

      // Verify auth - compute hash from provided OLD contentHash
      const providedHash = await computePrivateAdminHash(oldContentHash, pepper);

      if (providedHash !== drop.adminHash) {
        return { success: false, status: 401, error: 'Invalid credentials' };
      }

      // Compute new adminHash from the NEW content hash
      const newAdminHash = newContentHash
        ? await computePrivateAdminHash(newContentHash, pepper)
        : drop.adminHash;

      // Update the drop with the NEW adminHash
      db.set(id, {
        ...drop,
        data: newPayload,
        iv: newIv,
        adminHash: newAdminHash,
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
    // Content hash stored for authentication
    contentHash: null as string | null,
    password: null as string | null,
    salt: null as string | null,

    /** Called when unlocking a private drop */
    setUnlockData(password: string, salt: string) {
      this.password = password;
      this.salt = salt;
    },

    /** Get the current content hash for authentication */
    async getContentHash(): Promise<string | null> {
      return this.contentHash;
    },

    /** Initialize content hash from content */
    async initContentHash(contentJson: string) {
      this.contentHash = await sha256(contentJson);
    },

    /** Update content hash after successful edit */
    async updateContentHash(newContentJson: string) {
      this.contentHash = await sha256(newContentJson);
    },
  };
}

describe('Private Drop Edit Flow - E2E Test', () => {
  const pepper = 'test-server-pepper';

  it('verifies multiple edits work correctly', async () => {
    const server = createMockServer(pepper);
    const client = createMockClient();

    // === STEP 1: Create drop ===
    const dropName = 'test-drop-multiple-edits';
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

    client.setUnlockData(password, salt);
    await client.initContentHash(originalJson);

    // === STEP 2: First edit ===
    const edit1Content = { type: 'text' as const, content: 'first edit' };
    const edit1Json = JSON.stringify(edit1Content);
    const edit1Hash = await sha256(edit1Json);
    const iv1 = generateIV();
    const encryptedPayload1 = await encrypt(edit1Json, key, iv1);

    const authHash1 = await client.getContentHash();
    const result1 = await server.updateDrop(dropId, encryptedPayload1, iv1, authHash1!, edit1Hash);

    expect(result1.success).toBe(true);
    expect(result1.status).toBe(200);

    // Update client's stored hash to the NEW content hash
    await client.updateContentHash(edit1Json);

    // === STEP 3: Second edit - should succeed ===
    const edit2Content = { type: 'text' as const, content: 'second edit' };
    const edit2Json = JSON.stringify(edit2Content);
    const edit2Hash = await sha256(edit2Json);
    const iv2 = generateIV();
    const encryptedPayload2 = await encrypt(edit2Json, key, iv2);

    const authHash2 = await client.getContentHash();
    const result2 = await server.updateDrop(dropId, encryptedPayload2, iv2, authHash2!, edit2Hash);

    expect(result2.success).toBe(true);
    expect(result2.status).toBe(200);

    // Update client's stored hash
    await client.updateContentHash(edit2Json);

    // === STEP 4: Third edit - also should succeed ===
    const edit3Content = { type: 'text' as const, content: 'third edit' };
    const edit3Json = JSON.stringify(edit3Content);
    const edit3Hash = await sha256(edit3Json);
    const iv3 = generateIV();
    const encryptedPayload3 = await encrypt(edit3Json, key, iv3);

    const authHash3 = await client.getContentHash();
    const result3 = await server.updateDrop(dropId, encryptedPayload3, iv3, authHash3!, edit3Hash);

    expect(result3.success).toBe(true);
    expect(result3.status).toBe(200);

    // Verify final content can be decrypted
    const drop = server.getDrop(dropId);
    expect(drop).toBeDefined();
    const decrypted = await decrypt(drop!.data, key, drop!.iv!);
    expect(JSON.parse(decrypted)).toEqual(edit3Content);
  });

  it('simulates different tabs/sessions editing the same drop', async () => {
    const server = createMockServer(pepper);
    const client1 = createMockClient(); // Tab 1
    const client2 = createMockClient(); // Tab 2

    // === STEP 1: Create drop ===
    const dropName = 'test-drop-multi-tab';
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

    // === STEP 2: Tab 1 unlocks and edits ===
    client1.setUnlockData(password, salt);
    await client1.initContentHash(originalJson);

    const edit1Content = { type: 'text' as const, content: 'tab1 edit' };
    const edit1Json = JSON.stringify(edit1Content);
    const edit1Hash = await sha256(edit1Json);
    const iv1 = generateIV();
    const encryptedPayload1 = await encrypt(edit1Json, key, iv1);

    const authHash1 = await client1.getContentHash();
    const result1 = await server.updateDrop(dropId, encryptedPayload1, iv1, authHash1!, edit1Hash);
    expect(result1.success).toBe(true);

    // Update Tab 1's stored hash
    await client1.updateContentHash(edit1Json);

    // === STEP 3: Tab 2 unlocks (from server) and edits ===
    // Tab 2 gets the current content from server (edit1Content)
    client2.setUnlockData(password, salt);
    await client2.initContentHash(edit1Json); // Initialize with CURRENT content

    const edit2Content = { type: 'text' as const, content: 'tab2 edit' };
    const edit2Json = JSON.stringify(edit2Content);
    const edit2Hash = await sha256(edit2Json);
    const iv2 = generateIV();
    const encryptedPayload2 = await encrypt(edit2Json, key, iv2);

    const authHash2 = await client2.getContentHash();
    const result2 = await server.updateDrop(dropId, encryptedPayload2, iv2, authHash2!, edit2Hash);
    expect(result2.success).toBe(true);

    // Update Tab 2's stored hash
    await client2.updateContentHash(edit2Json);

    // === STEP 4: Tab 1 tries to edit again (without refreshing) ===
    // Tab 1 still has the old hash (edit1Hash), but server now expects edit2Hash
    const edit3Content = { type: 'text' as const, content: 'tab1 second edit' };
    const edit3Json = JSON.stringify(edit3Content);
    const edit3Hash = await sha256(edit3Json);
    const iv3 = generateIV();
    const encryptedPayload3 = await encrypt(edit3Json, key, iv3);

    const authHash3 = await client1.getContentHash();
    const result3 = await server.updateDrop(dropId, encryptedPayload3, iv3, authHash3!, edit3Hash);

    // This will FAIL because Tab 1's hash is outdated
    expect(result3.success).toBe(false);
    expect(result3.status).toBe(401);
  });

  it('verifies that refreshing the page allows editing again', async () => {
    const server = createMockServer(pepper);
    const client = createMockClient();

    // === STEP 1: Create and edit once ===
    const dropName = 'test-drop-refresh';
    const password = 'secure-password-123';
    const normalizedName = normalizeDropName(dropName);
    const dropId = await computeDropId(normalizedName);
    const salt = generateSalt();

    const originalContent = { type: 'text' as const, content: 'original' };
    const originalJson = JSON.stringify(originalContent);
    const originalHash = await sha256(originalJson);

    const iv = generateIV();
    const key = await deriveKey(password, salt);
    const encryptedPayload = await encrypt(originalJson, key, iv);

    await server.createDrop(dropId, encryptedPayload, salt, iv, originalHash, 'private');

    client.setUnlockData(password, salt);
    await client.initContentHash(originalJson);

    // First edit
    const edit1Content = { type: 'text' as const, content: 'first edit' };
    const edit1Json = JSON.stringify(edit1Content);
    const edit1Hash = await sha256(edit1Json);
    const iv1 = generateIV();
    const encryptedPayload1 = await encrypt(edit1Json, key, iv1);

    const result1 = await server.updateDrop(
      dropId,
      encryptedPayload1,
      iv1,
      (await client.getContentHash())!,
      edit1Hash
    );
    expect(result1.success).toBe(true);
    await client.updateContentHash(edit1Json);

    // === STEP 2: Simulate page refresh - re-unlock with current content ===
    // After refresh, the client would fetch the drop and decrypt it
    // The contentHash would be computed from the CURRENT content
    await client.initContentHash(edit1Json); // Re-init with current content

    // Second edit after "refresh"
    const edit2Content = { type: 'text' as const, content: 'second edit after refresh' };
    const edit2Json = JSON.stringify(edit2Content);
    const edit2Hash = await sha256(edit2Json);
    const iv2 = generateIV();
    const encryptedPayload2 = await encrypt(edit2Json, key, iv2);

    const result2 = await server.updateDrop(
      dropId,
      encryptedPayload2,
      iv2,
      (await client.getContentHash())!,
      edit2Hash
    );
    expect(result2.success).toBe(true);
  });
});
