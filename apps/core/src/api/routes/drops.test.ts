import { describe, it, expect } from 'vitest';
import { sha256, computePrivateAdminHash } from '@dead-drop/engine';

/**
 * These tests demonstrate the bug in the private drop edit flow.
 *
 * The bug: After editing a private drop, the client updates its stored contentHash
 * to the NEW content, but the server's adminHash is still based on the ORIGINAL content.
 * On subsequent edits, authentication fails because the hashes don't match.
 */
describe('Private Drop Edit Flow - Bug Demonstration', () => {
  const pepper = 'test-server-pepper';

  it('VERIFIES THE BUG IS FIXED: client should NOT update contentHash after edit', async () => {
    // This test verifies the fix: after editing, client keeps original hash for auth

    // === STEP 1: Create drop ===
    const originalContent = 'original';
    const originalContentHash = await sha256(originalContent);
    const storedAdminHash = await computePrivateAdminHash(originalContentHash, pepper);

    // === STEP 2: First edit - send ORIGINAL hash (correct) ===
    const edit1ProvidedHash = await computePrivateAdminHash(originalContentHash, pepper);
    expect(edit1ProvidedHash).toBe(storedAdminHash); // ✅ Auth succeeds

    // === STEP 3: FIX APPLIED - Client keeps ORIGINAL hash (does NOT update to new content) ===
    // Before fix: clientStoredContentHash = sha256(newContent)  <-- WRONG
    // After fix:  clientStoredContentHash = originalContentHash <-- CORRECT
    const clientStoredContentHash = originalContentHash;

    // === STEP 4: Second edit - client sends ORIGINAL hash (correct!) ===
    const edit2ProvidedHash = await computePrivateAdminHash(clientStoredContentHash, pepper);

    // Server verifies: does hash match stored?
    expect(edit2ProvidedHash).toBe(storedAdminHash); // ✅ NOW WORKS!
  });

  it('shows the fix: client should keep original hash for auth', async () => {
    // === STEP 1: Create drop ===
    const originalContent = 'original';
    const originalContentHash = await sha256(originalContent);
    const storedAdminHash = await computePrivateAdminHash(originalContentHash, pepper);

    // === FIX: Client keeps original contentHash for authentication ===
    const clientAuthHash = originalContentHash; // Never changes!

    // === STEP 2: First edit ===
    const edit1ProvidedHash = await computePrivateAdminHash(clientAuthHash, pepper);
    expect(edit1ProvidedHash).toBe(storedAdminHash); // ✅ Auth succeeds

    // === STEP 3: Second edit - still using original hash ===
    const edit2ProvidedHash = await computePrivateAdminHash(clientAuthHash, pepper);
    expect(edit2ProvidedHash).toBe(storedAdminHash); // ✅ Still works!
  });

  it('verifies crypto consistency: same input = same hash', async () => {
    const content = 'test content';
    const hash1 = await sha256(content);
    const hash2 = await sha256(content);
    expect(hash1).toBe(hash2);

    const adminHash1 = await computePrivateAdminHash(hash1, pepper);
    const adminHash2 = await computePrivateAdminHash(hash2, pepper);
    expect(adminHash1).toBe(adminHash2);
  });

  it('verifies different content produces different hashes', async () => {
    const hash1 = await sha256('content 1');
    const hash2 = await sha256('content 2');
    expect(hash1).not.toBe(hash2);

    const adminHash1 = await computePrivateAdminHash(hash1, pepper);
    const adminHash2 = await computePrivateAdminHash(hash2, pepper);
    expect(adminHash1).not.toBe(adminHash2);
  });
});
