import { describe, it, expect } from 'vitest';
import { WORDS, generateRandomDropName, generateDropNameSuggestions } from './wordlist.js';

describe('wordlist', () => {
  describe('WORDS', () => {
    it('should contain 7776 words from EFF Diceware', () => {
      expect(WORDS).toHaveLength(7776);
    });

    it('should contain only lowercase strings', () => {
      for (const word of WORDS) {
        expect(word).toBe(word.toLowerCase());
        expect(typeof word).toBe('string');
        expect(word.length).toBeGreaterThan(0);
      }
    });

    it('should contain known EFF Diceware words', () => {
      expect(WORDS).toContain('abacus');
      expect(WORDS).toContain('zoom');
      expect(WORDS).toContain('able');
    });
  });

  describe('generateRandomDropName', () => {
    it('should generate a name with default 4 words', () => {
      const name = generateRandomDropName();
      const parts = name.split('-');
      expect(parts).toHaveLength(4);
    });

    it('should generate a name with specified word count', () => {
      const name = generateRandomDropName(3);
      const parts = name.split('-');
      expect(parts).toHaveLength(3);
    });

    it('should generate unique names on multiple calls', () => {
      const names = new Set<string>();
      for (let i = 0; i < 100; i++) {
        names.add(generateRandomDropName());
      }
      // With 7776^4 possible combinations, 100 calls should produce mostly unique names
      expect(names.size).toBeGreaterThan(90);
    });

    it('should not have duplicate words within a single name', () => {
      for (let i = 0; i < 50; i++) {
        const name = generateRandomDropName(4);
        const parts = name.split('-');
        const uniqueParts = new Set(parts);
        expect(uniqueParts.size).toBe(4);
      }
    });

    it('should generate kebab-case names', () => {
      const name = generateRandomDropName();
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
    });

    it('should handle word count of 1', () => {
      const name = generateRandomDropName(1);
      const parts = name.split('-');
      expect(parts).toHaveLength(1);
      expect(WORDS).toContain(parts[0]);
    });

    it('should handle large word counts', () => {
      const name = generateRandomDropName(10);
      const parts = name.split('-');
      expect(parts).toHaveLength(10);
    });
  });

  describe('generateDropNameSuggestions', () => {
    it('should generate default 4 suggestions', () => {
      const suggestions = generateDropNameSuggestions();
      expect(suggestions).toHaveLength(4);
    });

    it('should generate specified number of suggestions', () => {
      const suggestions = generateDropNameSuggestions(6);
      expect(suggestions).toHaveLength(6);
    });

    it('should generate unique suggestions', () => {
      const suggestions = generateDropNameSuggestions(10);
      const unique = new Set(suggestions);
      expect(unique.size).toBe(10);
    });

    it('should use specified word count', () => {
      const suggestions = generateDropNameSuggestions(5, 3);
      for (const name of suggestions) {
        const parts = name.split('-');
        expect(parts).toHaveLength(3);
      }
    });

    it('should return valid kebab-case names', () => {
      const suggestions = generateDropNameSuggestions(10);
      for (const name of suggestions) {
        expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      }
    });
  });
});
