import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth.js';
import { statsRoutes } from './routes/stats.js';
import { usersRoutes } from './routes/users.js';
import { securityHeaders } from './middleware-security.js';

/**
 * Allowed CORS origins for production
 * When credentials: true, we must use specific origins, not '*'
 */
const PRODUCTION_ORIGINS = [
  'https://admin.dead-drop.xyz',
  'https://dead-drop-admin.pages.dev',
  'https://dead-drop-admin.bytesmith.pages.dev',
  'https://989448d5.dead-drop-admin.pages.dev',
  // Add any other preview URLs as needed
];

/**
 * CORS origin resolver
 */
const corsOriginResolver = (origin: string | undefined) => {
  // Allow requests with no origin (like mobile apps, curl)
  if (!origin) return origin;
  // Allow whitelisted origins
  if (PRODUCTION_ORIGINS.includes(origin)) return origin;
  // For development, allow localhost
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return origin;
  }
  // Allow any dead-drop-admin pages.dev preview URL
  if (origin.match(/^https:\/\/[a-z0-9-]+\.dead-drop-admin\.pages\.dev$/)) {
    return origin;
  }
  // Reject other origins by returning the first allowed origin
  return PRODUCTION_ORIGINS[0];
};

/**
 * Environment bindings for the Admin API
 */
export type Env = {
  /** Admin database (separate from core) */
  ADMIN_DB: D1Database;
  /** Core database (read-only for stats) */
  CORE_DB: D1Database;
  /** JWT secret for authentication */
  JWT_SECRET: string;
};

/**
 * Variables available in all routes
 */
export type Variables = {
  user?: {
    id: number;
    username: string;
    role: 'admin' | 'superadmin';
  };
};

/**
 * Hono app type with environment and variables
 */
export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};

/**
 * Create the admin API app
 */
export function createAdminApiApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // robots.txt - block all search engines
  app.get('/robots.txt', (c) => {
    return c.text('User-agent: *\nDisallow: /');
  });

  // Middleware
  app.use('*', securityHeaders);
  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: corsOriginResolver,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      exposeHeaders: ['Set-Cookie'],
      credentials: true,
    })
  );

  // Root endpoint
  app.get('/', (c) => {
    return c.json({
      name: 'dead-drop Admin API',
      version: '1.0.0',
      status: 'running',
    });
  });

  // Health check
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth routes (no authentication required for login)
  app.route('/api/auth', authRoutes);

  // Stats routes (authentication required)
  app.route('/api/stats', statsRoutes);

  // User management routes (authentication required)
  app.route('/api/users', usersRoutes);

  // Error handler
  app.onError((err, c) => {
    console.error('Admin API Error:', err);
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
export const adminApiApp = createAdminApiApp();

/**
 * Type export for the app
 */
export type AdminApiApp = typeof adminApiApp;
