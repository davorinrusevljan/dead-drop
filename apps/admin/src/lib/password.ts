/**
 * * Password hashing using PBKDF2 (more secure than SHA-256)
 * * Uses 100,000 iterations for make brute force attacks expensive
 */

import { generateSalt } from '@dead-drop/engine';

/**
 * Hash a password using PBKDF2
 * * Returns base64-encoded hash
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  // Import key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  // Convert to base64
  const hashArray = new Uint8Array(derivedBits);
  return btoa(String.fromCharCode(...hashArray));
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await hashPassword(password, salt);
  return actualHash === expectedHash;
}

/**
 * Generate a new salt for password hashing
 */
export { generateSalt as generatePasswordSalt };

/**
 * Alias for hashPassword (for backwards compatibility)
 */
export const simpleHash = hashPassword;
