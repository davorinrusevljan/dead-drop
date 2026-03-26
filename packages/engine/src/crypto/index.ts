/**
 * Crypto module exports
 *
 * This module provides a pluggable encryption system with algorithm registry.
 *
 * Usage:
 * ```typescript
 * // Legacy API (uses default algorithm)
 * import { generateSalt, deriveKey, encrypt, decrypt } from '@dead-drop/engine/crypto';
 *
 * // New API with algorithm selection
 * import { cryptoRegistry, getDefaultAlgorithm } from '@dead-drop/engine/crypto';
 * const provider = cryptoRegistry.get('pbkdf2-aes256-gcm-v1');
 * const key = await provider.deriveKey(password, salt);
 * ```
 */

// Algorithm types and utilities
export {
  type EncryptionAlgorithm,
  type EncryptionParams,
  encryptionAlgorithmSchema,
  pbkdf2Aes256GcmParamsSchema,
  xchacha20Poly1305ParamsSchema,
  argon2idXchacha20ParamsSchema,
  getDefaultAlgorithm,
  isAlgorithmSupported,
  validateParams,
  getIVLength,
  getSaltLength,
} from './algorithms.js';

// Provider interface and registry
export { type CryptoProvider, cryptoRegistry } from './provider.js';

// Legacy API (backward compatible) - export from original implementation
export {
  generateRandomBytes,
  bytesToHex,
  hexToBytes,
  generateSalt,
  generateIV,
  sha256,
  deriveKey,
  encrypt,
  decrypt,
  computePrivateAdminHash,
  computePublicAdminHash,
  computeDropId,
} from '../crypto.js';

// Provider implementations
export {
  Pbkdf2Aes256GcmProvider,
  createPbkdf2Aes256GcmProvider,
} from './providers/pbkdf2-aes256-gcm.js';

// Auto-register the default provider
import { cryptoRegistry } from './provider.js';
import { createPbkdf2Aes256GcmProvider } from './providers/pbkdf2-aes256-gcm.js';

cryptoRegistry.register(createPbkdf2Aes256GcmProvider());
