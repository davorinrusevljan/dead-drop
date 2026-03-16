import { describe, it, expect } from 'vitest';
import {
  determineStorage,
  generateR2Key,
  parseR2Key,
  shouldUseR2,
  STORAGE_LIMITS,
} from './storage';

describe('Storage Service', () => {
  describe('determineStorage', () => {
    describe('free tier', () => {
      it('should allow D1 storage for payloads <= 10KB', () => {
        const result = determineStorage(100, 'free');
        expect(result).toEqual({ location: 'd1', canStore: true });
      });

      it('should allow D1 storage for exactly 10KB', () => {
        const result = determineStorage(10 * 1024, 'free');
        expect(result).toEqual({ location: 'd1', canStore: true });
      });

      it('should reject payloads > 10KB on free tier', () => {
        const result = determineStorage(10 * 1024 + 1, 'free');
        expect(result.canStore).toBe(false);
        expect(result.location).toBe('d1');
        expect(result.reason).toContain('10KB');
        expect(result.reason).toContain('Upgrade to Deep drop');
      });
    });

    describe('deep tier', () => {
      it('should use D1 for small payloads', () => {
        const result = determineStorage(100, 'deep');
        expect(result).toEqual({ location: 'd1', canStore: true });
      });

      it('should use D1 for exactly 10KB', () => {
        const result = determineStorage(10 * 1024, 'deep');
        expect(result).toEqual({ location: 'd1', canStore: true });
      });

      it('should use R2 for payloads > 10KB and <= 4MB', () => {
        const result = determineStorage(10 * 1024 + 1, 'deep');
        expect(result).toEqual({ location: 'r2', canStore: true });
      });

      it('should use R2 for exactly 4MB', () => {
        const result = determineStorage(4 * 1024 * 1024, 'deep');
        expect(result).toEqual({ location: 'r2', canStore: true });
      });

      it('should reject payloads > 4MB', () => {
        const result = determineStorage(4 * 1024 * 1024 + 1, 'deep');
        expect(result.canStore).toBe(false);
        expect(result.location).toBe('r2');
        expect(result.reason).toContain('4MB');
        expect(result.reason).toContain('maximum');
      });
    });
  });

  describe('generateR2Key', () => {
    it('should generate key with drop ID and version', () => {
      expect(generateR2Key('drop-123', 1)).toBe('drop-123/v1');
    });

    it('should handle different versions', () => {
      expect(generateR2Key('my-drop', 5)).toBe('my-drop/v5');
    });

    it('should handle UUID drop IDs', () => {
      expect(generateR2Key('abc-123-def-456', 2)).toBe('abc-123-def-456/v2');
    });
  });

  describe('parseR2Key', () => {
    it('should parse valid R2 key', () => {
      const result = parseR2Key('drop-123/v1');
      expect(result).toEqual({ dropId: 'drop-123', version: 1 });
    });

    it('should parse key with multiple version digits', () => {
      const result = parseR2Key('my-drop/v42');
      expect(result).toEqual({ dropId: 'my-drop', version: 42 });
    });

    it('should parse key with UUID drop ID', () => {
      const result = parseR2Key('abc-123-def-456/v2');
      expect(result).toEqual({ dropId: 'abc-123-def-456', version: 2 });
    });

    it('should return null for invalid key format', () => {
      expect(parseR2Key('invalid-key')).toBeNull();
    });

    it('should return null for key without version', () => {
      expect(parseR2Key('drop-123/')).toBeNull();
    });

    it('should return null for key without drop ID', () => {
      expect(parseR2Key('/v1')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseR2Key('')).toBeNull();
    });
  });

  describe('shouldUseR2', () => {
    it('should return false for small payloads', () => {
      expect(shouldUseR2(100)).toBe(false);
    });

    it('should return false for exactly 10KB', () => {
      expect(shouldUseR2(10 * 1024)).toBe(false);
    });

    it('should return true for payloads > 10KB', () => {
      expect(shouldUseR2(10 * 1024 + 1)).toBe(true);
    });

    it('should return true for large payloads', () => {
      expect(shouldUseR2(1024 * 1024)).toBe(true);
    });
  });

  describe('STORAGE_LIMITS', () => {
    it('should export D1 max size', () => {
      expect(STORAGE_LIMITS.D1_MAX_SIZE).toBe(10 * 1024);
    });

    it('should export Deep max size', () => {
      expect(STORAGE_LIMITS.DEEP_MAX_SIZE).toBe(4 * 1024 * 1024);
    });

    it('should export free tier max', () => {
      expect(STORAGE_LIMITS.FREE_TIER_MAX).toBe(10 * 1024);
    });

    it('should export deep tier max', () => {
      expect(STORAGE_LIMITS.DEEP_TIER_MAX).toBe(4 * 1024 * 1024);
    });
  });
});
