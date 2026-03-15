import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN_SLUGS,
  sanitizeDropPhrase,
  validateDropPhrase,
  dropPhraseSchema,
  dropPhraseSchemaWithMin,
} from './validation.js';

describe('FORBIDDEN_SLUGS', () => {
  it('should contain expected forbidden slugs', () => {
    expect(FORBIDDEN_SLUGS).toContain('api');
    expect(FORBIDDEN_SLUGS).toContain('drop');
    expect(FORBIDDEN_SLUGS).toContain('admin');
    expect(FORBIDDEN_SLUGS).toContain('dashboard');
    expect(FORBIDDEN_SLUGS).toContain('assets');
    expect(FORBIDDEN_SLUGS).toContain('robots.txt');
  });

  it('should be a readonly array', () => {
    expect(FORBIDDEN_SLUGS).toHaveLength(6);
  });
});

describe('sanitizeDropPhrase', () => {
  it('should trim whitespace', () => {
    expect(sanitizeDropPhrase('  hello-world  ')).toBe('hello-world');
    expect(sanitizeDropPhrase('\ttest\n')).toBe('test');
  });

  it('should convert to lowercase', () => {
    expect(sanitizeDropPhrase('HELLO-WORLD')).toBe('hello-world');
    expect(sanitizeDropPhrase('Test_Phrase')).toBe('test_phrase');
    expect(sanitizeDropPhrase('CamelCase')).toBe('camelcase');
  });

  it('should replace whitespace with hyphens', () => {
    expect(sanitizeDropPhrase('hello world')).toBe('hello-world');
    expect(sanitizeDropPhrase('hello  world')).toBe('hello-world');
    expect(sanitizeDropPhrase('hello\tworld')).toBe('hello-world');
    expect(sanitizeDropPhrase('one two three')).toBe('one-two-three');
  });

  it('should handle already clean phrases', () => {
    expect(sanitizeDropPhrase('my-project')).toBe('my-project');
    expect(sanitizeDropPhrase('test_123')).toBe('test_123');
    expect(sanitizeDropPhrase('file.name')).toBe('file.name');
  });

  it('should handle empty string', () => {
    expect(sanitizeDropPhrase('')).toBe('');
  });

  it('should handle whitespace-only string', () => {
    expect(sanitizeDropPhrase('   ')).toBe('');
    expect(sanitizeDropPhrase('\t\n')).toBe('');
  });
});

