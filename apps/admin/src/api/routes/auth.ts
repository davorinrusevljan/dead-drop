import { Hono } from 'hono';
import { z } from 'zod';
import { getAdminUserByUsername, updateLastLogin } from '../db-admin.js';
import { verifyPassword } from '../../lib/password.js';
import {
  signAdminJwt,
  getAuthCookieOptions,
  getClearCookieOptions,
  AUTH_COOKIE_NAME,
} from '../../lib/jwt.js';
import { authMiddleware } from '../middleware.js';
import type { AppEnv } from '../index.js';

const authRoutes = new Hono<AppEnv>();

/**
 * Login schema
 */
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * POST /api/auth/login - Login with username and password
 */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid input' } }, 400);
  }

  const { username, password } = parsed.data;

  // Find user
  const user = await getAdminUserByUsername(c.env.ADMIN_DB, username);
  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  // Verify password
  const valid = await verifyPassword(password, user.salt, user.passwordHash);
  if (!valid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  // Generate JWT
  const token = await signAdminJwt({ userId: user.id, role: user.role }, c.env.JWT_SECRET);

  // Update last login
  await updateLastLogin(c.env.ADMIN_DB, user.id);

  // Set cookie and return response
  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${AUTH_COOKIE_NAME}=${token}; ${getAuthCookieOptions()}`,
      },
    }
  );
});

/**
 * POST /api/auth/logout - Logout and clear cookie
 */
authRoutes.post('/logout', (c) => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${AUTH_COOKIE_NAME}=; ${getClearCookieOptions()}`,
    },
  });
});

/**
 * GET /api/auth/me - Get current user info
 */
authRoutes.get('/me', authMiddleware, (c) => {
  const user = c.get('user')!;
  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

export { authRoutes };
