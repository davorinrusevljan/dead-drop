/**
 * Cloudflare Worker entry point for dead-drop API
 */

import { createApiApp } from './api/index.js';

// Create the Hono app for Cloudflare Workers
const app = createApiApp();

// Export for Cloudflare Workers
export default app;