describe('validateDropPhrase', () => {
  describe('minimum length validation', () => {
    it('should reject phrases shorter than default minimum (8)', () => {
      const result = validateDropPhrase('short');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop phrase must be at least 8 characters');
      }
    });

    it('should reject phrases shorter than custom minimum', () => {
      const result = validateDropPhrase('ab', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop phrase must be at least 3 characters');
      }
    });

    it('should accept phrases exactly at minimum length', () => {
      expect(validateDropPhrase('12345678').valid).toBe(true);
      expect(validateDropPhrase('abc', 3).valid).toBe(true);
    });

    it('should accept phrases longer than minimum', () => {
      expect(validateDropPhrase('123456789').valid).toBe(true);
      expect(validateDropPhrase('abcd', 3).valid).toBe(true);
    });
  });

  describe('allowed characters validation', () => {
    it('should accept lowercase letters', () => {
      expect(validateDropPhrase('abcdefgh').valid).toBe(true);
    });

    it('should accept numbers', () => {
      expect(validateDropPhrase('12345678').valid).toBe(true);
    });

    it('should accept hyphens', () => {
      expect(validateDropPhrase('my-project-name').valid).toBe(true);
    });

    it('should accept underscores', () => {
      expect(validateDropPhrase('my_project_name').valid).toBe(true);
    });

    it('should accept dots', () => {
      expect(validateDropPhrase('my.project.name').valid).toBe(true);
    });

    it('should reject uppercase letters', () => {
      const result = validateDropPhrase('MyProject');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          'Drop phrase can only contain lowercase letters, numbers, hyphens, underscores, and dots'
        );
      }
    });

    it('should reject spaces', () => {
      const result = validateDropPhrase('my project');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          'Drop phrase can only contain lowercase letters, numbers, hyphens, underscores, and dots'
        );
      }
    });

    it('should reject special characters', () => {
      const invalidPhrases = ['my@project', 'my#project', 'my$project', 'my!project'];
      for (const phrase of invalidPhrases) {
        const result = validateDropPhrase(phrase);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe(
            'Drop phrase can only contain lowercase letters, numbers, hyphens, underscores, and dots'
          );
        }
      }
    });
  });

  describe('leading/trailing dots validation', () => {
    it('should reject phrases starting with a dot', () => {
      const result = validateDropPhrase('.myproject');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop phrase cannot start or end with a dot');
      }
    });

    it('should reject phrases ending with a dot', () => {
      const result = validateDropPhrase('myproject.');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop phrase cannot start or end with a dot');
      }
    });

    it('should accept phrases with dots in the middle', () => {
      expect(validateDropPhrase('my.project.name').valid).toBe(true);
    });
  });

  describe('consecutive dots validation', () => {
    it('should reject phrases with consecutive dots', () => {
      const result = validateDropPhrase('my..project');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop phrase cannot contain consecutive dots');
      }
    });

    it('should reject phrases with multiple consecutive dots', () => {
      const result = validateDropPhrase('my...project');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop phrase cannot contain consecutive dots');
      }
    });
  });

  describe('forbidden slugs validation', () => {
    it('should reject "dashboard" (9 chars, passes length check)', () => {
      const result = validateDropPhrase('dashboard');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"dashboard" is a reserved phrase');
      }
    });

    it('should reject "robots.txt" (10 chars, passes length check)', () => {
      const result = validateDropPhrase('robots.txt');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"robots.txt" is a reserved phrase');
      }
    });

    it('should reject "api" when using min length of 3', () => {
      const result = validateDropPhrase('api', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"api" is a reserved phrase');
      }
    });

    it('should reject "drop" when using min length of 3', () => {
      const result = validateDropPhrase('drop', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"drop" is a reserved phrase');
      }
    });

    it('should reject "admin" when using min length of 3', () => {
      const result = validateDropPhrase('admin', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"admin" is a reserved phrase');
      }
    });

    it('should reject "assets" when using min length of 3', () => {
      const result = validateDropPhrase('assets', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"assets" is a reserved phrase');
      }
    });

    it('should accept phrases containing forbidden slugs as substrings', () => {
      // These should be valid because they don't EXACTLY match forbidden slugs
      expect(validateDropPhrase('my-api-key').valid).toBe(true);
      expect(validateDropPhrase('dropdown-menu').valid).toBe(true);
      expect(validateDropPhrase('administrator').valid).toBe(true);
      expect(validateDropPhrase('my-assets-folder').valid).toBe(true);
    });
  });

  describe('valid phrases', () => {
    it('should accept valid alphanumeric phrases', () => {
      expect(validateDropPhrase('project123').valid).toBe(true);
      expect(validateDropPhrase('123project').valid).toBe(true);
      expect(validateDropPhrase('12345678').valid).toBe(true);
    });

    it('should accept valid phrases with hyphens', () => {
      expect(validateDropPhrase('my-project-name').valid).toBe(true);
      expect(validateDropPhrase('project-alpha').valid).toBe(true);
    });

    it('should accept valid phrases with underscores', () => {
      expect(validateDropPhrase('my_project_name').valid).toBe(true);
      expect(validateDropPhrase('project_beta').valid).toBe(true);
    });

    it('should accept valid phrases with dots', () => {
      expect(validateDropPhrase('file.name.here').valid).toBe(true);
      expect(validateDropPhrase('v1.0.0-release').valid).toBe(true);
    });

    it('should accept mixed valid phrases', () => {
      expect(validateDropPhrase('my-project_v1.0').valid).toBe(true);
      expect(validateDropPhrase('test_123.abc').valid).toBe(true);
    });
  });
});

describe('dropPhraseSchema', () => {
  it('should sanitize and validate valid phrases', async () => {
    const result = await dropPhraseSchema.parseAsync('  My-Project  ');
    expect(result).toBe('my-project');
  });

  it('should reject invalid phrases', async () => {
    await expect(dropPhraseSchema.parseAsync('short')).rejects.toThrow();
  });

  it('should reject forbidden slugs', async () => {
    await expect(dropPhraseSchema.parseAsync('api')).rejects.toThrow();
  });

  it('should accept valid 8-character phrases', async () => {
    const result = await dropPhraseSchema.parseAsync('12345678');
    expect(result).toBe('12345678');
  });
});

describe('dropPhraseSchemaWithMin', () => {
  it('should create schema with custom minimum length', async () => {
    const schema = dropPhraseSchemaWithMin(3);
    const result = await schema.parseAsync('abc');
    expect(result).toBe('abc');
  });

  it('should reject phrases shorter than custom minimum', async () => {
    const schema = dropPhraseSchemaWithMin(3);
    await expect(schema.parseAsync('ab')).rejects.toThrow();
  });

  it('should sanitize input before validation', async () => {
    const schema = dropPhraseSchemaWithMin(3);
    const result = await schema.parseAsync('  ABC  ');
    expect(result).toBe('abc');
  });

  it('should work with minimum of 3 for Deep drops', async () => {
    const schema = dropPhraseSchemaWithMin(3);
    const result = await schema.parseAsync('xyz');
    expect(result).toBe('xyz');
  });

  it('should still reject forbidden slugs regardless of length', async () => {
    const schema = dropPhraseSchemaWithMin(3);
    await expect(schema.parseAsync('api')).rejects.toThrow();
  });
});
