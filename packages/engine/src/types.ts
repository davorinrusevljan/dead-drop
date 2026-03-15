import { z } from 'zod';

/**
 * Drop Content Payload Types
 * Used for wrapping text and file data before encryption/upload
 */

export const textPayloadSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
});

export const filePayloadSchema = z.object({
  type: z.literal('file'),
  mime: z.string(),
  name: z.string(),
  /** Base64 encoded data */
  data: z.string(),
});

export const dropContentPayloadSchema = z.discriminatedUnion('type', [
  textPayloadSchema,
  filePayloadSchema,
]);

export type TextPayload = z.infer<typeof textPayloadSchema>;
export type FilePayload = z.infer<typeof filePayloadSchema>;
export type DropContentPayload = z.infer<typeof dropContentPayloadSchema>;

/**
 * Drop Visibility Types
 * - Protected: Zero-knowledge encryption, password required to read AND edit
 * - Public: Plaintext, anyone can read, password required only to edit
 */
export const dropVisibilitySchema = z.enum(['protected', 'public']);
export type DropVisibility = z.infer<typeof dropVisibilitySchema>;

/**
 * Drop Tier Types
 * - Standard (free): Max 10KB, text only, 7-day lifespan, phrase >= 8 chars
 * - Deep (paid): Max 4MB, supports files, 90-day lifespan, phrase >= 3 chars
 */
export const dropTierSchema = z.enum(['free', 'deep']);
export type DropTier = z.infer<typeof dropTierSchema>;

/**
 * Payment Status
 */
export const paymentStatusSchema = z.enum(['none', 'pending', 'completed']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/**
 * Audit Log Action Types
 */
export const auditActionSchema = z.enum(['created', 'edited', 'deleted']);
export type AuditAction = z.infer<typeof auditActionSchema>;

/**
 * Check if a payload is a text payload
 */
export function isTextPayload(payload: DropContentPayload): payload is TextPayload {
  return payload.type === 'text';
}

/**
 * Check if a payload is a file payload
 */
export function isFilePayload(payload: DropContentPayload): payload is FilePayload {
  return payload.type === 'file';
}
