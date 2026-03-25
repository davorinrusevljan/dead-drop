import { describe, it, expect } from 'vitest';
import {
  encryptionAlgorithmSchema,
  pbkdf2Aes256GcmParamsSchema,
  xchacha20Poly1305ParamsSchema,
  argon2idXchacha20ParamsSchema,
  getDefaultAlgorithm,
  isAlgorithmSupported,
  validateParams,
  getIVLength,
  getSaltLength,
  type EncryptionAlgorithm,
} from './algorithms.js';

describe('algorithms', () => {
  describe('encryptionAlgorithmSchema', () => {
    it('should accept valid algorithm identifiers', () => {
      expect(encryptionAlgorithmSchema.parse('pbkdf2-aes256-gcm-v1')).toBe('pbkdf2-aes256-gcm-v1');
      expect(encryptionAlgorithmSchema.parse('xchacha20-poly1305-v1')).toBe(
        'xchacha20-poly1305-v1'
      );
      expect(encryptionAlgorithmSchema.parse('argon2id-xchacha20-v1')).toBe(
        'argon2id-xchacha20-v1'
      );
    });

    it('should reject invalid algorithm identifiers', () => {
      expect(() => encryptionAlgorithmSchema.parse('invalid-algo')).toThrow();
      expect(() => encryptionAlgorithmSchema.parse('')).toThrow();
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

  describe('xchacha20Poly1305ParamsSchema', () => {
    it('should accept empty params', () => {
      expect(xchacha20Poly1305ParamsSchema.parse({})).toEqual({});
    });

    it('should strip unknown params', () => {
      // Unknown properties are stripped by default in Zod
      const result = xchacha20Poly1305ParamsSchema.parse({ reserved: true });
      expect(result).toEqual({});
    });
  });

  describe('argon2idXchacha20ParamsSchema', () => {
    it('should accept empty params', () => {
      expect(argon2idXchacha20ParamsSchema.parse({})).toEqual({});
    });

    it('should accept valid memory param', () => {
      expect(argon2idXchacha20ParamsSchema.parse({ memory: 65536 })).toEqual({
        memory: 65536,
      });
    });

    it('should accept valid time param', () => {
      expect(argon2idXchacha20ParamsSchema.parse({ time: 3 })).toEqual({
        time: 3,
      });
    });

    it('should accept valid parallelism param', () => {
      expect(argon2idXchacha20ParamsSchema.parse({ parallelism: 4 })).toEqual({
        parallelism: 4,
      });
    });

    it('should reject invalid params', () => {
      expect(() => argon2idXchacha20ParamsSchema.parse({ memory: 0 })).toThrow();
      expect(() => argon2idXchacha20ParamsSchema.parse({ time: -1 })).toThrow();
    });
  });

  describe('getDefaultAlgorithm', () => {
    it('should return the default algorithm', () => {
      expect(getDefaultAlgorithm()).toBe('pbkdf2-aes256-gcm-v1');
    });
  });

  describe('isAlgorithmSupported', () => {
    it('should return true for supported algorithms', () => {
      expect(isAlgorithmSupported('pbkdf2-aes256-gcm-v1')).toBe(true);
      expect(isAlgorithmSupported('xchacha20-poly1305-v1')).toBe(true);
      expect(isAlgorithmSupported('argon2id-xchacha20-v1')).toBe(true);
    });

    it('should return false for unsupported algorithms', () => {
      expect(isAlgorithmSupported('invalid')).toBe(false);
      expect(isAlgorithmSupported('')).toBe(false);
      expect(isAlgorithmSupported('PBKDF2-AES256-GCM-V1')).toBe(false);
    });
  });

  describe('validateParams', () => {
    it('should validate pbkdf2-aes256-gcm-v1 params', () => {
      expect(validateParams('pbkdf2-aes256-gcm-v1', {})).toEqual({ valid: true });
      expect(validateParams('pbkdf2-aes256-gcm-v1', { iterations: 100000 })).toEqual({
        valid: true,
      });
      expect(validateParams('pbkdf2-aes256-gcm-v1', { iterations: 0 })).toEqual({
        valid: false,
        error: 'Invalid PBKDF2-AES256-GCM parameters',
      });
    });

    it('should validate xchacha20-poly1305-v1 params', () => {
      expect(validateParams('xchacha20-poly1305-v1', {})).toEqual({ valid: true });
    });

    it('should validate argon2id-xchacha20-v1 params', () => {
      expect(validateParams('argon2id-xchacha20-v1', {})).toEqual({ valid: true });
      expect(validateParams('argon2id-xchacha20-v1', { memory: 65536 })).toEqual({
        valid: true,
      });
    });
  });

  describe('getIVLength', () => {
    it('should return 12 for pbkdf2-aes256-gcm-v1', () => {
      expect(getIVLength('pbkdf2-aes256-gcm-v1')).toBe(12);
    });

    it('should return 24 for xchacha20-poly1305-v1', () => {
      expect(getIVLength('xchacha20-poly1305-v1')).toBe(24);
    });

    it('should return 24 for argon2id-xchacha20-v1', () => {
      expect(getIVLength('argon2id-xchacha20-v1')).toBe(24);
    });
  });

  describe('getSaltLength', () => {
    it('should return 16 for all algorithms', () => {
      expect(getSaltLength('pbkdf2-aes256-gcm-v1')).toBe(16);
      expect(getSaltLength('xchacha20-poly1305-v1')).toBe(16);
      expect(getSaltLength('argon2id-xchacha20-v1')).toBe(16);
    });
  });
});
