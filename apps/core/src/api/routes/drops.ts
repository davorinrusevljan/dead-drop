import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
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
} from '../db.js';
import {
  computePrivateAdminHash,
  sha256,
  isAlgorithmSupported,
  isMimeTypeAllowed,
  type EncryptionAlgorithm,
  type EncryptionParams,
  type MimeType,
} from '@dead-drop/engine';

/**
 * Drop routes
 */
const drops = new Hono<AppEnv>();

/**
 * GET /api/drops/:id - Retrieve a drop
 */
drops.get('/api/drops/:id', async (c) => {
  const { id } = c.req.param();
  const db = c.env.DB;

  const drop = await getDropById(db, id);

  if (!drop) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Drop not found',
        },
      },
      404
    );
  }

  // Check if expired
  if (new Date() > drop.expiresAt) {
    // Trigger async deletion (fire and forget)
    c.executionCtx?.waitUntil?.(deleteDropFromDb(db, id));
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Drop not found',
        },
      },
      404
    );
  }

  // Return drop data
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
      expiresAt: drop.expiresAt.toISOString(),
    },
    200
  );
});

/**
 * POST /api/drops - Create a new drop
 */
drops.post('/api/drops', async (c) => {
  const db = c.env.DB;
  const pepper = c.env.ADMIN_HASH_PEPPER;
  const upgradeToken = c.env.UPGRADE_TOKEN;

  const body = await c.req.json<{
    id: string;
    nameLength: number;
    tier?: 'free' | 'deep';
    visibility: 'private' | 'public';
    payload: string;
    salt: string;
    iv?: string;
    encryptionAlgo?: EncryptionAlgorithm;
    encryptionParams?: EncryptionParams;
    mimeType?: MimeType;
    contentHash?: string;
    adminHash?: string;
    upgradeToken?: string;
  }>();

  // Validate MIME type - only text/plain is allowed in core edition
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

  // Validate encryption algorithm if provided
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

  // Determine tier based on upgrade token
  let tier: 'free' | 'deep' = body.tier ?? 'free';
  if (body.upgradeToken) {
    if (body.upgradeToken === upgradeToken) {
      tier = 'deep';
    } else {
      return c.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid upgrade token',
          },
        },
        401
      );
    }
  }

  // Validate name length
  const minNameLength = TIER_NAME_MIN_LENGTHS[tier];
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

  // Validate payload size
  const payloadSize = new TextEncoder().encode(body.payload).length;
  const maxSize = TIER_MAX_PAYLOAD_SIZES[tier];
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

  // Check if drop already exists
  const existing = await getDropById(db, body.id);
  if (existing) {
    return c.json(
      {
        error: {
          code: 'DROP_EXISTS',
          message: 'Drop name already taken',
        },
      },
      409
    );
  }

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TIER_EXPIRATION_DAYS[tier]);

  // Calculate admin hash based on visibility
  let adminHash: string;
  if (body.visibility === 'private') {
    adminHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
  } else {
    adminHash = body.adminHash ?? '';
  }

  // Create the drop
  await createDrop(db, {
    id: body.id,
    visibility: body.visibility,
    data: body.payload,
    r2Key: null, // Core edition doesn't use R2
    salt: body.salt,
    iv: body.iv ?? null,
    encryptionAlgo: body.encryptionAlgo,
    encryptionParams: body.encryptionParams,
    mimeType: body.mimeType ?? 'text/plain',
    adminHash,
    tier,
    expiresAt,
  });

  return c.json(
    {
      success: true,
      version: 1,
      tier,
    },
    201
  );
});

/**
 * PUT /api/drops/:id - Update a drop
 */
drops.put('/api/drops/:id', async (c) => {
  const { id } = c.req.param();
  const db = c.env.DB;
  const pepper = c.env.ADMIN_HASH_PEPPER;

  const drop = await getDropById(db, id);
  if (!drop) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Drop not found',
        },
      },
      404
    );
  }

  const body = await c.req.json<{
    payload: string;
    iv?: string;
    mimeType?: MimeType;
    contentHash?: string;
    newContentHash?: string;
    adminPassword?: string;
  }>();

  // Validate MIME type - only text/plain is allowed in core edition
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

  // Validate payload size
  const payloadSize = new TextEncoder().encode(body.payload).length;
  const maxSize = TIER_MAX_PAYLOAD_SIZES[drop.tier];
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

  // Check version limit
  const versionCount = await countDropVersions(db, id);
  const maxVersions = TIER_VERSION_LIMITS[drop.tier];
  if (versionCount >= maxVersions) {
    return c.json(
      {
        error: {
          code: 'VERSION_LIMIT',
          message: 'Maximum number of versions reached',
        },
      },
      403
    );
  }

  // Verify admin credentials
  let providedHash: string;
  let newAdminHash: string;
  if (drop.visibility === 'private') {
    // Verify with the OLD content hash
    providedHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
    // Store the NEW content hash for future authentications
    newAdminHash = await computePrivateAdminHash(
      body.newContentHash ?? body.contentHash ?? '',
      pepper
    );
  } else {
    providedHash = await sha256((body.adminPassword ?? '') + drop.salt);
    newAdminHash = providedHash;
  }

  if (providedHash !== drop.adminHash) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      },
      401
    );
  }

  // Update the drop - store the NEW admin hash for future edits
  const updated = await updateDrop(db, id, {
    data: body.payload,
    r2Key: null,
    iv: body.iv ?? null,
    mimeType: body.mimeType,
    adminHash: newAdminHash,
  });

  return c.json(
    {
      success: true,
      version: updated?.version ?? drop.version + 1,
    },
    200
  );
});

/**
 * DELETE /api/drops/:id - Delete a drop
 */
drops.delete('/api/drops/:id', async (c) => {
  const { id } = c.req.param();
  const db = c.env.DB;
  const pepper = c.env.ADMIN_HASH_PEPPER;

  const drop = await getDropById(db, id);
  if (!drop) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Drop not found',
        },
      },
      404
    );
  }

  const body = await c.req.json<{
    contentHash?: string;
    adminPassword?: string;
  }>();

  // Verify admin credentials
  let providedHash: string;
  if (drop.visibility === 'private') {
    providedHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
  } else {
    providedHash = await sha256((body.adminPassword ?? '') + drop.salt);
  }

  if (providedHash !== drop.adminHash) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      },
      401
    );
  }

  // Delete the drop
  await deleteDropFromDb(db, id);

  return c.json(
    {
      success: true,
    },
    200
  );
});

export { drops as dropRoutes };
