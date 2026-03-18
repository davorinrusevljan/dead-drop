import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN_SLUGS,
  normalizeDropName,
  validateDropName,
  dropNameSchema,
  dropNameSchemaWithMin,
  // Legacy aliases
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

describe('normalizeDropName', () => {
  it('should trim whitespace', () => {
    expect(normalizeDropName('  hello-world  ')).toBe('hello-world');
    expect(normalizeDropName('\ttest\n')).toBe('test');
  });

  it('should convert to lowercase', () => {
    expect(normalizeDropName('HELLO-WORLD')).toBe('hello-world');
    expect(normalizeDropName('Test_Name')).toBe('test_name');
    expect(normalizeDropName('CamelCase')).toBe('camelcase');
  });

  it('should replace whitespace with hyphens', () => {
    expect(normalizeDropName('hello world')).toBe('hello-world');
    expect(normalizeDropName('hello  world')).toBe('hello-world');
    expect(normalizeDropName('hello\tworld')).toBe('hello-world');
    expect(normalizeDropName('one two three')).toBe('one-two-three');
  });

  it('should strip invalid characters', () => {
    expect(normalizeDropName('my@project')).toBe('myproject');
    expect(normalizeDropName('test#123')).toBe('test123');
    expect(normalizeDropName('hello!world')).toBe('helloworld');
    expect(normalizeDropName('foo$bar')).toBe('foobar');
  });

  it('should handle already clean names', () => {
    expect(normalizeDropName('my-project')).toBe('my-project');
    expect(normalizeDropName('test_123')).toBe('test_123');
    expect(normalizeDropName('file.name')).toBe('file.name');
  });

  it('should handle empty string', () => {
    expect(normalizeDropName('')).toBe('');
  });

  it('should handle whitespace-only string', () => {
    expect(normalizeDropName('   ')).toBe('');
    expect(normalizeDropName('\t\n')).toBe('');
  });

  it('should handle names with spaces that become valid after normalization', () => {
    expect(normalizeDropName('My Secret File')).toBe('my-secret-file');
    expect(normalizeDropName('  Project Alpha  ')).toBe('project-alpha');
  });
});

describe('validateDropName', () => {
  describe('minimum length validation', () => {
    it('should reject names shorter than default minimum (12)', () => {
      const result = validateDropName('tooshort');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop name must be at least 12 characters');
      }
    });

    it('should reject names shorter than custom minimum', () => {
      const result = validateDropName('ab', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop name must be at least 3 characters');
      }
    });

    it('should accept names exactly at minimum length', () => {
      expect(validateDropName('123456789012').valid).toBe(true); // 12 chars
      expect(validateDropName('abc', 3).valid).toBe(true);
    });

    it('should accept names longer than minimum', () => {
      expect(validateDropName('1234567890123').valid).toBe(true); // 13 chars
      expect(validateDropName('abcd', 3).valid).toBe(true);
    });
  });

  describe('allowed characters validation', () => {
    it('should accept lowercase letters', () => {
      expect(validateDropName('abcdefghijkl').valid).toBe(true);
    });

    it('should accept numbers', () => {
      expect(validateDropName('123456789012').valid).toBe(true);
    });

    it('should accept hyphens', () => {
      expect(validateDropName('my-project-name').valid).toBe(true);
    });

    it('should accept underscores', () => {
      expect(validateDropName('my_project_name').valid).toBe(true);
    });

    it('should accept dots', () => {
      expect(validateDropName('my.project.name').valid).toBe(true);
    });

    it('should reject uppercase letters', () => {
      const result = validateDropName('MyProjectNam');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          'Drop name can only contain lowercase letters, numbers, hyphens, underscores, and dots'
        );
      }
    });

    it('should reject spaces', () => {
      const result = validateDropName('my project x');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          'Drop name can only contain lowercase letters, numbers, hyphens, underscores, and dots'
        );
      }
    });

    it('should reject special characters', () => {
      const invalidNames = ['my@projectxx', 'my#projectxx', 'my$projectxx', 'my!projectxx'];
      for (const name of invalidNames) {
        const result = validateDropName(name);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe(
            'Drop name can only contain lowercase letters, numbers, hyphens, underscores, and dots'
          );
        }
      }
    });
  });

  describe('leading/trailing dots validation', () => {
    it('should reject names starting with a dot', () => {
      const result = validateDropName('.myprojectxx');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop name cannot start or end with a dot');
      }
    });

    it('should reject names ending with a dot', () => {
      const result = validateDropName('myprojectxx.');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop name cannot start or end with a dot');
      }
    });

    it('should accept names with dots in the middle', () => {
      expect(validateDropName('my.project.name').valid).toBe(true);
    });
  });

  describe('consecutive dots validation', () => {
    it('should reject names with consecutive dots', () => {
      const result = validateDropName('my..projectxx');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop name cannot contain consecutive dots');
      }
    });

    it('should reject names with multiple consecutive dots', () => {
      const result = validateDropName('my...projectx');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Drop name cannot contain consecutive dots');
      }
    });
  });

  describe('forbidden slugs validation', () => {
    it('should reject "dashboard" (9 chars, but forbidden)', () => {
      const result = validateDropName('dashboard123'); // 12 chars but not dashboard
      expect(result.valid).toBe(true);
    });

    it('should reject "robots.txt" when min is 10 or less', () => {
      const result = validateDropName('robots.txt', 10);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"robots.txt" is a reserved name');
      }
    });

    it('should reject "api" when using min length of 3', () => {
      const result = validateDropName('api', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"api" is a reserved name');
      }
    });

    it('should reject "drop" when using min length of 3', () => {
      const result = validateDropName('drop', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"drop" is a reserved name');
      }
    });

    it('should reject "admin" when using min length of 3', () => {
      const result = validateDropName('admin', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"admin" is a reserved name');
      }
    });

    it('should reject "assets" when using min length of 3', () => {
      const result = validateDropName('assets', 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('"assets" is a reserved name');
      }
    });

    it('should accept names containing forbidden slugs as substrings', () => {
      // These should be valid because they don't EXACTLY match forbidden slugs
      expect(validateDropName('my-api-key-test').valid).toBe(true);
      expect(validateDropName('dropdown-menu-x').valid).toBe(true);
      expect(validateDropName('administrator-1').valid).toBe(true);
      expect(validateDropName('my-assets-folder').valid).toBe(true);
    });
  });

  describe('valid names', () => {
    it('should accept valid alphanumeric names', () => {
      expect(validateDropName('project123456').valid).toBe(true);
      expect(validateDropName('123456project').valid).toBe(true);
      expect(validateDropName('123456789012').valid).toBe(true);
    });

    it('should accept valid names with hyphens', () => {
      expect(validateDropName('my-project-name').valid).toBe(true);
      expect(validateDropName('project-alpha-1').valid).toBe(true);
    });

    it('should accept valid names with underscores', () => {
      expect(validateDropName('my_project_name').valid).toBe(true);
      expect(validateDropName('project_beta_12').valid).toBe(true);
    });

    it('should accept valid names with dots', () => {
      expect(validateDropName('file.name.here').valid).toBe(true);
      expect(validateDropName('v1.0.0-release-1').valid).toBe(true);
    });

    it('should accept mixed valid names', () => {
      expect(validateDropName('my-project_v1.0').valid).toBe(true);
      expect(validateDropName('test_123.abc.xy').valid).toBe(true);
    });
  });
});

