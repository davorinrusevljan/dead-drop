import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth.js';
import { statsRoutes } from './routes/stats.js';
import { usersRoutes } from './routes/users.js';

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

  // Middleware
  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: '*', // Configure appropriately for production
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
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
