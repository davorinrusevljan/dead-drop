// Engine package exports
export {
  normalizeDropName,
  validateDropName,
  dropNameSchema,
  dropNameSchemaWithMin,
  // Legacy aliases (deprecated)
  sanitizeDropPhrase,
  validateDropPhrase,
  dropPhraseSchema,
  dropPhraseSchemaWithMin,
  FORBIDDEN_SLUGS,
} from './validation.js';
export * from './types.js';

// Crypto exports - new module with algorithm registry
export * from './crypto/index.js';

// Database exports
export * from './db/index.js';

// Wordlist utilities
export { generateRandomDropName, generateDropNameSuggestions, WORDS } from './wordlist.js';

// Development utilities - use '@dead-drop/engine/dev/d1-adapter' for local development
// Note: These are intentionally not exported from the main entry point to avoid
// bundling Node.js-only dependencies (fs, path, better-sqlite3) into browser/edge builds