describe('dropNameSchema', () => {
  it('should normalize and validate valid names', async () => {
    const result = await dropNameSchema.parseAsync('  My-Project-Name  ');
    expect(result).toBe('my-project-name');
  });

  it('should reject invalid names', async () => {
    await expect(dropNameSchema.parseAsync('tooshort')).rejects.toThrow();
  });

  it('should reject forbidden slugs', async () => {
    await expect(dropNameSchema.parseAsync('api')).rejects.toThrow();
  });

  it('should accept valid 12-character names', async () => {
    const result = await dropNameSchema.parseAsync('123456789012');
    expect(result).toBe('123456789012');
  });
});

describe('dropNameSchemaWithMin', () => {
  it('should create schema with custom minimum length', async () => {
    const schema = dropNameSchemaWithMin(3);
    const result = await schema.parseAsync('abc');
    expect(result).toBe('abc');
  });

  it('should reject names shorter than custom minimum', async () => {
    const schema = dropNameSchemaWithMin(3);
    await expect(schema.parseAsync('ab')).rejects.toThrow();
  });

  it('should normalize input before validation', async () => {
    const schema = dropNameSchemaWithMin(3);
    const result = await schema.parseAsync('  ABC  ');
    expect(result).toBe('abc');
  });

  it('should work with minimum of 3 for Deep drops', async () => {
    const schema = dropNameSchemaWithMin(3);
    const result = await schema.parseAsync('xyz');
    expect(result).toBe('xyz');
  });

  it('should still reject forbidden slugs regardless of length', async () => {
    const schema = dropNameSchemaWithMin(3);
    await expect(schema.parseAsync('api')).rejects.toThrow();
  });
});

// Legacy alias tests
describe('legacy aliases', () => {
  it('sanitizeDropPhrase should be an alias for normalizeDropName', () => {
    expect(sanitizeDropPhrase).toBe(normalizeDropName);
    expect(sanitizeDropPhrase('Hello World')).toBe('hello-world');
  });

  it('validateDropPhrase should be an alias for validateDropName', () => {
    expect(validateDropPhrase).toBe(validateDropName);
    expect(validateDropPhrase('123456789012').valid).toBe(true);
  });

  it('dropPhraseSchema should be an alias for dropNameSchema', () => {
    expect(dropPhraseSchema).toBe(dropNameSchema);
  });

  it('dropPhraseSchemaWithMin should be an alias for dropNameSchemaWithMin', () => {
    expect(dropPhraseSchemaWithMin).toBe(dropNameSchemaWithMin);
  });
});
