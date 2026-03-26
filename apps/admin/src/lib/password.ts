import { sha256, generateSalt } from '@dead-drop/engine';

/**
 * Hash a password using SHA-256
 * Uses salt to prevent rainbow table attacks
 * Returns hex-encoded hash
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256(password + salt);
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
