import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../types.js';
import type { EncryptionAlgorithm, MimeType } from '@dead-drop/engine';
import {
  dropResponseSchema,
  createDropRequestSchema,
  createDropResponseSchema,
  updateDropRequestSchema,
  updateDropResponseSchema,
  deleteDropRequestSchema,
  successResponseSchema,
  errorResponseSchema,
} from '../openapi.js';
import {
  getDropById,
  createDrop,
  updateDrop,
  deleteDrop as deleteDropFromDb,
  countDropVersions,
  TIER_VERSION_LIMITS,
  TIER_NAME_MIN_LENGTHS,
  TIER_MAX_PAYLOAD_SIZES,
  TIER_EXPIRATION_DAYS,
} from '../../db.js';
import {
  computePrivateAdminHash,
  sha256,
  isAlgorithmSupported,
  isMimeTypeAllowed,
} from '@dead-drop/engine';

// ===== Get drop endpoint =====
export const getDropRoute = createRoute({
  method: 'get',
  path: '/drops/{id}',
  tags: ['Drops'],
  summary: 'Retrieve a drop',
  description: 'Get the current version of a drop by its ID.',
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      description: 'SHA-256 hash of the drop name',
      schema: { type: 'string' },
    },
    {
      name: 'I_agree_with_terms_and_conditions',
      in: 'query',
      required: true,
      description: 'Must be true to confirm agreement to terms and conditions',
      schema: { type: 'boolean' },
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: dropResponseSchema,
        },
      },
      description: 'Drop data',
    },
    403: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Terms not agreed',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Drop not found or expired',
    },
  },
});

// ===== Create drop endpoint =====
export const createDropRoute = createRoute({
  method: 'post',
  path: '/drops',
  tags: ['Drops'],
  summary: 'Create a new drop',
  description:
    'Create a new drop with the given parameters. The drop name must not already exist. For private drops, the payload must be encrypted.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createDropRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createDropResponseSchema,
        },
      },
      description: 'Drop created successfully',
    },
    400: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Invalid request',
    },
    401: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Invalid upgrade token',
    },
    402: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Payload exceeds tier limit',
    },
    409: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Drop name already taken',
    },
  },
});

// ===== Update drop endpoint =====
export const updateDropRoute = createRoute({
  method: 'put',
  path: '/drops/{id}',
  tags: ['Drops'],
  summary: 'Update a drop',
  description: 'Update an existing drop. Authentication is required.',
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      description: 'SHA-256 hash of the drop name',
      schema: { type: 'string' },
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateDropRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: updateDropResponseSchema,
        },
      },
      description: 'Drop updated successfully',
    },
    400: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Invalid request',
    },
    401: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Invalid credentials',
    },
    402: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Payload exceeds tier limit',
    },
    403: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Maximum versions reached',
    },
    404: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Drop not found',
    },
  },
});

// ===== Delete drop endpoint =====
export const deleteDropRoute = createRoute({
  method: 'delete',
  path: '/drops/{id}',
  tags: ['Drops'],
  summary: 'Delete a drop',
  description: 'Delete a drop permanently. Authentication is required.',
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      description: 'SHA-256 hash of the drop name',
      schema: { type: 'string' },
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: deleteDropRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: successResponseSchema } },
      description: 'Drop deleted',
    },
    400: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Invalid request',
    },
    401: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Invalid credentials',
    },
    404: {
      content: { 'application/json': { schema: errorResponseSchema } },
      description: 'Drop not found',
    },
  },
});

