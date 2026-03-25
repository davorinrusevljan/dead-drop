/**
 * Legacy exports for backward compatibility
 * Re-exports functions from the original crypto.ts module
 *
 * These functions use the default PBKDF2-AES256-GCM algorithm
 */

import { cryptoRegistry } from './provider.js';
import { createPbkdf2Aes256GcmProvider } from './providers/pbkdf2-aes256-gcm.js';

// Ensure default provider is registered
if (!cryptoRegistry.has('pbkdf2-aes256-gcm-v1')) {
  cryptoRegistry.register(createPbkdf2Aes256GcmProvider());
}

// Get the default provider
const defaultProvider = cryptoRegistry.get('pbkdf2-aes256-gcm-v1');

/**
 * Helper functions for hash computation (shared across providers)
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Convert bytes to hex string
 */
export { bytesToHex };

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

/**
 * Generate a random salt (16 bytes)
 * @deprecated Use cryptoRegistry.get(algorithm).generateSalt() instead
 */
export function generateSalt(): string {
  return defaultProvider.generateSalt();
}

/**
 * Generate a random IV (12 bytes for AES-GCM)
 * @deprecated Use cryptoRegistry.get(algorithm).generateIV() instead
 */
export function generateIV(): string {
  return defaultProvider.generateIV();
}

/**
 * Compute SHA-256 hash of a string
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Derive an encryption key from a password using PBKDF2
 * @param password - The password to derive from
 * @param salt - Hex-encoded salt (16 bytes)
 * @returns CryptoKey for AES-GCM encryption
 * @deprecated Use cryptoRegistry.get(algorithm).deriveKey() instead
 */
export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  return defaultProvider.deriveKey(password, salt);
}

/**
 * Encrypt data using AES-GCM
 * @param data - Plaintext data to encrypt
 * @param key - CryptoKey for encryption
 * @param iv - Hex-encoded IV (12 bytes)
 * @returns Hex-encoded ciphertext
 * @deprecated Use cryptoRegistry.get(algorithm).encrypt() instead
 */
export async function encrypt(data: string, key: CryptoKey, iv: string): Promise<string> {
  return defaultProvider.encrypt(data, key, iv);
}

/**
 * Decrypt data using AES-GCM
 * @param ciphertext - Hex-encoded ciphertext
 * @param key - CryptoKey for decryption
 * @param iv - Hex-encoded IV (12 bytes)
 * @returns Decrypted plaintext
 * @deprecated Use cryptoRegistry.get(algorithm).decrypt() instead
 */
export async function decrypt(ciphertext: string, key: CryptoKey, iv: string): Promise<string> {
  return defaultProvider.decrypt(ciphertext, key, iv);
}

/**
 * Compute admin hash for private drops
 * Uses server-side pepper: SHA-256(contentHash + PEPPER)
 * @param contentHash - SHA-256 hash of the content payload
 * @param pepper - Server-side secret pepper
 */
export async function computePrivateAdminHash(
  contentHash: string,
  pepper: string
): Promise<string> {
  return sha256(contentHash + pepper);
}

/**
 * Compute admin hash for public drops
 * SHA-256(adminPassword + salt)
 * @param adminPassword - The admin password
 * @param salt - Hex-encoded salt
 */
export async function computePublicAdminHash(adminPassword: string, salt: string): Promise<string> {
  return sha256(adminPassword + salt);
}

/**
 * Compute drop ID from normalized name
 * SHA-256(normalizedName)
 */
export async function computeDropId(name: string): Promise<string> {
  return sha256(name);
}

// Re-export types and registry for new code
export { cryptoRegistry } from './provider.js';
export { getDefaultAlgorithm } from './algorithms.js';
