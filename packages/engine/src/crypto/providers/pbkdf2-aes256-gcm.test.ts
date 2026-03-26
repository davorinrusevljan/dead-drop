import { describe, it, expect } from 'vitest';
import { Pbkdf2Aes256GcmProvider, createPbkdf2Aes256GcmProvider } from './pbkdf2-aes256-gcm.js';

describe('Pbkdf2Aes256GcmProvider', () => {
  const provider = new Pbkdf2Aes256GcmProvider();

  describe('algorithm', () => {
    it('should return the correct algorithm identifier', () => {
      expect(provider.algorithm).toBe('pbkdf2-aes256-gcm-v1');
    });
  });

  describe('generateSalt', () => {
    it('should generate a 32-character hex string (16 bytes)', () => {
      const salt = provider.generateSalt();
      expect(salt).toHaveLength(32);
      expect(/^[0-9a-f]+$/.test(salt)).toBe(true);
    });

    it('should generate different salts', () => {
      const salt1 = provider.generateSalt();
      const salt2 = provider.generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('generateIV', () => {
    it('should generate a 24-character hex string (12 bytes)', () => {
      const iv = provider.generateIV();
      expect(iv).toHaveLength(24);
      expect(/^[0-9a-f]+$/.test(iv)).toBe(true);
    });

    it('should generate different IVs', () => {
      const iv1 = provider.generateIV();
      const iv2 = provider.generateIV();
      expect(iv1).not.toBe(iv2);
    });
  });

  describe('deriveKey', () => {
    it('should derive a valid CryptoKey', async () => {
      const salt = provider.generateSalt();
      const key = await provider.deriveKey('password', salt);
      expect(key).toBeInstanceOf(CryptoKey);
      expect(key.type).toBe('secret');
      expect(key.extractable).toBe(false);
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    });

    it('should derive the same key for same password and salt', async () => {
      const salt = provider.generateSalt();
      const key1 = await provider.deriveKey('password', salt);
      const key2 = await provider.deriveKey('password', salt);

      // Encrypt with one key, decrypt with another to verify they're the same
      const iv = provider.generateIV();
      const data = 'test data';
      const encrypted = await provider.encrypt(data, key1, iv);
      const decrypted = await provider.decrypt(encrypted, key2, iv);
      expect(decrypted).toBe(data);
    });

    it('should derive different keys for different passwords', async () => {
      const salt = provider.generateSalt();
      const key1 = await provider.deriveKey('password1', salt);
      const key2 = await provider.deriveKey('password2', salt);

      // Verify keys are different by attempting decryption
      const iv = provider.generateIV();
      const data = 'test data';
      const encrypted = await provider.encrypt(data, key1, iv);

      await expect(provider.decrypt(encrypted, key2, iv)).rejects.toThrow();
    });

    it('should derive different keys for different salts', async () => {
      const salt1 = provider.generateSalt();
      const salt2 = provider.generateSalt();
      const key1 = await provider.deriveKey('password', salt1);
      const key2 = await provider.deriveKey('password', salt2);

      // Verify keys are different by attempting decryption
      const iv = provider.generateIV();
      const data = 'test data';
      const encrypted = await provider.encrypt(data, key1, iv);

      await expect(provider.decrypt(encrypted, key2, iv)).rejects.toThrow();
    });

    it('should accept custom iterations via params', async () => {
      const salt = provider.generateSalt();
      // This should not throw
      const key = await provider.deriveKey('password', salt, { iterations: 50000 });
      expect(key).toBeInstanceOf(CryptoKey);
    });

    it('should use default iterations when empty object params provided', async () => {
      const salt = provider.generateSalt();
      // Pass empty object - should use default iterations (nullish coalescing branch)
      const key = await provider.deriveKey('password', salt, {});
      expect(key).toBeInstanceOf(CryptoKey);
    });

    it('should fall back to default iterations for invalid params', async () => {
      const salt = provider.generateSalt();
      // Pass invalid params - should fall back to default iterations
      const key = await provider.deriveKey('password', salt, { iterations: 0 });
      expect(key).toBeInstanceOf(CryptoKey);
    });

    it('should fall back to default iterations for non-integer params', async () => {
      const salt = provider.generateSalt();
      // Pass invalid params type - should fall back to default iterations
      const key = await provider.deriveKey('password', salt, { iterations: 1.5 });
      expect(key).toBeInstanceOf(CryptoKey);
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const salt = provider.generateSalt();
      const iv = provider.generateIV();
      const key = await provider.deriveKey('password', salt);
      const data = 'Hello, World!';

      const encrypted = await provider.encrypt(data, key, iv);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(data);

      const decrypted = await provider.decrypt(encrypted, key, iv);
      expect(decrypted).toBe(data);
    });

    it('should produce different ciphertexts for different IVs', async () => {
      const salt = provider.generateSalt();
      const key = await provider.deriveKey('password', salt);
      const data = 'Hello, World!';

      const encrypted1 = await provider.encrypt(data, key, provider.generateIV());
      const encrypted2 = await provider.encrypt(data, key, provider.generateIV());

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', async () => {
      const salt = provider.generateSalt();
      const iv = provider.generateIV();
      const key = await provider.deriveKey('password', salt);
      const data = '';

      const encrypted = await provider.encrypt(data, key, iv);
      const decrypted = await provider.decrypt(encrypted, key, iv);
      expect(decrypted).toBe(data);
    });

    it('should handle unicode characters', async () => {
      const salt = provider.generateSalt();
      const iv = provider.generateIV();
      const key = await provider.deriveKey('password', salt);
      const data = 'Hello, 世界! 🌍🎉';

      const encrypted = await provider.encrypt(data, key, iv);
      const decrypted = await provider.decrypt(encrypted, key, iv);
      expect(decrypted).toBe(data);
    });

    it('should handle long strings', async () => {
      const salt = provider.generateSalt();
      const iv = provider.generateIV();
      const key = await provider.deriveKey('password', salt);
      const data = 'a'.repeat(10000);

      const encrypted = await provider.encrypt(data, key, iv);
      const decrypted = await provider.decrypt(encrypted, key, iv);
      expect(decrypted).toBe(data);
    });

    it('should fail decryption with wrong key', async () => {
      const salt = provider.generateSalt();
      const iv = provider.generateIV();
      const key1 = await provider.deriveKey('password1', salt);
      const key2 = await provider.deriveKey('password2', salt);
      const data = 'Hello, World!';

      const encrypted = await provider.encrypt(data, key1, iv);
      await expect(provider.decrypt(encrypted, key2, iv)).rejects.toThrow();
    });

    it('should fail decryption with wrong IV', async () => {
      const salt = provider.generateSalt();
      const key = await provider.deriveKey('password', salt);
      const data = 'Hello, World!';

      const encrypted = await provider.encrypt(data, key, provider.generateIV());
      const wrongIv = provider.generateIV();
      await expect(provider.decrypt(encrypted, key, wrongIv)).rejects.toThrow();
    });
  });
});

describe('createPbkdf2Aes256GcmProvider', () => {
  it('should create a new provider instance', () => {
    const provider = createPbkdf2Aes256GcmProvider();
    expect(provider).toBeInstanceOf(Pbkdf2Aes256GcmProvider);
    expect(provider.algorithm).toBe('pbkdf2-aes256-gcm-v1');
  });
});
