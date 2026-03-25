import { z } from 'zod';

/**
 * Supported encryption algorithm identifiers
 * Versioned to allow future algorithm upgrades while maintaining backward compatibility
 */
export type EncryptionAlgorithm =
  | 'pbkdf2-aes256-gcm-v1' // Current: PBKDF2 (100k iter) + AES-256-GCM
  | 'xchacha20-poly1305-v1' // Future: XChaCha20-Poly1305
  | 'argon2id-xchacha20-v1'; // Future: Argon2id KDF + XChaCha20-Poly1305

/**
 * Zod schema for encryption algorithm validation
 */
export const encryptionAlgorithmSchema = z.enum([
  'pbkdf2-aes256-gcm-v1',
  'xchacha20-poly1305-v1',
  'argon2id-xchacha20-v1',
]);

/**
 * Algorithm-specific parameters for PBKDF2-AES256-GCM
 */
export const pbkdf2Aes256GcmParamsSchema = z.object({
  /** Number of PBKDF2 iterations (default: 100000) */
  iterations: z.number().int().positive().optional(),
});

/**
 * Algorithm-specific parameters for XChaCha20-Poly1305 (future)
 */
export const xchacha20Poly1305ParamsSchema = z.object({
  /** Reserved for future use */
  _reserved: z.never().optional(),
});

/**
 * Algorithm-specific parameters for Argon2id-XChaCha20 (future)
 */
export const argon2idXchacha20ParamsSchema = z.object({
  /** Memory cost in KB */
  memory: z.number().int().positive().optional(),
  /** Time cost (iterations) */
  time: z.number().int().positive().optional(),
  /** Parallelism */
  parallelism: z.number().int().positive().optional(),
});

/**
 * Union type for all algorithm-specific parameters
 */
export type EncryptionParams =
  | z.infer<typeof pbkdf2Aes256GcmParamsSchema>
  | z.infer<typeof xchacha20Poly1305ParamsSchema>
  | z.infer<typeof argon2idXchacha20ParamsSchema>;

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
  algorithm: EncryptionAlgorithm,
  params: unknown
): { valid: boolean; error?: string } {
  switch (algorithm) {
    case 'pbkdf2-aes256-gcm-v1':
      return pbkdf2Aes256GcmParamsSchema.safeParse(params).success
        ? { valid: true }
        : { valid: false, error: 'Invalid PBKDF2-AES256-GCM parameters' };

    case 'xchacha20-poly1305-v1':
      return xchacha20Poly1305ParamsSchema.safeParse(params).success
        ? { valid: true }
        : { valid: false, error: 'Invalid XChaCha20-Poly1305 parameters' };

    case 'argon2id-xchacha20-v1':
      return argon2idXchacha20ParamsSchema.safeParse(params).success
        ? { valid: true }
        : { valid: false, error: 'Invalid Argon2id-XChaCha20 parameters' };

    default:
      return { valid: false, error: `Unknown algorithm: ${algorithm}` };
  }
}

/**
 * Get the IV length (in bytes) for a given algorithm
 */
export function getIVLength(algorithm: EncryptionAlgorithm): number {
  switch (algorithm) {
    case 'pbkdf2-aes256-gcm-v1':
      return 12; // 96 bits for AES-GCM
    case 'xchacha20-poly1305-v1':
    case 'argon2id-xchacha20-v1':
      return 24; // 192 bits for XChaCha20
    default:
      return 12;
  }
}

/**
 * Get the salt length (in bytes) for a given algorithm
 */
export function getSaltLength(_algorithm: EncryptionAlgorithm): number {
  // All current algorithms use 16-byte salts
  return 16;
}
