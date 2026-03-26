import type { Context, Next } from 'hono';
import { verifyAdminJwt, extractJwtFromCookie } from '../lib/jwt.js';
import { getAdminUserById } from './db-admin.js';
import type { AdminRole } from './schema.js';
import type { AppEnv } from './index.js';

/**
 * User info attached to context after auth
 */
export interface AuthUser {
  id: number;
  username: string;
  role: AdminRole;
}

/**
 * Extend Hono context variables
 */
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

/**
 * Auth middleware - verifies JWT and attaches user to context
 */
export async function authMiddleware(c: Context<AppEnv>, next: Next): Promise<Response> {
  const cookieHeader = c.req.header('Cookie');
  const token = extractJwtFromCookie(cookieHeader);
  const jwtSecret = c.env.JWT_SECRET;

  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401);
  }

  const payload = await verifyAdminJwt(token, jwtSecret);
  if (!payload) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401);
  }

  const userId = parseInt(payload.sub, 10);
  const user = await getAdminUserById(c.env.ADMIN_DB, userId);

  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } }, 401);
  }

  c.set('user', {
    id: user.id,
    username: user.username,
    role: user.role,
  });

  await next();
  return new Response();
}

/**
 * Role middleware - requires specific role
 */
export function requireRole(
  role: AdminRole
): (c: Context<AppEnv>, next: Next) => Promise<Response> {
  return async (c: Context<AppEnv>, next: Next): Promise<Response> => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401);
    }

    if (role === 'superadmin' && user.role !== 'superadmin') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Superadmin access required' } }, 403);
    }

    await next();
    return new Response();
  };
}
