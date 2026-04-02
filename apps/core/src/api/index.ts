import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import type { AppEnv } from './types.js';
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { healthResponseSchema, successResponseSchema, errorResponseSchema } from './openapi.js';
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
  getDropHistoryList,
  getDropHistoryVersion,
  upgradeDrop,
} from './db.js';
import {
  computePrivateAdminHash,
  sha256,
  isAlgorithmSupported,
  isMimeTypeAllowed,
  generateRandomDropName,
  normalizeDropName,
  computeDropId,
  validateDropName,
} from '@dead-drop/engine';
import {
  checkAvailabilityResponseSchema,
  createDropRequestSchema,
  createDropResponseSchema,
  dropResponseSchema,
  updateDropRequestSchema,
  updateDropResponseSchema,
  deleteDropRequestSchema,
  historyListResponseSchema,
  historyVersionResponseSchema,
  upgradeDropRequestSchema,
  upgradeDropResponseSchema,
  generateNameResponseSchema,
} from './openapi.js';
import type { EncryptionAlgorithm, EncryptionParams, MimeType } from '@dead-drop/engine';
import { securityHeaders } from './middleware.js';

/**
 * Maximum attempts to find an unused name
 */
const MAX_ATTEMPTS = 20;

/**
 * OpenAPI document configuration
 */
const openApiConfig = {
  openapi: '3.1.0',
  info: {
    title: 'dead-drop API',
    version: '1.0.0',
    description:
      'Privacy-focused, ephemeral data-sharing API. The API is open and can be used directly without the frontend.',
    contact: {
      name: 'dead-drop.xyz',
      url: 'https://dead-drop.xyz',
    },
  },
  servers: [
    { url: '/', description: 'Current server' },
    { url: 'https://api.dead-drop.xyz', description: 'Production API' },
  ],
  tags: [
    { name: 'Drops', description: 'Drop CRUD operations' },
    { name: 'History', description: 'Drop version history' },
    { name: 'Health', description: 'Health check endpoints' },
  ],
};

/**
 * Create the main Hono API app with OpenAPI support
 */
