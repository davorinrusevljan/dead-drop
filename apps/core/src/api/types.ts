/**
 * Environment bindings for the Hono API
 * These are provided by Cloudflare Workers
 */
export type Env = {
  /** D1 Database binding */
  DB: D1Database;
  /** Secret pepper for admin hash derivation */
  ADMIN_HASH_PEPPER: string;
  /** Secret token for upgrading drops (mock payment) */
  UPGRADE_TOKEN: string;
};

/**
 * Variables available in all routes
 */
export type Variables = {
  // Future: auth context, request ID, etc.
};

/**
 * Hono app type with environment and variables
 */
export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};
