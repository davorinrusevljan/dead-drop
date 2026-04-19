import { describe, it, expect } from 'vitest';
import {
  encryptionAlgorithmSchema,
  pbkdf2Aes256GcmParamsSchema,
  getDefaultAlgorithm,
  isAlgorithmSupported,
  validateParams,
  getIVLength,
  getSaltLength,
  type EncryptionAlgorithm,
} from './algorithms.js';

describe('algorithms', () => {
  describe('encryptionAlgorithmSchema', () => {
    it('should accept the v1.0 algorithm identifier', () => {
      expect(encryptionAlgorithmSchema.parse('pbkdf2-aes256-gcm-v1')).toBe('pbkdf2-aes256-gcm-v1');
    });

    it('should reject invalid algorithm identifiers', () => {
      expect(() => encryptionAlgorithmSchema.parse('invalid-algo')).toThrow();
      expect(() => encryptionAlgorithmSchema.parse('')).toThrow();
      expect(() => encryptionAlgorithmSchema.parse('xchacha20-poly1305-v1')).toThrow();
      expect(() => encryptionAlgorithmSchema.parse('argon2id-xchacha20-v1')).toThrow();
      expect(() => encryptionAlgorithmSchema.parse('PBKDF2-AES256-GCM-V1')).toThrow();
    });
  });

  describe('pbkdf2Aes256GcmParamsSchema', () => {
    it('should accept empty params', () => {
      expect(pbkdf2Aes256GcmParamsSchema.parse({})).toEqual({});
    });

    it('should accept valid iterations', () => {
      expect(pbkdf2Aes256GcmParamsSchema.parse({ iterations: 100000 })).toEqual({
        iterations: 100000,
      });
      expect(pbkdf2Aes256GcmParamsSchema.parse({ iterations: 1 })).toEqual({
        iterations: 1,
      });
    });

    it('should reject invalid iterations', () => {
      expect(() => pbkdf2Aes256GcmParamsSchema.parse({ iterations: 0 })).toThrow();
      expect(() => pbkdf2Aes256GcmParamsSchema.parse({ iterations: -1 })).toThrow();
      expect(() => pbkdf2Aes256GcmParamsSchema.parse({ iterations: 1.5 })).toThrow();
    });
  });

  describe('getDefaultAlgorithm', () => {
    it('should return the default algorithm', () => {
      expect(getDefaultAlgorithm()).toBe('pbkdf2-aes256-gcm-v1');
    });
  });

  describe('isAlgorithmSupported', () => {
    it('should return true for the supported algorithm', () => {
      expect(isAlgorithmSupported('pbkdf2-aes256-gcm-v1')).toBe(true);
    });

    it('should return false for unsupported algorithms', () => {
      expect(isAlgorithmSupported('xchacha20-poly1305-v1')).toBe(false);
      expect(isAlgorithmSupported('argon2id-xchacha20-v1')).toBe(false);
      expect(isAlgorithmSupported('invalid')).toBe(false);
      expect(isAlgorithmSupported('')).toBe(false);
      expect(isAlgorithmSupported('PBKDF2-AES256-GCM-V1')).toBe(false);
    });
  });

  describe('validateParams', () => {
    it('should validate valid pbkdf2-aes256-gcm-v1 params', () => {
      expect(validateParams('pbkdf2-aes256-gcm-v1', {})).toEqual({ valid: true });
      expect(validateParams('pbkdf2-aes256-gcm-v1', { iterations: 100000 })).toEqual({
        valid: true,
      });
    });

    it('should reject invalid pbkdf2-aes256-gcm-v1 params', () => {
      expect(validateParams('pbkdf2-aes256-gcm-v1', { iterations: 0 })).toEqual({
        valid: false,
        error: 'Invalid PBKDF2-AES256-GCM parameters',
      });
    });
  });

  describe('getIVLength', () => {
    it('should return 12 for pbkdf2-aes256-gcm-v1', () => {
      expect(getIVLength('pbkdf2-aes256-gcm-v1')).toBe(12);
    });
  });

  describe('getSaltLength', () => {
    it('should return 16 for the supported algorithm', () => {
      expect(getSaltLength('pbkdf2-aes256-gcm-v1')).toBe(16);
    });
  });
});
