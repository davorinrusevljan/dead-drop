import { z } from '@hono/zod-openapi';

/**
 * Common response schemas
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().openapi({
      example: 'NOT_FOUND',
      description: 'Error code (machine-readable)',
    }),
    message: z.string().openapi({
      example: 'Drop not found',
      description: 'Error message (human-readable)',
    }),
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
  timestamp: z.string().openapi({
    format: 'date-time',
    example: '2026-04-18T12:00:00.000Z',
    description: 'ISO 8601 timestamp',
  }),
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
 * SHA-256 hash format (64 hex characters)
 */
export const sha256HashSchema = z.string().openapi({
  format: 'hex',
  pattern: '^[a-f0-9]{64}$',
  example: '7c4e8d3a9f1b6e2c8d4a7f3b9e1c5d8a2f6b4e9d3c7a1f8b5e2d9c4a6f3b7e1d',
  description: 'SHA-256 hash (64 hex characters)',
});

/**
 * Hex-encoded 16-byte salt (32 hex characters)
 */
export const saltSchema = z.string().openapi({
  format: 'hex',
  pattern: '^[a-f0-9]{32}$',
  example: 'a1b2c3d4e5f6789012345678abcdef01',
  description: 'Hex-encoded salt (16 bytes = 32 hex characters)',
});

/**
 * Hex-encoded 12-byte IV (24 hex characters)
 */
export const ivSchema = z.string().openapi({
  format: 'hex',
  pattern: '^[a-f0-9]{24}$',
  example: '00112233445566778899aabb',
  description: 'Hex-encoded IV (12 bytes = 24 hex characters)',
});

/**
 * Hex-encoded encrypted payload
 */
export const encryptedPayloadSchema = z.string().openapi({
  format: 'hex',
  pattern: '^[a-f0-9]+$',
  example:
    '8f9e1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  description: 'Hex-encoded AES-GCM encrypted data',
});

/**
 * Drop response schema
 */
export const dropResponseSchema = z.object({
  id: sha256HashSchema.openapi({ description: 'SHA-256 hash of drop name' }),
  tier: dropTierSchema,
  visibility: dropVisibilitySchema,
  payload: z.string().openapi({ description: 'Encrypted (hex) or plaintext data' }),
  salt: saltSchema,
  iv: ivSchema.nullable().openapi({
    description: 'Hex-encoded IV (12 bytes = 24 hex chars), null for public drops',
  }),
  encryptionAlgo: encryptionAlgoSchema.nullable().openapi({
    description: 'Encryption algorithm used, null for public drops',
  }),
  encryptionParams: encryptionParamsSchema.nullable().openapi({
    description: 'Encryption parameters (JSON object)',
  }),
  mimeType: mimeTypeSchema.openapi({
    description: 'MIME type of the drop content',
  }),
  expiresAt: z.string().openapi({
    format: 'date-time',
    example: '2026-04-25T12:00:00.000Z',
    description: 'ISO 8601 timestamp when drop expires',
  }),
});

/**
 * Check availability response schema
 */
export const checkAvailabilityResponseSchema = z.object({
  id: sha256HashSchema.openapi({ description: 'Drop ID (SHA-256 hash)' }),
  available: z.boolean().openapi({ description: 'Whether drop name is available' }),
});

/**
 * Create drop request schema
 */