export function createApiApp(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

  // robots.txt - block all search engines
  app.get('/robots.txt', (c) => {
    return c.text('User-agent: *\nDisallow: /');
  });

  // Middleware
  app.use('*', securityHeaders);
  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ===== Health check endpoint =====
  const healthRoute = createRoute({
    method: 'get',
    path: '/api/health',
    tags: ['Health'],
    summary: 'Health check',
    description: 'Returns the health status of the API',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: healthResponseSchema,
          },
        },
        description: 'API is healthy',
      },
    },
  });
  app.openapi(healthRoute, (c) => {
    return c.json({ status: 'ok' as const, timestamp: new Date().toISOString() }, 200);
  });

  // ===== OpenAPI spec endpoint =====
  const openapiRoute = createRoute({
    method: 'get',
    path: '/api/docs/openapi.json',
    tags: ['Documentation'],
    summary: 'OpenAPI specification',
    description: 'Returns the OpenAPI 3.1 specification for the API',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.record(z.unknown()),
          },
        },
        description: 'OpenAPI specification',
      },
    },
  });
  // @ts-expect-error - OpenAPI spec returns dynamic object, typing is complex
  app.openapi(openapiRoute, (c: Context) => {
    return c.json(app.getOpenAPIDocument(openApiConfig));
  });

  // ===== Swagger UI endpoint =====
  const docsRoute = createRoute({
    method: 'get',
    path: '/api/docs',
    tags: ['Documentation'],
    summary: 'Swagger UI',
    description: 'Interactive API documentation using Swagger UI',
    responses: {
      200: {
        content: {
          'text/html': {
            schema: {},
          },
        },
        description: 'Swagger UI HTML page',
      },
    },
  });
  app.openapi(docsRoute, (c: Context) => {
    const openapiUrl = new URL('/api/docs/openapi.json', c.req.url).href;
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>dead-drop API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body { margin: 0; background: #fafafa; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({ url: "${openapiUrl}", dom_id: '#swagger-ui', presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset], layout: "BaseLayout" });
    }
  </script>
</body>
</html>`;
    return c.html(html, 200);
  });

  // ===== Generate name endpoint =====
  const generateNameRoute = createRoute({
    method: 'get',
    path: '/api/drops/generate-name',
    tags: ['Drops'],
    summary: 'Generate a random unused drop name',
    description:
      'Generates a random 4-word drop name using the EFF Diceware wordlist and ensures it is not already in use.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: generateNameResponseSchema,
          },
        },
        description: 'A unique random drop name',
      },
      500: {
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
        description: 'Failed to generate unique name',
      },
    },
  });
  app.openapi(generateNameRoute, async (c) => {
    const db = c.env.DB;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const name = generateRandomDropName(4);
      const normalizedName = normalizeDropName(name);
      const validation = validateDropName(normalizedName, 12);
      if (!validation.valid) continue;
      const id = await computeDropId(normalizedName);
      const existing = await getDropById(db, id);
      if (!existing) {
        return c.json({ name: normalizedName, id }, 200);
      }
    }
    return c.json(
      {
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate a unique drop name. Please try again.',
        },
      },
      500
    );
  });

  // ===== Check availability endpoint =====
  const checkRoute = createRoute({
    method: 'get',
    path: '/api/drops/check/{id}',
    tags: ['Drops'],
    summary: 'Check if a drop name is available',
    description:
      'Check if a drop with the given ID exists. Returns 200 with availability status regardless of whether the drop exists.',
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'SHA-256 hash of the drop name',
        schema: { type: 'string' },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: checkAvailabilityResponseSchema,
          },
        },
        description: 'Availability status',
      },
    },
  });
  app.openapi(checkRoute, async (c) => {
    const { id } = c.req.param();
    const db = c.env.DB;
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ id, available: true }, 200);
    }
    if (new Date() > drop.expiresAt) {
      c.executionCtx?.waitUntil?.(deleteDropFromDb(db, id));
      return c.json({ id, available: true }, 200);
    }
    return c.json({ id, available: false }, 200);
  });

  // ===== Get drop endpoint =====
  const getDropRoute = createRoute({
    method: 'get',
    path: '/api/drops/{id}',
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
  app.openapi(getDropRoute, async (c) => {
    const { id } = c.req.param();
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
        expiresAt: drop.expiresAt.toISOString(),
      },
      200
    );
  });

  // ===== Create drop endpoint =====
  const createDropRoute = createRoute({
    method: 'post',
    path: '/api/drops',
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
  app.openapi(createDropRoute, async (c) => {
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

    let tier: 'free' | 'deep' = body.tier ?? 'free';
    if (body.upgradeToken) {
      if (body.upgradeToken === upgradeToken) {
        tier = 'deep';
      } else {
        return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid upgrade token' } }, 401);
      }
    }

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

    const existing = await getDropById(db, body.id);
    if (existing) {
      return c.json({ error: { code: 'DROP_EXISTS', message: 'Drop name already taken' } }, 409);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TIER_EXPIRATION_DAYS[tier]);

    let adminHash: string;
    if (body.visibility === 'private') {
      adminHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
    } else {
      adminHash = body.adminHash ?? '';
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
      tier,
      expiresAt,
    });

    return c.json({ success: true as const, version: 1, tier }, 201);
  });

  // ===== Update drop endpoint =====
  const updateDropRoute = createRoute({
    method: 'put',
    path: '/api/drops/{id}',
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

    const versionCount = await countDropVersions(db, id);
    const maxVersions = TIER_VERSION_LIMITS[drop.tier];
    if (versionCount >= maxVersions) {
      return c.json(
        { error: { code: 'VERSION_LIMIT', message: 'Maximum number of versions reached' } },
        403
      );
    }

    let providedHash: string;
    let newAdminHash: string;
    if (drop.visibility === 'private') {
      providedHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
      newAdminHash = await computePrivateAdminHash(
        body.newContentHash ?? body.contentHash ?? '',
        pepper
      );
    } else {
      providedHash = await sha256((body.adminPassword ?? '') + drop.salt);
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

  // ===== Delete drop endpoint =====
  const deleteDropRoute = createRoute({
    method: 'delete',
    path: '/api/drops/{id}',
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
  app.openapi(deleteDropRoute, async (c) => {
    const { id } = c.req.param();
    const db = c.env.DB;
    const pepper = c.env.ADMIN_HASH_PEPPER;
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
    }

    const body = await c.req.json<{ contentHash?: string; adminPassword?: string }>();

    let providedHash: string;
    if (drop.visibility === 'private') {
      providedHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
    } else {
      providedHash = await sha256((body.adminPassword ?? '') + drop.salt);
    }

    if (providedHash !== drop.adminHash) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
    }

    await deleteDropFromDb(db, id);
    return c.json({ success: true as const }, 200);
  });

  // ===== History list endpoint =====
  const historyListRoute = createRoute({
    method: 'get',
    path: '/api/drops/{id}/history',
    tags: ['History'],
    summary: 'List drop history',
    description: 'Get a list of all versions of a drop.',
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'SHA-256 hash of the drop name',
        schema: { type: 'string' },
      },
    ],
    responses: {
      200: {
        content: { 'application/json': { schema: historyListResponseSchema } },
        description: 'List of versions',
      },
      404: {
        content: { 'application/json': { schema: errorResponseSchema } },
        description: 'Drop not found',
      },
    },
  });
  app.openapi(historyListRoute, async (c) => {
    const { id } = c.req.param();
    const db = c.env.DB;
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
    }

    const historyList = await getDropHistoryList(db, id);
    const versions = [
      { version: drop.version, createdAt: drop.createdAt.toISOString() },
      ...historyList.map((h) => ({ version: h.version, createdAt: h.createdAt.toISOString() })),
    ];

    return c.json(
      {
        versions,
        current: drop.version,
        maxVersions: TIER_VERSION_LIMITS[drop.tier],
      },
      200
    );
  });

  // ===== History version endpoint =====
  const historyVersionRoute = createRoute({
    method: 'get',
    path: '/api/drops/{id}/history/{version}',
    tags: ['History'],
    summary: 'Get specific drop version',
    description: 'Get a specific version of a drop.',
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'SHA-256 hash of the drop name',
        schema: { type: 'string' },
      },
      {
        name: 'version',
        in: 'path',
        required: true,
        description: 'Version number',
        schema: { type: 'integer', minimum: 1 },
      },
    ],
    responses: {
      200: {
        content: { 'application/json': { schema: historyVersionResponseSchema } },
        description: 'Drop version data',
      },
      404: {
        content: { 'application/json': { schema: errorResponseSchema } },
        description: 'Drop or version not found',
      },
    },
  });
  app.openapi(historyVersionRoute, async (c) => {
    const { id, version } = c.req.param();
    const db = c.env.DB;
    const versionNum = parseInt(version, 10);
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
    }

    if (versionNum === drop.version) {
      return c.json(
        {
          version: drop.version,
          payload: drop.data ?? '',
          iv: drop.iv,
          createdAt: drop.createdAt.toISOString(),
        },
        200
      );
    }

    const historyVersion = await getDropHistoryVersion(db, id, versionNum);
    if (!historyVersion) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Version not found' } }, 404);
    }

    return c.json(
      {
        version: historyVersion.version,
        payload: historyVersion.data ?? '',
        iv: historyVersion.iv,
        createdAt: historyVersion.createdAt.toISOString(),
      },
      200
    );
  });

  // ===== Upgrade drop endpoint =====
  const upgradeRoute = createRoute({
    method: 'post',
    path: '/api/drops/{id}/upgrade',
    tags: ['Drops'],
    summary: 'Upgrade a drop to Deep tier',
    description: 'Upgrade a free drop to Deep tier with larger limits.',
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
            schema: upgradeDropRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: upgradeDropResponseSchema } },
        description: 'Drop upgraded',
      },
      400: {
        content: { 'application/json': { schema: errorResponseSchema } },
        description: 'Already upgraded',
      },
      401: {
        content: { 'application/json': { schema: errorResponseSchema } },
        description: 'Invalid token',
      },
      404: {
        content: { 'application/json': { schema: errorResponseSchema } },
        description: 'Drop not found',
      },
    },
  });
  app.openapi(upgradeRoute, async (c) => {
    const { id } = c.req.param();
    const { token } = c.req.valid('json');
    const db = c.env.DB;
    const expectedToken = c.env.UPGRADE_TOKEN;
    const drop = await getDropById(db, id);
    if (!drop) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
    }
    if (drop.tier !== 'free') {
      return c.json(
        { error: { code: 'ALREADY_UPGRADED', message: 'Drop is already upgraded' } },
        400
      );
    }
    if (token !== expectedToken) {
      return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid upgrade token' } }, 401);
    }
    const updated = await upgradeDrop(db, id);
    return c.json(
      {
        success: true as const,
        tier: 'deep' as const,
        expiresAt: updated?.expiresAt.toISOString() ?? '',
      },
      200
    );
  });

  // Error handler
  app.onError((err, c) => {
    console.error('API Error:', err);
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      500
    );
  });

  return app;
}

/**
 * API app instance
 */
export const apiApp = createApiApp();

/**
 * Type export for the app
 */
export type ApiApp = typeof apiApp;
