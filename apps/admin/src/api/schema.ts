import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Admin users table - Authentication for admin panel
 * Stored in separate database from core for security isolation
 */
export const adminUsers = sqliteTable('admin_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  role: text('role').default('admin').notNull(), // 'admin' | 'superadmin'
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
});

/**
 * Admin user record type
 */
export interface AdminUser {
  id: number;
  username: string;
  passwordHash: string;
  salt: string;
  role: 'admin' | 'superadmin';
  createdAt: Date;
  lastLoginAt: Date | null;
}

/**
 * Admin role type
 */
export type AdminRole = 'admin' | 'superadmin';

/**
 * JWT payload for admin authentication
 */
export interface AdminJwtPayload {
  sub: string; // user ID
  role: AdminRole;
  iat: number;
  exp: number;
}
