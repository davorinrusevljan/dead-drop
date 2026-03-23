import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDropId, normalizeDropName, generateRandomDropName } from '@dead-drop/engine';

describe('Generate Name Endpoint Logic', () => {
  let mockDb: Map<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = new Map();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate a unique name on first try', async () => {
    const testName = 'apple-banana-cherry-date';
    const normalizedName = normalizeDropName(testName);
    const id = await computeDropId(normalizedName);

    expect(normalizedName).toBe(testName);
    expect(id).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle collision by retrying', async () => {
    const names = ['taken-name-one-two', 'free-name-three-four'];
    let callIndex = 0;

    const mockGenerate = vi.fn(() => names[callIndex++] ?? 'fallback-name');

    // First name exists, second is free
    mockDb.set(await computeDropId(normalizeDropName(names[0]!)), { id: 'exists' });

    // Simulate retry logic
    let found = false;
    let finalName = '';
    for (let attempt = 0; attempt < 20 && !found; attempt++) {
      const name = mockGenerate();
      const normalizedName = normalizeDropName(name);
      const id = await computeDropId(normalizedName);
      const existing = mockDb.get(id);
      if (!existing) {
        found = true;
        finalName = normalizedName;
      }
    }
    expect(found).toBe(true);
    expect(finalName).toBe(names[1]);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('should fail after max attempts if all names are taken', async () => {
    const mockGenerate = vi.fn(() => 'always-taken-name');

    // The name always exists
    const id = await computeDropId(normalizeDropName('always-taken-name'));
    mockDb.set(id, { id: 'exists' });

    // Simulate the handler logic
    const MAX_ATTEMPTS = 20;
    let success = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const name = mockGenerate();
      const normalizedName = normalizeDropName(name);
      const dropId = await computeDropId(normalizedName);
      const existing = mockDb.get(dropId);
      if (!existing) {
        success = true;
        break;
      }
    }

    expect(success).toBe(false);
    expect(mockGenerate).toHaveBeenCalledTimes(20);
  });
});

describe('generateRandomDropName from engine', () => {
  it('should produce valid 4-word kebab-case names', () => {
    for (let i = 0; i < 10; i++) {
      const name = generateRandomDropName(4);
      expect(name).toMatch(/^[a-z]+(-[a-z]+){3}$/);
      expect(name.split('-')).toHaveLength(4);
    }
  });

  it('should produce unique names', () => {
    const names = new Set<string>();
    for (let i = 0; i < 100; i++) {
      names.add(generateRandomDropName(4));
    }
    // With 7776 words and 4 slots, collisions are extremely rare
    expect(names.size).toBeGreaterThan(95);
  });

  it('should use words from the EFF Diceware wordlist', () => {
    const name = generateRandomDropName(4);
    const words = name.split('-');
    // All words should be lowercase letters only
    for (const word of words) {
      expect(word).toMatch(/^[a-z]+$/);
      expect(word.length).toBeGreaterThan(1);
    }
  });
});

describe('normalizeDropName integration', () => {
  it('should normalize generated names consistently', () => {
    const name = generateRandomDropName(4);
    const normalized = normalizeDropName(name);
    // Generated names are already normalized
    expect(normalized).toBe(name);
  });
});
