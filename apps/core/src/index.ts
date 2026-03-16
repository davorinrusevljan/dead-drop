// @dead-drop/core - Community Edition
// Free tier only, Text only, D1 Database storage

export const APP_NAME = 'dead-drop (core)';
export const EDITION = 'core' as const;

// API exports
export { createApiApp, apiApp, type ApiApp } from './api/index.js';
export type { AppEnv, Env, Variables } from './api/types.js';
