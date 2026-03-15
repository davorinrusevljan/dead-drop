/**
 * Drop Content Payload Types
 * Used for wrapping text and file data before encryption/upload
 */

export type TextPayload = {
  type: 'text';
  content: string;
};

export type FilePayload = {
  type: 'file';
  mime: string;
  name: string;
  /** Base64 encoded data */
  data: string;
};

export type DropContentPayload = TextPayload | FilePayload;

/**
 * Drop Visibility Types
 * - Protected: Zero-knowledge encryption, password required to read AND edit
 * - Public: Plaintext, anyone can read, password required only to edit
 */
export type DropVisibility = 'protected' | 'public';

/**
 * Drop Tier Types
 * - Standard (free): Max 10KB, text only, 7-day lifespan, phrase >= 8 chars
 * - Deep (paid): Max 4MB, supports files, 90-day lifespan, phrase >= 3 chars
 */
export type DropTier = 'free' | 'deep';

/**
 * Payment Status
 */
export type PaymentStatus = 'none' | 'pending' | 'completed';

/**
 * Drop Record (as stored in D1)
 */
export type DropRecord = {
  id: string;
  version: number;
  data: string | null;
  r2Key: string | null;
  visibility: DropVisibility;
  salt: string;
  iv: string | null;
  adminHash: string;
  tier: DropTier;
  paymentStatus: PaymentStatus;
  expiresAt: Date;
  createdAt: Date;
};

/**
 * Drop History Record
 */
export type DropHistoryRecord = {
  id: number;
  dropId: string;
  version: number;
  data: string | null;
  r2Key: string | null;
  iv: string | null;
  createdAt: Date;
};

/**
 * Audit Log Action Types
 */
export type AuditAction = 'created' | 'edited' | 'deleted';

/**
 * Audit Log Record
 */
export type AuditLogRecord = {
  id: number;
  dropId: string;
  action: AuditAction;
  version: number | null;
  createdAt: Date;
};
