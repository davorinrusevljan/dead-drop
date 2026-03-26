import { Hono } from 'hono';
import { z } from 'zod';
import {
  listAdminUsers,
  createAdminUser,
  deleteAdminUser,
  updateAdminPassword,
  getAdminUserById,
} from '../db-admin.js';
import { generatePasswordSalt, hashPassword } from '../../lib/password.js';
import { authMiddleware, requireRole } from '../middleware.js';
import type { AppEnv } from '../index.js';

const usersRoutes = new Hono<AppEnv>();

// All user routes require authentication
usersRoutes.use('*', authMiddleware);

/**
 * Create user schema
 */
const createUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8),
  role: z.enum(['admin', 'superadmin']).optional(),
});

/**
 * Update password schema
 */
const updatePasswordSchema = z.object({
  password: z.string().min(8),
});

/**
 * GET /api/users - List all admin users
 */
usersRoutes.get('/', async (c) => {
  const users = await listAdminUsers(c.env.ADMIN_DB);
  return c.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
      lastLoginAt: u.lastLoginAt instanceof Date ? u.lastLoginAt.toISOString() : u.lastLoginAt,
    })),
  });
});

/**
 * POST /api/users - Create a new admin user (superadmin only)
 */
usersRoutes.post('/', requireRole('superadmin'), async (c) => {
  const body = await c.req.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'INVALID_INPUT', message: parsed.error.message } }, 400);
  }

  const { username, password, role } = parsed.data;

  // Generate salt and hash password
  const salt = generatePasswordSalt();
  const passwordHash = await hashPassword(password, salt);

  try {
    const user = await createAdminUser(c.env.ADMIN_DB, {
      username,
      passwordHash,
      salt,
      role: role ?? 'admin',
    });

    return c.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      },
      201
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: { code: 'USERNAME_EXISTS', message: 'Username already taken' } }, 409);
    }
    throw err;
  }
});

/**
 * DELETE /api/users/:id - Delete an admin user (superadmin only)
 */
usersRoutes.delete('/:id', requireRole('superadmin'), async (c) => {
  const idParam = c.req.param('id');
  const id = idParam ? parseInt(idParam, 10) : NaN;

  if (isNaN(id)) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid user ID' } }, 400);
  }

  const currentUser = c.get('user')!;
  // Prevent self-deletion
  if (id === currentUser.id) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Cannot delete yourself' } }, 403);
  }

  const deleted = await deleteAdminUser(c.env.ADMIN_DB, id);

  if (!deleted) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  return c.json({ success: true });
});

/**
 * PUT /api/users/:id/password - Update a user's password (superadmin only)
 */
usersRoutes.put('/:id/password', requireRole('superadmin'), async (c) => {
  const idParam = c.req.param('id');
  const id = idParam ? parseInt(idParam, 10) : NaN;

  if (isNaN(id)) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid user ID' } }, 400);
  }

  const body = await c.req.json();
  const parsed = updatePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'INVALID_INPUT', message: parsed.error.message } }, 400);
  }

  const user = await getAdminUserById(c.env.ADMIN_DB, id);
  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const password = parsed.data.password;
  const salt = generatePasswordSalt();
  const passwordHash = await hashPassword(password, salt);

  await updateAdminPassword(c.env.ADMIN_DB, id, passwordHash, salt);

  return c.json({ success: true });
});

export { usersRoutes };
