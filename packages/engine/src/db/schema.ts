import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Drops table - Main drop storage
 */
export const drops = sqliteTable('drops', {
  /** SHA-256(normalizedName) - Primary key */
  id: text('id').primaryKey(),
  /** Current version number */
  version: integer('version').default(1).notNull(),
  /** Encrypted/text data - Null if payload > 10KB */
  data: text('data'),
  /** R2 object key - Null if payload <= 10KB */
  r2Key: text('r2_key'),
  /** Visibility: 'private' | 'public' */
  visibility: text('visibility').default('private').notNull(),
  /** Hex-encoded salt (16 bytes) */
  salt: text('salt').notNull(),
  /** Hex-encoded IV (12 bytes) - Null if public */
  iv: text('iv'),
  /** Encryption algorithm identifier */
  encryptionAlgo: text('encryption_algo').default('pbkdf2-aes256-gcm-v1').notNull(),
  /** Algorithm-specific parameters (JSON string) */
  encryptionParams: text('encryption_params'),
  /** MIME type of the content */
  mimeType: text('mime_type').default('text/plain').notNull(),
  /** SHA-256(contentHash + PEPPER) for private, SHA-256(adminPassword + salt) for public */
  adminHash: text('admin_hash').notNull(),
  /** Tier: 'free' | 'deep' */
  tier: text('tier').default('free').notNull(),
  /** Payment status: 'none' | 'pending' | 'completed' */
  paymentStatus: text('payment_status').default('none').notNull(),
  /** Expiration timestamp */
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  /** Creation timestamp */
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Drop history table - Version history for drops
 */
export const dropHistory = sqliteTable('drop_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Reference to drop */
  dropId: text('drop_id')
    .notNull()
    .references(() => drops.id),
  /** Version number */
  version: integer('version').notNull(),
  /** Historical data - Null if payload > 10KB */
  data: text('data'),
  /** Historical R2 key - Null if payload <= 10KB */
  r2Key: text('r2_key'),
  /** Historical IV - Null if public */
  iv: text('iv'),
  /** Historical encryption algorithm identifier */
  encryptionAlgo: text('encryption_algo'),
  /** Historical algorithm-specific parameters (JSON string) */
  encryptionParams: text('encryption_params'),
  /** Historical MIME type */
  mimeType: text('mime_type'),
  /** Creation timestamp */
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Audit log table - Tracks drop lifecycle events
 * Contains NO client identifiers (no IP, user agent, etc.)
 */
export const dropAuditLog = sqliteTable('drop_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** SHA-256 hash - non-reversible */
  dropId: text('drop_id').notNull(),
  /** Action: 'created' | 'edited' | 'deleted' */
  action: text('action').notNull(),
  /** Version number (null for 'deleted') */
  version: integer('version'),
  /** Creation timestamp */
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
