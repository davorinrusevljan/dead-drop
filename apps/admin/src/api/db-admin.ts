import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { adminUsers, type AdminUser, type AdminRole } from './schema.js';

/**
 * Get an admin user by username
 */
export async function getAdminUserByUsername(
  db: D1Database,
  username: string
): Promise<AdminUser | null> {
  const orm = drizzle(db);
  const result = await orm
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, username))
    .limit(1);
  return (result[0] as AdminUser | undefined) ?? null;
}

/**
 * Get an admin user by ID
 */
export async function getAdminUserById(db: D1Database, id: number): Promise<AdminUser | null> {
  const orm = drizzle(db);
  const result = await orm.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return (result[0] as AdminUser | undefined) ?? null;
}

/**
 * Create a new admin user
 */
export async function createAdminUser(
  db: D1Database,
  data: {
    username: string;
    passwordHash: string;
    salt: string;
    role?: AdminRole;
  }
): Promise<AdminUser> {
  const orm = drizzle(db);
  const now = new Date();

  await orm.insert(adminUsers).values({
    username: data.username,
    passwordHash: data.passwordHash,
    salt: data.salt,
    role: data.role ?? 'admin',
    createdAt: now,
    lastLoginAt: null,
  });

  const user = await getAdminUserByUsername(db, data.username);
  if (!user) throw new Error('Failed to create admin user');
  return user;
}

/**
 * Update admin user's last login timestamp
 */
export async function updateLastLogin(db: D1Database, id: number): Promise<void> {
  const orm = drizzle(db);
  await orm.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, id));
}

/**
 * Update admin user's password
 */
export async function updateAdminPassword(
  db: D1Database,
  id: number,
  passwordHash: string,
  salt: string
): Promise<void> {
  const orm = drizzle(db);
  await orm.update(adminUsers).set({ passwordHash, salt }).where(eq(adminUsers.id, id));
}

/**
 * Delete an admin user
 */
export async function deleteAdminUser(db: D1Database, id: number): Promise<boolean> {
  const orm = drizzle(db);
  const existing = await getAdminUserById(db, id);
  if (!existing) return false;
  await orm.delete(adminUsers).where(eq(adminUsers.id, id));
  return true;
}

/**
 * List all admin users
 */
export async function listAdminUsers(
  db: D1Database
): Promise<Omit<AdminUser, 'passwordHash' | 'salt'>[]> {
  const orm = drizzle(db);
  const result = await orm
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      role: adminUsers.role,
      createdAt: adminUsers.createdAt,
      lastLoginAt: adminUsers.lastLoginAt,
    })
    .from(adminUsers);
  return result as Omit<AdminUser, 'passwordHash' | 'salt'>[];
}
