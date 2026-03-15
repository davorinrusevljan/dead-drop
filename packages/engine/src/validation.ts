import { z } from 'zod';

/**
 * Forbidden slugs that cannot be used as drop phrases
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
 * Sanitize a drop phrase
 * - Trims whitespace
 * - Converts to lowercase
 * - Replaces whitespace with hyphens
 */
export function sanitizeDropPhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Validate a sanitized drop phrase
 * @param phrase - The sanitized phrase to validate
 * @param minChars - Minimum character requirement (8 for Standard, 3 for Deep)
 * @returns Validation result with error message if invalid
 */
export function validateDropPhrase(
  phrase: string,
  minChars: number = 8
): { valid: true } | { valid: false; error: string } {
  // Check minimum length
  if (phrase.length < minChars) {
    return {
      valid: false,
      error: `Drop phrase must be at least ${minChars} characters`,
    };
  }

  // Check allowed characters
  if (!/^[a-z0-9\-_.]+$/.test(phrase)) {
    return {
      valid: false,
      error:
        'Drop phrase can only contain lowercase letters, numbers, hyphens, underscores, and dots',
    };
  }

  // Check for leading/trailing dots
  if (phrase.startsWith('.') || phrase.endsWith('.')) {
    return {
      valid: false,
      error: 'Drop phrase cannot start or end with a dot',
    };
  }

  // Check for consecutive dots
  if (phrase.includes('..')) {
    return {
      valid: false,
      error: 'Drop phrase cannot contain consecutive dots',
    };
  }

  // Check for forbidden slugs
  if (FORBIDDEN_SLUGS.includes(phrase as (typeof FORBIDDEN_SLUGS)[number])) {
    return {
      valid: false,
      error: `"${phrase}" is a reserved phrase`,
    };
  }

  return { valid: true };
}

/**
 * Zod schema for drop phrase validation
 */
export const dropPhraseSchema = z
  .string()
  .transform(sanitizeDropPhrase)
  .refine((phrase) => validateDropPhrase(phrase, 8).valid, { message: 'Invalid drop phrase' });

/**
 * Zod schema for drop phrase with custom minimum length
 */
export function dropPhraseSchemaWithMin(minChars: number) {
  return z
    .string()
    .transform(sanitizeDropPhrase)
    .refine((phrase) => validateDropPhrase(phrase, minChars).valid, {
      message: `Invalid drop phrase (minimum ${minChars} characters)`,
    });
}
