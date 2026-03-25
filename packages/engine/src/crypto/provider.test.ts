import { describe, it, expect, beforeEach } from 'vitest';
import { cryptoRegistry } from './provider.js';
import { createPbkdf2Aes256GcmProvider } from './providers/pbkdf2-aes256-gcm.js';
import type { EncryptionAlgorithm } from './algorithms.js';

describe('cryptoRegistry', () => {
  beforeEach(() => {
    // Ensure pbkdf2-aes256-gcm-v1 is registered before each test
    if (!cryptoRegistry.has('pbkdf2-aes256-gcm-v1')) {
      cryptoRegistry.register(createPbkdf2Aes256GcmProvider());
    }
  });

  describe('get', () => {
    it('should return the registered provider', () => {
      const provider = cryptoRegistry.get('pbkdf2-aes256-gcm-v1');
      expect(provider).toBeDefined();
      expect(provider.algorithm).toBe('pbkdf2-aes256-gcm-v1');
    });

    it('should throw for unregistered algorithm', () => {
      expect(() => cryptoRegistry.get('xchacha20-poly1305-v1' as EncryptionAlgorithm)).toThrow(
        'Crypto provider not found for algorithm: xchacha20-poly1305-v1'
      );
    });
  });

  describe('has', () => {
    it('should return true for registered algorithm', () => {
      expect(cryptoRegistry.has('pbkdf2-aes256-gcm-v1')).toBe(true);
    });

    it('should return false for unregistered algorithm', () => {
      expect(cryptoRegistry.has('xchacha20-poly1305-v1' as EncryptionAlgorithm)).toBe(false);
    });
  });

  describe('getAlgorithms', () => {
    it('should return list of registered algorithms', () => {
      const algorithms = cryptoRegistry.getAlgorithms();
      expect(algorithms).toContain('pbkdf2-aes256-gcm-v1');
    });
  });

  describe('register', () => {
    it('should register a new provider', () => {
      // Create a mock provider for a future algorithm
      const mockProvider = {
        algorithm: 'mock-algo-v1' as EncryptionAlgorithm,
        generateSalt: () => 'salt',
        generateIV: () => 'iv',
        deriveKey: async () => ({}) as CryptoKey,
        encrypt: async () => 'encrypted',
        decrypt: async () => 'decrypted',
      };

      cryptoRegistry.register(mockProvider);
      expect(cryptoRegistry.has('mock-algo-v1' as EncryptionAlgorithm)).toBe(true);
      expect(cryptoRegistry.get('mock-algo-v1' as EncryptionAlgorithm)).toBe(mockProvider);
    });
  });
});
