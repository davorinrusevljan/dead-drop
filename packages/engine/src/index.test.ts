import { describe, it, expect } from 'vitest';
import {
  sanitizeDropPhrase,
  validateDropPhrase,
  dropPhraseSchema,
  dropPhraseSchemaWithMin,
  FORBIDDEN_SLUGS,
  textPayloadSchema,
  filePayloadSchema,
  dropContentPayloadSchema,
  dropVisibilitySchema,
  dropTierSchema,
  paymentStatusSchema,
  auditActionSchema,
  isTextPayload,
  isFilePayload,
  generateRandomBytes,
  bytesToHex,
  hexToBytes,
  generateSalt,
  generateIV,
  sha256,
  deriveKey,
  encrypt,
  decrypt,
  computeProtectedAdminHash,
  computePublicAdminHash,
  computeDropId,
} from './index.js';
import { drops, dropHistory, dropAuditLog } from './db/index.js';

describe('index.ts exports', () => {
  describe('validation exports', () => {
    it('should export sanitizeDropPhrase', () => {
      expect(sanitizeDropPhrase).toBeInstanceOf(Function);
      expect(sanitizeDropPhrase('  HELLO  ')).toBe('hello');
    });

    it('should export validateDropPhrase', () => {
      expect(validateDropPhrase).toBeInstanceOf(Function);
      expect(validateDropPhrase('valid-phrase').valid).toBe(true);
    });

    it('should export dropPhraseSchema', () => {
      expect(dropPhraseSchema).toBeDefined();
    });

    it('should export dropPhraseSchemaWithMin', () => {
      expect(dropPhraseSchemaWithMin).toBeInstanceOf(Function);
    });

    it('should export FORBIDDEN_SLUGS', () => {
      expect(FORBIDDEN_SLUGS).toBeInstanceOf(Array);
      expect(FORBIDDEN_SLUGS).toContain('api');
    });
  });

  describe('types exports', () => {
    it('should export textPayloadSchema', () => {
      expect(textPayloadSchema).toBeDefined();
    });

    it('should export filePayloadSchema', () => {
      expect(filePayloadSchema).toBeDefined();
    });

    it('should export dropContentPayloadSchema', () => {
      expect(dropContentPayloadSchema).toBeDefined();
    });

    it('should export dropVisibilitySchema', () => {
      expect(dropVisibilitySchema).toBeDefined();
    });

    it('should export dropTierSchema', () => {
      expect(dropTierSchema).toBeDefined();
    });

    it('should export paymentStatusSchema', () => {
      expect(paymentStatusSchema).toBeDefined();
    });

    it('should export auditActionSchema', () => {
      expect(auditActionSchema).toBeDefined();
    });

    it('should export isTextPayload', () => {
      expect(isTextPayload).toBeInstanceOf(Function);
    });

    it('should export isFilePayload', () => {
      expect(isFilePayload).toBeInstanceOf(Function);
    });
  });

  describe('crypto exports', () => {
    it('should export generateRandomBytes', () => {
      expect(generateRandomBytes).toBeInstanceOf(Function);
    });

    it('should export bytesToHex', () => {
      expect(bytesToHex).toBeInstanceOf(Function);
    });

    it('should export hexToBytes', () => {
      expect(hexToBytes).toBeInstanceOf(Function);
    });

    it('should export generateSalt', () => {
      expect(generateSalt).toBeInstanceOf(Function);
    });

    it('should export generateIV', () => {
      expect(generateIV).toBeInstanceOf(Function);
    });

    it('should export sha256', () => {
      expect(sha256).toBeInstanceOf(Function);
    });

    it('should export deriveKey', () => {
      expect(deriveKey).toBeInstanceOf(Function);
    });

    it('should export encrypt', () => {
      expect(encrypt).toBeInstanceOf(Function);
    });

    it('should export decrypt', () => {
      expect(decrypt).toBeInstanceOf(Function);
    });

    it('should export computeProtectedAdminHash', () => {
      expect(computeProtectedAdminHash).toBeInstanceOf(Function);
    });

    it('should export computePublicAdminHash', () => {
      expect(computePublicAdminHash).toBeInstanceOf(Function);
    });

    it('should export computeDropId', () => {
      expect(computeDropId).toBeInstanceOf(Function);
    });
  });

  describe('db exports', () => {
    it('should export drops table', () => {
      expect(drops).toBeDefined();
    });

    it('should export dropHistory table', () => {
      expect(dropHistory).toBeDefined();
    });

    it('should export dropAuditLog table', () => {
      expect(dropAuditLog).toBeDefined();
    });
  });
});
