import { z } from 'zod';

/**
 * Forbidden slugs that cannot be used as drop names
 */
export const FORBIDDEN_SLUGS = [
  'api',
  'drop',
  'admin',
  'dashboard',
  'assets',
  'robots.txt',
] as const;

/**
 * Normalize a drop name (Auto-Kebab pipeline)
 * 1. Trim whitespace
 * 2. Convert to lowercase
 * 3. Replace spaces with hyphens
 * 4. Strip invalid characters (anything not a-z, 0-9, -, _, .)
 */
export function normalizeDropName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '');
}

/**
 * Validate a normalized drop name
 * @param name - The normalized name to validate
 * @param minChars - Minimum character requirement (12 for Standard, 3 for Deep)
 * @returns Validation result with error message if invalid
 */
export function validateDropName(
  name: string,
  minChars: number = 12
): { valid: true } | { valid: false; error: string } {
  // Check minimum length
  if (name.length < minChars) {
    return {
      valid: false,
      error: `Drop name must be at least ${minChars} characters`,
    };
  }

  // Check allowed characters
  if (!/^[a-z0-9\-_.]+$/.test(name)) {
    return {
      valid: false,
      error:
        'Drop name can only contain lowercase letters, numbers, hyphens, underscores, and dots',
    };
  }

  // Check for leading/trailing dots
  if (name.startsWith('.') || name.endsWith('.')) {
    return {
      valid: false,
      error: 'Drop name cannot start or end with a dot',
    };
  }

  // Check for consecutive dots
  if (name.includes('..')) {
    return {
      valid: false,
      error: 'Drop name cannot contain consecutive dots',
    };
  }

  // Check for forbidden slugs
  if (FORBIDDEN_SLUGS.includes(name as (typeof FORBIDDEN_SLUGS)[number])) {
    return {
      valid: false,
      error: `"${name}" is a reserved name`,
    };
  }

  return { valid: true };
}

/**
 * Zod schema for drop name validation
 */
export const dropNameSchema = z
  .string()
  .transform(normalizeDropName)
  .refine((name) => validateDropName(name, 12).valid, { message: 'Invalid drop name' });

/**
 * Zod schema for drop name with custom minimum length
 */
export function dropNameSchemaWithMin(minChars: number) {
  return z
    .string()
    .transform(normalizeDropName)
    .refine((name) => validateDropName(name, minChars).valid, {
      message: `Invalid drop name (minimum ${minChars} characters)`,
    });
}

// Legacy aliases for backwards compatibility (deprecated)
export const sanitizeDropPhrase = normalizeDropName;
export const validateDropPhrase = validateDropName;
export const dropPhraseSchema = dropNameSchema;
export const dropPhraseSchemaWithMin = dropNameSchemaWithMin;
