import type { EncryptionAlgorithm, EncryptionParams } from './algorithms.js';

/**
 * CryptoProvider interface - must be implemented by all encryption algorithms
 */
export interface CryptoProvider {
  /** Algorithm identifier */
  readonly algorithm: EncryptionAlgorithm;

  /** Generate a random salt (hex-encoded) */
  generateSalt(): string;

  /** Generate a random IV/nonce (hex-encoded) */
  generateIV(): string;

  /** Derive an encryption key from a password */
  deriveKey(password: string, salt: string, params?: EncryptionParams): Promise<CryptoKey>;

  /** Encrypt data and return hex-encoded ciphertext */
  encrypt(data: string, key: CryptoKey, iv: string): Promise<string>;

  /** Decrypt hex-encoded ciphertext and return plaintext */
  decrypt(ciphertext: string, key: CryptoKey, iv: string): Promise<string>;
}

/**
 * Crypto provider registry
 * Maps algorithm identifiers to their implementations
 */
class CryptoRegistry {
  private providers: Map<EncryptionAlgorithm, CryptoProvider> = new Map();

  /**
   * Register a crypto provider
   */
  register(provider: CryptoProvider): void {
    this.providers.set(provider.algorithm, provider);
  }

  /**
   * Get a crypto provider by algorithm identifier
   * Throws if algorithm is not registered
   */
  get(algorithm: EncryptionAlgorithm): CryptoProvider {
    const provider = this.providers.get(algorithm);
    if (!provider) {
      throw new Error(`Crypto provider not found for algorithm: ${algorithm}`);
    }
    return provider;
  }

  /**
   * Check if an algorithm has a registered provider
   */
  has(algorithm: EncryptionAlgorithm): boolean {
    return this.providers.has(algorithm);
  }

  /**
   * Get all registered algorithm identifiers
   */
  getAlgorithms(): EncryptionAlgorithm[] {
    return Array.from(this.providers.keys());
  }
}

/**
 * Global crypto provider registry instance
 */
export const cryptoRegistry = new CryptoRegistry();
