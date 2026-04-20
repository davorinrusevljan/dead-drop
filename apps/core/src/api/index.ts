import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import type { AppEnv } from './types.js';
import { OpenAPIHono } from '@hono/zod-openapi';
import { securityHeaders, rateLimitHeaders, versionHeader } from './middleware.js';
import { v1Router } from './v1/index.js';

/**
 * Create the main Hono API app with OpenAPI support
 */
export function createApiApp(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

  // robots.txt - block all search engines
  app.get('/robots.txt', (c) => {
    return c.text('User-agent: *\nDisallow: /');
  });

  /**
   * Rate Limit Headers (v1.0)
   *
   * All API responses include rate limit headers for forward compatibility:
   * - X-RateLimit-Limit: Maximum requests per window
   * - X-RateLimit-Remaining: Requests remaining (v1.0: always full)
   * - X-RateLimit-Reset: Unix timestamp when window resets
   * - X-RateLimit-Window: Window length in seconds (3600 = 1 hour)
   *
   * In v1.0, headers are sent but not enforced. v1.1+ will implement enforcement.
   * Clients can start using these headers now without breaking changes.
   */

  // Middleware
  app.use('*', rateLimitHeaders);
  app.use('*', securityHeaders);
  app.use('*', versionHeader);
  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Mount v1 router
  app.route('/api/v1', v1Router);

  // Error handler
  app.onError((err, c) => {
    // Handle Zod validation errors
    if (err instanceof Error && err.name === 'ZodError') {
      try {
        const zodError = JSON.parse(err.message);
        if (zodError.issues && Array.isArray(zodError.issues)) {
          const firstIssue = zodError.issues[0];
          const message =
            firstIssue.message || 'Invalid request data. Please check your input and try again.';
          return c.json({ error: { code: 'VALIDATION_ERROR', message } }, 400);
        }
      } catch {
        // If we can't parse as ZodError, fall through to general error handling
      }
    }

    // Handle HTTPError from Hono
    if (err instanceof Error && 'status' in err) {
      const status = (err as { status?: number }).status || 500;
      return c.json(
        { error: { code: 'HTTP_ERROR', message: err.message || 'An error occurred' } },
        status as 400 | 401 | 402 | 403 | 404 | 409 | 500
      );
    }

    // General error handler
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
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