export const createDropRequestSchema = z.object({
  id: sha256HashSchema.openapi({ description: 'SHA-256 hash of normalized drop name' }),
  nameLength: z.number().int().min(3).openapi({
    example: 12,
    description: 'Length of normalized name for validation (min 3 for Deep, 12 for Free)',
  }),
  tier: dropTierSchema.optional().openapi({ description: 'Drop tier, defaults to free' }),
  visibility: dropVisibilitySchema.openapi({ description: 'Drop visibility type' }),
  payload: z.string().openapi({
    example:
      '8f9e1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    description:
      'AES-GCM encrypted data (hex-encoded) for private drops, plaintext for public drops',
  }),
  salt: saltSchema,
  iv: ivSchema.optional().openapi({
    description: 'Hex-encoded IV (12 bytes = 24 hex chars), required for private drops',
  }),
  encryptionAlgo: encryptionAlgoSchema.optional().openapi({
    description: 'Encryption algorithm, defaults to pbkdf2-aes256-gcm-v1 for private drops',
  }),
  encryptionParams: encryptionParamsSchema.optional().openapi({
    description: 'Encryption parameters (JSON object)',
  }),
  mimeType: mimeTypeSchema.optional().openapi({ description: 'MIME type, defaults to text/plain' }),
  contentHash: sha256HashSchema.optional().openapi({
    description: 'SHA-256 hash of content payload JSON, required for private drops',
  }),
  adminHash: sha256HashSchema.optional().openapi({
    description: 'SHA-256(adminPassword + salt), required for public drops',
  }),
  upgradeToken: z.string().optional().openapi({
    example: 'dead-drop-upgrade-token-xyz123',
    description: 'Token for upgrading to Deep tier',
  }),
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
    example:
      '8f9e1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    description:
      'AES-GCM encrypted data (hex-encoded) for private drops, plaintext for public drops',
  }),
  iv: ivSchema.optional().openapi({
    description: 'Hex-encoded IV (12 bytes = 24 hex chars), required for private drops',
  }),
  mimeType: mimeTypeSchema.optional().openapi({ description: 'MIME type' }),
  contentHash: sha256HashSchema.optional().openapi({
    description: 'SHA-256 hash of OLD content payload JSON, required for private drops',
  }),
  newContentHash: sha256HashSchema.optional().openapi({
    description: 'SHA-256 hash of NEW content payload JSON, required for private drops',
  }),
  adminPassword: z.string().min(1).optional().openapi({
    example: 'my-secret-admin-password',
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
  contentHash: sha256HashSchema.optional().openapi({
    description: 'SHA-256 hash of content payload JSON, required for private drops',
  }),
  adminPassword: z.string().min(1).optional().openapi({
    example: 'my-secret-admin-password',
    description: 'Admin password for authentication, required for public drops',
  }),
});

/**
 * History version item schema
 */
export const historyVersionItemSchema = z.object({
  version: z.number().int().positive().openapi({ example: 1, description: 'Version number' }),
  createdAt: z.string().openapi({
    format: 'date-time',
    example: '2026-04-18T10:00:00.000Z',
    description: 'ISO 8601 timestamp',
  }),
});

/**
 * History list response schema
 */
export const historyListResponseSchema = z.object({
  versions: z.array(historyVersionItemSchema).openapi({ description: 'List of drop versions' }),
  current: z
    .number()
    .int()
    .positive()
    .openapi({ example: 3, description: 'Current version number' }),
  maxVersions: z
    .number()
    .int()
    .positive()
    .openapi({ example: 10, description: 'Maximum number of versions allowed' }),
});

/**
 * History version response schema
 */
export const historyVersionResponseSchema = z.object({
  version: z.number().int().positive().openapi({ example: 2, description: 'Version number' }),
  payload: z.string().openapi({ description: 'Encrypted (hex) or plaintext data' }),
  iv: ivSchema.nullable().openapi({
    description: 'Hex-encoded IV (12 bytes = 24 hex chars), null for public drops',
  }),
  createdAt: z.string().openapi({
    format: 'date-time',
    example: '2026-04-18T10:30:00.000Z',
    description: 'ISO 8601 timestamp when this version was created',
  }),
});

/**
 * Upgrade drop request schema
 */
export const upgradeDropRequestSchema = z.object({
  token: z.string().openapi({
    example: 'dead-drop-upgrade-token-xyz123',
    description: 'Upgrade token for Deep tier',
  }),
});

/**
 * Upgrade drop response schema
 */
export const upgradeDropResponseSchema = z.object({
  success: z.literal(true),
  tier: z.literal('deep'),
  expiresAt: z.string().openapi({
    format: 'date-time',
    example: '2026-07-17T12:00:00.000Z',
    description: 'ISO 8601 timestamp when upgraded drop expires',
  }),
});

/**
 * Generate name response schema
 */
export const generateNameResponseSchema = z.object({
  name: z.string().openapi({
    example: 'abacus-abide-ablaze-able',
    description: 'Generated 4-word drop name (kebab-case, lowercase)',
  }),
  id: sha256HashSchema.openapi({ description: 'SHA-256 hash of the name' }),
});
