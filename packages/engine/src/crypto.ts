/**
 * Web Crypto API wrappers for dead-drop
 * Uses only native Web Crypto API - no Node.js crypto module
 */

/**
 * Generate random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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
 */
export function generateSalt(): string {
  return bytesToHex(generateRandomBytes(16));
}

/**
 * Generate a random IV (12 bytes for AES-GCM)
 */
export function generateIV(): string {
  return bytesToHex(generateRandomBytes(12));
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
 */
export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = hexToBytes(salt);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ]);

  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-GCM
 * @param data - Plaintext data to encrypt
 * @param key - CryptoKey for encryption
 * @param iv - Hex-encoded IV (12 bytes)
 * @returns Hex-encoded ciphertext
 */
export async function encrypt(data: string, key: CryptoKey, iv: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const ivBuffer = hexToBytes(iv);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    dataBuffer
  );

  return bytesToHex(new Uint8Array(encryptedBuffer));
}

/**
 * Decrypt data using AES-GCM
 * @param ciphertext - Hex-encoded ciphertext
 * @param key - CryptoKey for decryption
 * @param iv - Hex-encoded IV (12 bytes)
 * @returns Decrypted plaintext
 */
export async function decrypt(ciphertext: string, key: CryptoKey, iv: string): Promise<string> {
  const ciphertextBuffer = hexToBytes(ciphertext);
  const ivBuffer = hexToBytes(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Compute admin hash for protected drops
 * Uses server-side pepper: SHA-256(contentHash + PEPPER)
 * @param contentHash - SHA-256 hash of the content payload
 * @param pepper - Server-side secret pepper
 */
export async function computeProtectedAdminHash(
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
