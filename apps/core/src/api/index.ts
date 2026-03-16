import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv } from './types.js';
import { healthRoute, healthHandler } from './routes/health.js';
import { docsRoute, docsHandler, openapiRoute } from './routes/docs.js';
import { dropRoutes } from './routes/drops.js';
import { historyRoutes } from './routes/history.js';
import { upgradeRoutes } from './routes/upgrade.js';

/**
 * OpenAPI document configuration
 */
const openApiConfig = {
  openapi: '3.0.0',
  info: {
    title: 'dead-drop API',
    version: '1.0.0',
    description:
      'Privacy-focused, ephemeral data-sharing API. The API is open and can be used directly without the frontend.',
  },
  servers: [{ url: '/', description: 'Current server' }],
};

/**
 * Create the main Hono API app with OpenAPI support
 */
export function createApiApp(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

  // Middleware
  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Health check endpoint (OpenAPI documented)
  app.openapi(healthRoute, healthHandler);

  // Documentation endpoints (OpenAPI documented)
  app.openapi(openapiRoute, () => {
    // Return OpenAPI spec from the app
    return new Response(JSON.stringify(app.getOpenAPIDocument(openApiConfig)), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  app.openapi(docsRoute, docsHandler);

  // Drop routes (Hono routes for CRUD operations)
  app.route('/', dropRoutes);

  // History routes
  app.route('/', historyRoutes);

  // Upgrade routes
  app.route('/', upgradeRoutes);

  // Error handler
  app.onError((err, c) => {
    console.error('API Error:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    );
  });

  return app;
}

/**
 * API app instance
 */
export const apiApp = createApiApp();

/**
 * Type export for the app
 */
export type ApiApp = typeof apiApp;
