import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generatePasswordSalt, simpleHash } from './password.js';

describe('Password Utilities', () => {
  describe('generatePasswordSalt', () => {
    it('should generate a 32-character hex string', () => {
      const salt = generatePasswordSalt();
      expect(salt).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(salt)).toBe(true);
    });

    it('should generate unique salts', () => {
      const salt1 = generatePasswordSalt();
      const salt2 = generatePasswordSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const salt = generatePasswordSalt();
      const hash = await hashPassword('password123', salt);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce consistent hashes for same password and salt', async () => {
      const salt = generatePasswordSalt();
      const hash1 = await hashPassword('password123', salt);
      const hash2 = await hashPassword('password123', salt);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different passwords', async () => {
      const salt = generatePasswordSalt();
      const hash1 = await hashPassword('password123', salt);
      const hash2 = await hashPassword('password456', salt);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different salts', async () => {
      const salt1 = generatePasswordSalt();
      const salt2 = generatePasswordSalt();
      const hash1 = await hashPassword('password123', salt1);
      const hash2 = await hashPassword('password123', salt2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const salt = generatePasswordSalt();
      const hash = await hashPassword('password123', salt);
      const result = await verifyPassword('password123', salt, hash);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const salt = generatePasswordSalt();
      const hash = await hashPassword('password123', salt);
      const result = await verifyPassword('wrongpassword', salt, hash);
      expect(result).toBe(false);
    });

    it('should return false for wrong salt', async () => {
      const salt1 = generatePasswordSalt();
      const salt2 = generatePasswordSalt();
      const hash = await hashPassword('password123', salt1);
      const result = await verifyPassword('password123', salt2, hash);
      expect(result).toBe(false);
    });
  });

  describe('simpleHash', () => {
    it('should produce a hash', async () => {
      const hash = await simpleHash('password', 'salt');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      // PBKDF2 with 256 bits produces 44 base64 chars
      expect(hash).toHaveLength(44);
    });

    it('should be deterministic', async () => {
      const hash1 = await simpleHash('password', 'salt');
      const hash2 = await simpleHash('password', 'salt');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await simpleHash('password1', 'salt');
      const hash2 = await simpleHash('password2', 'salt');
      expect(hash1).not.toBe(hash2);
    });
  });
});
