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
export const dropVisibilitySchema = z.enum(['private', 'public']).openapi({
  example: 'private',
  description: 'Drop visibility type. Private drops are encrypted, public drops are plaintext.',
});

/**
 * Drop tier schema
 */
export const dropTierSchema = z.enum(['free', 'deep']).openapi({
  example: 'free',
  description: 'Drop tier. Free: 10KB, 7 days. Deep: 4MB, 90 days.',
});

/**
 * Encryption algorithm schema
 */
export const encryptionAlgoSchema = z
  .enum(['pbkdf2-aes256-gcm-v1', 'xchacha20-poly1305-v1', 'argon2id-xchacha20-v1'])
  .openapi({
    example: 'pbkdf2-aes256-gcm-v1',
    description:
      'Encryption algorithm used for private drops. Current: pbkdf2-aes256-gcm-v1 (PBKDF2 + AES-256-GCM)',
  });

/**
 * MIME type schema
 */
export const mimeTypeSchema = z.enum(['text/plain', 'application/json']).openapi({
  example: 'text/plain',
  description: 'MIME type of the drop content',
});

/**
 * Encryption params schema
 */
export const encryptionParamsSchema = z
  .object({
    rounds: z.number().int().optional(),
  })
  .optional()
  .openapi({
    description: 'Additional encryption parameters',
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
  encryptionAlgo: encryptionAlgoSchema.nullable().openapi({
    description: 'Encryption algorithm used, null for public drops',
  }),
  encryptionParams: encryptionParamsSchema.nullable().openapi({
    description: 'Encryption parameters',
  }),
  mimeType: mimeTypeSchema.openapi({
    description: 'MIME type of the drop content',
  }),
  expiresAt: z.string().openapi({ description: 'ISO 8601 timestamp' }),
});

/**
 * Check availability response schema
 */
export const checkAvailabilityResponseSchema = z.object({
  id: z.string().openapi({ description: 'Drop ID' }),
  available: z.boolean().openapi({ description: 'Whether drop name is available' }),
});

/**
 * Create drop request schema
 */
export const createDropRequestSchema = z.object({
  id: z.string().openapi({ description: 'SHA-256 hash of normalized drop name' }),
  nameLength: z
    .number()
    .int()
    .min(3)
    .openapi({ description: 'Length of normalized name for validation' }),
  tier: dropTierSchema.optional().openapi({ description: 'Drop tier, defaults to free' }),
  visibility: dropVisibilitySchema.openapi({ description: 'Drop visibility type' }),
  payload: z.string().openapi({
    description:
      'AES-GCM encrypted data (hex-encoded) for private drops, plaintext for public drops',
  }),
  salt: z.string().openapi({ description: 'Hex-encoded salt (16 bytes)' }),
  iv: z
    .string()
    .optional()
    .openapi({ description: 'Hex-encoded IV (12 bytes), required for private drops' }),
  encryptionAlgo: encryptionAlgoSchema.optional().openapi({
    description: 'Encryption algorithm, defaults to aes-256-gcm for private drops',
  }),
  encryptionParams: encryptionParamsSchema.optional().openapi({
    description: 'Encryption parameters',
  }),
  mimeType: mimeTypeSchema.optional().openapi({ description: 'MIME type, defaults to text/plain' }),
  contentHash: z.string().optional().openapi({
    description: 'SHA-256 hash of content payload JSON, required for private drops',
  }),
  adminHash: z.string().optional().openapi({
    description: 'SHA-256(adminPassword + salt), required for public drops',
  }),
  upgradeToken: z.string().optional().openapi({ description: 'Token for upgrading to Deep tier' }),
});

/**
 * Create drop response schema
 */
export const createDropResponseSchema = z.object({
  success: z.literal(true),
  version: z.literal(1),
  tier: dropTierSchema,
});

/**
 * Update drop request schema
 */
export const updateDropRequestSchema = z.object({
  payload: z.string().openapi({
    description:
      'AES-GCM encrypted data (hex-encoded) for private drops, plaintext for public drops',
  }),
  iv: z
    .string()
    .optional()
    .openapi({ description: 'Hex-encoded IV (12 bytes), required for private drops' }),
  mimeType: mimeTypeSchema.optional().openapi({ description: 'MIME type' }),
  contentHash: z.string().optional().openapi({
    description: 'SHA-256 hash of OLD content payload JSON, required for private drops',
  }),
  newContentHash: z.string().optional().openapi({
    description: 'SHA-256 hash of NEW content payload JSON, required for private drops',
  }),
  adminPassword: z.string().optional().openapi({
    description: 'Admin password for authentication, required for public drops',
  }),
});

/**
 * Update drop response schema
 */
export const updateDropResponseSchema = z.object({
  success: z.literal(true),
  version: z.number().int().positive().openapi({ description: 'New version number' }),
});

/**
 * Delete drop request schema
 */
export const deleteDropRequestSchema = z.object({
  contentHash: z.string().optional().openapi({
    description: 'SHA-256 hash of content payload JSON, required for private drops',
  }),
  adminPassword: z.string().optional().openapi({
    description: 'Admin password for authentication, required for public drops',
  }),
});

/**
 * History version item schema
 */
export const historyVersionItemSchema = z.object({
  version: z.number().int().positive(),
  createdAt: z.string().openapi({ description: 'ISO 8601 timestamp' }),
});

/**
 * History list response schema
 */
export const historyListResponseSchema = z.object({
  versions: z.array(historyVersionItemSchema).openapi({ description: 'List of drop versions' }),
  current: z.number().int().positive().openapi({ description: 'Current version number' }),
  maxVersions: z
    .number()
    .int()
    .positive()
    .openapi({ description: 'Maximum number of versions allowed' }),
});

/**
 * History version response schema
 */
export const historyVersionResponseSchema = z.object({
  version: z.number().int().positive(),
  payload: z.string().openapi({ description: 'Encrypted or plaintext data' }),
  iv: z
    .string()
    .nullable()
    .openapi({ description: 'Hex-encoded IV (12 bytes), null for public drops' }),
  createdAt: z.string().openapi({ description: 'ISO 8601 timestamp' }),
});

/**
 * Upgrade drop request schema
 */
export const upgradeDropRequestSchema = z.object({
  token: z.string().openapi({ description: 'Upgrade token for Deep tier' }),
});

/**
 * Upgrade drop response schema
 */
export const upgradeDropResponseSchema = z.object({
  success: z.literal(true),
  tier: z.literal('deep'),
  expiresAt: z.string().openapi({ description: 'ISO 8601 timestamp' }),
});

/**
 * Generate name response schema
 */
export const generateNameResponseSchema = z.object({
  name: z
    .string()
    .openapi({ example: 'abacus-abide-ablaze-able', description: 'Generated drop name' }),
  id: z.string().openapi({ example: 'abc123...', description: 'SHA-256 hash of the name' }),
});
