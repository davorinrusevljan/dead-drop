import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';
import { registerHealthRoute } from './routes/health.js';
import { registerGenerateNameRoute } from './routes/generate-name.js';
import { registerCheckAvailabilityRoute } from './routes/check-availability.js';
import { registerDropsRoutes } from './routes/drops.js';
import { registerHistoryRoutes } from './routes/history.js';
import { registerDocsRoutes } from './routes/docs.js';

/**
 * OpenAPI document configuration
 */
const openApiConfig = {
  openapi: '3.1.0',
  info: {
    title: 'dead-drop API',
    version: '1.0.0',
    description:
      'Privacy-focused, ephemeral data-sharing API. The API is open and can be used directly without the frontend.',
    contact: {
      name: 'dead-drop.xyz',
      url: 'https://dead-drop.xyz',
    },
  },
  servers: [
    { url: '/', description: 'Current server' },
    { url: 'https://api.dead-drop.xyz', description: 'Production API' },
  ],
  tags: [
    { name: 'Drops', description: 'Drop CRUD operations' },
    { name: 'History', description: 'Drop version history' },
    { name: 'Health', description: 'Health check endpoints' },
  ],
};

/**
 * Create the v1 API router with all routes registered
 */
export const v1Router = new OpenAPIHono<AppEnv>({
  // Set the OpenAPI configuration
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data. Please check your input and try again.',
          },
        },
        400
      );
    }
  },
});

// Register all route modules
registerHealthRoute(v1Router);
registerGenerateNameRoute(v1Router);
registerCheckAvailabilityRoute(v1Router);
registerDropsRoutes(v1Router);
registerHistoryRoutes(v1Router);
registerDocsRoutes(v1Router);

// Export the OpenAPI config for use in generating documentation
export { openApiConfig };