export function registerDropsRoutes(app: OpenAPIHono<AppEnv>): void {
  // Get drop
  app.openapi(getDropRoute, async (c) => {
    const { id } = c.req.param();
    const { I_agree_with_terms_and_conditions } = c.req.query();

    // Validate terms agreement
    if (I_agree_with_terms_and_conditions !== 'true') {
      return c.json(
        {
          error: {
            code: 'TERMS_NOT_AGREED',
            message:
              'You must agree to the terms and conditions. Set I_agree_with_terms_and_conditions=true.',
          },
        },
        403
      );
    }

    const db = c.env.DB;
    const drop = await getDropById(db, id);
    if (!drop || new Date() > drop.expiresAt) {
      if (drop) c.executionCtx?.waitUntil?.(deleteDropFromDb(db, id));
      return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
    }
    return c.json(
      {
        id: drop.id,
        tier: drop.tier,
        visibility: drop.visibility,
        payload: drop.data ?? '',
        salt: drop.salt,
        iv: drop.iv,
        encryptionAlgo: drop.encryptionAlgo,
        encryptionParams: drop.encryptionParams ? JSON.parse(drop.encryptionParams) : null,
        mimeType: drop.mimeType,
        hashAlgo: drop.hashAlgo as 'sha-256',
        expiresAt: drop.expiresAt.toISOString(),
      },
      200
    );
  });

  // Create drop
  app.openapi(createDropRoute, async (c) => {
    const db = c.env.DB;
    const pepper = c.env.ADMIN_HASH_PEPPER;

    const body = (await c.req.json()) as {
      id: string;
      nameLength: number;
      tier?: 'free' | 'deep';
      visibility: 'private' | 'public';
      payload: string;
      salt: string;
      iv?: string;
      encryptionAlgo?: EncryptionAlgorithm;
      encryptionParams?: { rounds?: number };
      mimeType?: MimeType;
      contentHash?: string;
      adminHash?: string;
      hashAlgo?: string;
    };

    if (body.mimeType && !isMimeTypeAllowed(body.mimeType)) {
      return c.json(
        {
          error: {
            code: 'INVALID_MIME_TYPE',
            message: `Unsupported MIME type: ${body.mimeType}. Only text/plain is supported.`,
          },
        },
        400
      );
    }
    if (body.encryptionAlgo && !isAlgorithmSupported(body.encryptionAlgo)) {
      return c.json(
        {
          error: {
            code: 'INVALID_ALGORITHM',
            message: `Unsupported encryption algorithm: ${body.encryptionAlgo}`,
          },
        },
        400
      );
    }

    const tier: 'free' | 'deep' = body.tier ?? 'free';

    const minNameLength = TIER_NAME_MIN_LENGTHS[tier] ?? 12;
    if (body.nameLength < minNameLength) {
      return c.json(
        {
          error: {
            code: 'INVALID_NAME',
            message: `Drop name must be at least ${minNameLength} characters for ${tier} tier`,
          },
        },
        400
      );
    }

    const payloadSize = new TextEncoder().encode(body.payload).length;
    const maxSize = TIER_MAX_PAYLOAD_SIZES[tier] ?? 10 * 1024;
    if (payloadSize > maxSize) {
      return c.json(
        {
          error: {
            code: 'PAYMENT_REQUIRED',
            message: `Payload exceeds ${(maxSize / 1024).toFixed(0)}KB. Upgrade to Deep drop required.`,
          },
        },
        402
      );
    }

    const existing = await getDropById(db, body.id);
    if (existing) {
      return c.json({ error: { code: 'DROP_EXISTS', message: 'Drop name already taken' } }, 409);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (TIER_EXPIRATION_DAYS[tier] ?? 7));

    let adminHash: string;
    if (body.visibility === 'private') {
      adminHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
    } else {
      // Public drops require adminHash to be provided and non-empty
      if (!body.adminHash || body.adminHash === '') {
        return c.json(
          {
            error: {
              code: 'MISSING_ADMIN_HASH',
              message: 'Public drops require an admin hash. Please provide a password.',
            },
          },
          400
        );
      }
      adminHash = body.adminHash;
    }

    await createDrop(db, {
      id: body.id,
      visibility: body.visibility,
      data: body.payload,
      r2Key: null,
      salt: body.salt,
      iv: body.iv ?? null,
      encryptionAlgo: body.encryptionAlgo,
      encryptionParams: body.encryptionParams,
      mimeType: body.mimeType ?? 'text/plain',
      adminHash,
      hashAlgo: body.hashAlgo ?? 'sha-256',
      tier,
      expiresAt,
    });

    return c.json({ success: true as const, version: 1 as const, tier }, 201);
  });

  // Update drop
  app.openapi(updateDropRoute, async (c) => {
    const { id } = c.req.param();
    const db = c.env.DB;
    const pepper = c.env.ADMIN_HASH_PEPPER;
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
    }

    const body = await c.req.json<{
      payload: string;
      iv?: string;
      mimeType?: MimeType;
      contentHash?: string;
      newContentHash?: string;
      adminPassword?: string;
    }>();

    if (body.mimeType && !isMimeTypeAllowed(body.mimeType)) {
      return c.json(
        {
          error: {
            code: 'INVALID_MIME_TYPE',
            message: `Unsupported MIME type: ${body.mimeType}. Only text/plain is supported.`,
          },
        },
        400
      );
    }

    const payloadSize = new TextEncoder().encode(body.payload).length;
    const maxSize = TIER_MAX_PAYLOAD_SIZES[drop.tier] ?? 10 * 1024;
    if (payloadSize > maxSize) {
      return c.json(
        {
          error: {
            code: 'PAYMENT_REQUIRED',
            message: `Payload exceeds ${(maxSize / 1024).toFixed(0)}KB. Upgrade to Deep drop required.`,
          },
        },
        402
      );
    }

    const versionCount = await countDropVersions(db, id);
    const maxVersions = TIER_VERSION_LIMITS[drop.tier];
    if (versionCount >= maxVersions) {
      return c.json(
        { error: { code: 'VERSION_LIMIT', message: 'Maximum number of versions reached' } },
        403
      );
    }

    // Validate public drop requires adminPassword
    if (drop.visibility === 'public' && (!body.adminPassword || body.adminPassword === '')) {
      return c.json(
        {
          error: {
            code: 'MISSING_ADMIN_PASSWORD',
            message: 'Public drops require an admin password to edit.',
          },
        },
        400
      );
    }

    // adminPassword is validated to be non-empty above for public drops
    const adminPassword = body.adminPassword;

    // Future: Use drop.hashAlgo to select hashing algorithm (v1.1+)
    // Currently only 'sha-256' is supported, so we use SHA-256 directly
    void (drop.hashAlgo ?? 'sha-256');

    let providedHash: string;
    let newAdminHash: string;
    if (drop.visibility === 'private') {
      providedHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
      newAdminHash = await computePrivateAdminHash(
        body.newContentHash ?? body.contentHash ?? '',
        pepper
      );
    } else {
      // adminPassword is validated to be non-empty above, so we can safely cast
      providedHash = await sha256(adminPassword + drop.salt);
      newAdminHash = providedHash;
    }

    if (providedHash !== drop.adminHash) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
    }

    const updated = await updateDrop(db, id, {
      data: body.payload,
      r2Key: null,
      iv: body.iv ?? null,
      mimeType: body.mimeType,
      adminHash: newAdminHash,
    });

    return c.json({ success: true as const, version: updated?.version ?? drop.version + 1 }, 200);
  });

  // Delete drop
  app.openapi(deleteDropRoute, async (c) => {
    const { id } = c.req.param();
    const db = c.env.DB;
    const pepper = c.env.ADMIN_HASH_PEPPER;
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
    }

    const body = await c.req.json<{ contentHash?: string; adminPassword?: string }>();

    // Validate public drop requires adminPassword
    if (drop.visibility === 'public' && (!body.adminPassword || body.adminPassword === '')) {
      return c.json(
        {
          error: {
            code: 'MISSING_ADMIN_PASSWORD',
            message: 'Public drops require an admin password to delete.',
          },
        },
        400
      );
    }

    // adminPassword is validated to be non-empty above for public drops
    const adminPassword = body.adminPassword;

    // Future: Use drop.hashAlgo to select hashing algorithm (v1.1+)
    // Currently only 'sha-256' is supported, so we use SHA-256 directly
    void (drop.hashAlgo ?? 'sha-256');

    let providedHash: string;
    if (drop.visibility === 'private') {
      providedHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
    } else {
      // adminPassword is validated to be non-empty above, so we can safely cast
      providedHash = await sha256(adminPassword + drop.salt);
    }

    if (providedHash !== drop.adminHash) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
    }

    await deleteDropFromDb(db, id);
    return c.json({ success: true as const }, 200);
  });
}
