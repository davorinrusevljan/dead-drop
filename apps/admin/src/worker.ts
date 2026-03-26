/**
 * Cloudflare Worker entry point for Admin API
 */

import { createAdminApiApp } from './api/index.js';

// Create the Hono app for Cloudflare Workers
const app = createAdminApiApp();

// Export for Cloudflare Workers
export default app;
