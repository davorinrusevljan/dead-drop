import { z } from 'zod';

/**
 * Supported encryption algorithm identifier
 *
 * v1.0 only supports PBKDF2-AES256-GCM. Future versions may add more algorithms.
 */
export type EncryptionAlgorithm = 'pbkdf2-aes256-gcm-v1'; // PBKDF2 (100k iter) + AES-256-GCM

/**
 * Zod schema for encryption algorithm validation
 */
export const encryptionAlgorithmSchema = z.literal('pbkdf2-aes256-gcm-v1');

/**
 * Algorithm-specific parameters for PBKDF2-AES256-GCM
 */
export const pbkdf2Aes256GcmParamsSchema = z.object({
  /** Number of PBKDF2 iterations (default: 100000) */
  iterations: z.number().int().positive().optional(),
});

/**
 * Algorithm-specific parameters for PBKDF2-AES256-GCM
 */
export type EncryptionParams = z.infer<typeof pbkdf2Aes256GcmParamsSchema>;

/**
 * Get the default algorithm identifier
 */
export function getDefaultAlgorithm(): EncryptionAlgorithm {
  return 'pbkdf2-aes256-gcm-v1';
}

/**
 * Check if an algorithm is currently supported
 */
export function isAlgorithmSupported(algorithm: string): algorithm is EncryptionAlgorithm {
  return encryptionAlgorithmSchema.safeParse(algorithm).success;
}

/**
 * Validate algorithm-specific parameters
 */
export function validateParams(
  _algorithm: EncryptionAlgorithm,
  params: unknown
): { valid: boolean; error?: string } {
  return pbkdf2Aes256GcmParamsSchema.safeParse(params).success
    ? { valid: true }
    : { valid: false, error: 'Invalid PBKDF2-AES256-GCM parameters' };
}

/**
 * Get the IV length (in bytes) for the algorithm
 */
export function getIVLength(_algorithm: EncryptionAlgorithm): number {
  return 12; // 96 bits for AES-GCM
}

/**
 * Get the salt length (in bytes) for a given algorithm
 */
export function getSaltLength(_algorithm: EncryptionAlgorithm): number {
  // All current algorithms use 16-byte salts
  return 16;
}
