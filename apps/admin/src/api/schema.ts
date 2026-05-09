import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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
 * Backup history table - Tracks database backup operations
 */
export const backupHistory = sqliteTable('backup_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeredBy: integer('triggered_by')
    .notNull()
    .references(() => adminUsers.id),
  status: text('status', {
    enum: ['pending', 'running', 'complete', 'failed'],
  })
    .notNull()
    .default('pending'),
  r2Key: text('r2_key'),
  r2SizeBytes: integer('r2_size_bytes'),
  cfBookmark: text('cf_bookmark'),
  cfExportId: text('cf_export_id'),
  errorMessage: text('error_message'),
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

/**
 * Backup history record type
 */
export interface BackupHistoryRecord {
  id: number;
  triggeredBy: number;
  status: 'pending' | 'running' | 'complete' | 'failed';
  r2Key: string | null;
  r2SizeBytes: number | null;
  cfBookmark: string | null;
  cfExportId: string | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * Backup status type
 */
export type BackupStatus = BackupHistoryRecord['status'];

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
