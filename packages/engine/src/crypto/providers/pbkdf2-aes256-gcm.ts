import type { CryptoProvider } from '../provider.js';
import type { EncryptionAlgorithm, EncryptionParams } from '../algorithms.js';
import type { z } from 'zod';
import { pbkdf2Aes256GcmParamsSchema } from '../algorithms.js';

/**
 * Helper functions for byte manipulation
 */
function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

/**
 * PBKDF2-AES256-GCM crypto provider
 * Default algorithm: PBKDF2 with 100,000 iterations + AES-256-GCM
 */
export class Pbkdf2Aes256GcmProvider implements CryptoProvider {
  readonly algorithm: EncryptionAlgorithm = 'pbkdf2-aes256-gcm-v1';

  /** Default PBKDF2 iterations */
  private readonly defaultIterations = 100000;

  /** Salt length in bytes */
  private readonly saltLength = 16;

  /** IV length in bytes (96 bits for AES-GCM) */
  private readonly ivLength = 12;

  generateSalt(): string {
    return bytesToHex(generateRandomBytes(this.saltLength));
  }

  generateIV(): string {
    return bytesToHex(generateRandomBytes(this.ivLength));
  }

  async deriveKey(password: string, salt: string, params?: EncryptionParams): Promise<CryptoKey> {
    // Validate and extract params
    const iterations = this.getIterations(params);

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
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data: string, key: CryptoKey, iv: string): Promise<string> {
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

  async decrypt(ciphertext: string, key: CryptoKey, iv: string): Promise<string> {
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
   * Get iterations from params with validation
   */
  private getIterations(params?: EncryptionParams): number {
    if (!params) {
      return this.defaultIterations;
    }

    // Validate params structure
    const parsed = pbkdf2Aes256GcmParamsSchema.safeParse(params);
    if (!parsed.success) {
      return this.defaultIterations;
    }

    const typedParams = parsed.data as z.infer<typeof pbkdf2Aes256GcmParamsSchema>;
    return typedParams.iterations ?? this.defaultIterations;
  }
}

/**
 * Factory function to create a new PBKDF2-AES256-GCM provider
 */
export function createPbkdf2Aes256GcmProvider(): CryptoProvider {
  return new Pbkdf2Aes256GcmProvider();
}
