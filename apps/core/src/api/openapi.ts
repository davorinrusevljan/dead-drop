import { z } from '@hono/zod-openapi';

/**
 * Common response schemas
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const successResponseSchema = z.object({
  success: z.literal(true),
});

/**
 * Health check response schema
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
});

/**
 * Drop visibility schema
 */
export const dropVisibilitySchema = z.enum(['protected', 'public']).openapi({
  example: 'protected',
  description: 'Drop visibility type',
});

/**
 * Drop tier schema
 */
export const dropTierSchema = z.enum(['free', 'deep']).openapi({
  example: 'free',
  description: 'Drop tier',
});

/**
 * Drop response schema
 */
export const dropResponseSchema = z.object({
  id: z.string().openapi({ example: 'abc123...', description: 'SHA-256 hash of drop name' }),
  tier: dropTierSchema,
  visibility: dropVisibilitySchema,
  payload: z.string().openapi({ description: 'Encrypted or plaintext data' }),
  salt: z.string().openapi({ description: 'Hex-encoded salt (16 bytes)' }),
  iv: z
    .string()
    .nullable()
    .openapi({ description: 'Hex-encoded IV (12 bytes), null for public drops' }),
  expiresAt: z.string().openapi({ description: 'ISO 8601 timestamp' }),
});

/**
 * Create drop request schema (protected)
 */
export const createProtectedDropSchema = z.object({
  id: z.string().openapi({ description: 'SHA-256 hash of normalized drop name' }),
  nameLength: z
    .number()
    .int()
    .min(3)
    .openapi({ description: 'Length of normalized name for validation' }),
  tier: dropTierSchema,
  visibility: z.literal('protected'),
  payload: z.string().openapi({ description: 'AES-GCM encrypted data (hex-encoded)' }),
  salt: z.string().openapi({ description: 'Hex-encoded salt (16 bytes)' }),
  iv: z.string().openapi({ description: 'Hex-encoded IV (12 bytes)' }),
  contentHash: z.string().openapi({ description: 'SHA-256 hash of content payload JSON' }),
  upgradeToken: z.string().optional().openapi({ description: 'Token for upgrading to Deep tier' }),
});

/**
 * Create drop request schema (public)
 */
export const createPublicDropSchema = z.object({
  id: z.string().openapi({ description: 'SHA-256 hash of normalized drop name' }),
  nameLength: z
    .number()
    .int()
    .min(3)
    .openapi({ description: 'Length of normalized name for validation' }),
  tier: dropTierSchema,
  visibility: z.literal('public'),
  payload: z.string().openapi({ description: 'Plaintext data' }),
  salt: z.string().openapi({ description: 'Hex-encoded salt (16 bytes)' }),
  adminHash: z.string().openapi({ description: 'SHA-256(adminPassword + salt)' }),
  upgradeToken: z.string().optional().openapi({ description: 'Token for upgrading to Deep tier' }),
});

/**
 * Create drop request union
 */
export const createDropSchema = z.discriminatedUnion('visibility', [
  createProtectedDropSchema,
  createPublicDropSchema,
]);

/**
 * Create drop response schema
 */
export const createDropResponseSchema = z.object({
  success: z.literal(true),
  version: z.literal(1),
  tier: dropTierSchema,
});

/**
 * Update drop request schema (protected)
 */
export const updateProtectedDropSchema = z.object({
  payload: z.string().openapi({ description: 'AES-GCM encrypted data (hex-encoded)' }),
  iv: z.string().openapi({ description: 'Hex-encoded IV (12 bytes)' }),
  contentHash: z.string().openapi({ description: 'SHA-256 hash of content payload JSON' }),
});

/**
 * Update drop request schema (public)
 */
export const updatePublicDropSchema = z.object({
  payload: z.string().openapi({ description: 'Plaintext data' }),
  adminPassword: z.string().openapi({ description: 'Admin password for authentication' }),
});

/**
 * Update drop response schema
 */
export const updateDropResponseSchema = z.object({
  success: z.literal(true),
  version: z.number().int().positive(),
});

/**
 * Delete drop request schema (protected)
 */
export const deleteProtectedDropSchema = z.object({
  contentHash: z.string().openapi({ description: 'SHA-256 hash of content payload JSON' }),
});

/**
 * Delete drop request schema (public)
 */
export const deletePublicDropSchema = z.object({
  adminPassword: z.string().openapi({ description: 'Admin password for authentication' }),
});

/**
 * History list response schema
 */
export const historyListResponseSchema = z.object({
  versions: z.array(
    z.object({
      version: z.number().int().positive(),
      createdAt: z.string(),
    })
  ),
  current: z.number().int().positive(),
  maxVersions: z.number().int().positive(),
});

/**
 * History version response schema
 */
export const historyVersionResponseSchema = z.object({
  version: z.number().int().positive(),
  payload: z.string(),
  iv: z.string().nullable(),
  createdAt: z.string(),
});

/**
 * Upgrade drop request schema
 */
export const upgradeDropSchema = z.object({
  token: z.string().openapi({ description: 'Upgrade token' }),
});

/**
 * Upgrade drop response schema
 */
export const upgradeDropResponseSchema = z.object({
  success: z.literal(true),
  tier: z.literal('deep'),
  expiresAt: z.string(),
});
