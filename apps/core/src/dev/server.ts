/**
 * Local development server for dead-drop API
 * Runs the Hono API directly on Node.js with SQLite
 */

/* eslint-disable no-console -- CLI server requires console output */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  LocalDatabase,
  TIER_VERSION_LIMITS,
  TIER_NAME_MIN_LENGTHS,
  TIER_MAX_PAYLOAD_SIZES,
  TIER_EXPIRATION_DAYS,
} from './db-local.js';
import {
  computePrivateAdminHash,
  sha256,
  isAlgorithmSupported,
  isMimeTypeAllowed,
  generateDropNameSuggestions,
  type EncryptionAlgorithm,
  type EncryptionParams,
  type MimeType,
} from '@dead-drop/engine';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration - Use 9090 as default (8787 often blocked in containers)
const DEFAULT_PORT = 9090;
const PORT = parseInt(process.env.API_PORT || String(DEFAULT_PORT), 10);
const DB_PATH = join(__dirname, '../../.wrangler/state/local.db');
const SCHEMA_PATH = join(__dirname, '../../schema.sql');

// Load dev secrets
function loadDevVars(): { ADMIN_HASH_PEPPER: string; UPGRADE_TOKEN: string } {
  const devVarsPath = join(__dirname, '../../.dev.vars');
  if (!existsSync(devVarsPath)) {
    console.warn('Warning: .dev.vars not found, using defaults');
    return {
      ADMIN_HASH_PEPPER: 'dev-pepper',
      UPGRADE_TOKEN: 'dev-upgrade-token',
    };
  }

  const content = readFileSync(devVarsPath, 'utf-8');
  const vars: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      vars[key] = value;
    }
  }

  return {
    ADMIN_HASH_PEPPER: vars.ADMIN_HASH_PEPPER || 'dev-pepper',
    UPGRADE_TOKEN: vars.UPGRADE_TOKEN || 'dev-upgrade-token',
  };
}

// Initialize database
console.log('Initializing local database...');
const db = new LocalDatabase(DB_PATH, SCHEMA_PATH);
const devVars = loadDevVars();

// Create Hono app
const app = new Hono();

// Apply middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'dead-drop API',
    version: '1.0.0',
    status: 'running',
    mode: 'local-development',
  });
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generate name
app.get('/api/drops/generate-name', (c) => {
  const names = generateDropNameSuggestions(1, 4);
  const name = names[0]!;
  return c.json({ name, id: 'preview-only' });
});

// OpenAPI docs
app.get('/api/docs', (c) => {
  return c.html(`
<!DOCTYPE html>
<html>
<head>
  <title>dead-drop API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/openapi.json',
      dom_id: '#swagger-ui',
    });
  </script>
</body>
</html>
  `);
});

app.get('/api/docs/openapi.json', (c) => {
  return c.json({
    openapi: '3.0.0',
    info: {
      title: 'dead-drop API (Local Dev)',
      version: '1.0.0',
      description: 'Local development API for dead-drop',
    },
    paths: {
      '/api/health': {
        get: { summary: 'Health check', responses: { '200': { description: 'OK' } } },
      },
      '/api/drops/generate-name': {
        get: {
          summary: 'Generate a random drop name',
          responses: { '200': { description: 'Name generated' } },
        },
      },
      '/api/drops/{id}': {
        get: { summary: 'Get a drop', parameters: [{ name: 'id', in: 'path', required: true }] },
        put: { summary: 'Update a drop' },
        delete: { summary: 'Delete a drop' },
      },
      '/api/drops': {
        post: { summary: 'Create a drop' },
      },
    },
  });
});

// GET /api/drops/:id - Retrieve a drop
app.get('/api/drops/:id', async (c) => {
  const { id } = c.req.param();
  const drop = await db.getDropById(id);

  if (!drop) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
  }

  // Check if expired
  if (new Date() > drop.expiresAt) {
    db.deleteDrop(id).catch(() => {});
    return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
  }

  return c.json({
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
  });
});

// POST /api/drops - Create a new drop
app.post('/api/drops', async (c) => {
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

  // Validate MIME type
  if (body.mimeType && !isMimeTypeAllowed(body.mimeType)) {
    return c.json(
      { error: { code: 'INVALID_MIME_TYPE', message: `Unsupported MIME type: ${body.mimeType}` } },
      400
    );
  }

  // Validate encryption algorithm
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

  // Determine tier
  let tier: 'free' | 'deep' = body.tier ?? 'free';
  if (body.upgradeToken) {
    if (body.upgradeToken === devVars.UPGRADE_TOKEN) {
      tier = 'deep';
    } else {
      return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid upgrade token' } }, 401);
    }
  }

  // Validate name length
  const minNameLength = TIER_NAME_MIN_LENGTHS[tier];
  if (body.nameLength < minNameLength) {
    return c.json(
      {
        error: {
          code: 'INVALID_NAME',
          message: `Drop name must be at least ${minNameLength} characters`,
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
          message: `Payload exceeds ${(maxSize / 1024).toFixed(0)}KB`,
        },
      },
      402
    );
  }

  // Check if drop already exists
  const existing = await db.getDropById(body.id);
  if (existing) {
    return c.json({ error: { code: 'DROP_EXISTS', message: 'Drop name already taken' } }, 409);
  }

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TIER_EXPIRATION_DAYS[tier]);

  // Calculate admin hash
  let adminHash: string;
  if (body.visibility === 'private') {
    adminHash = await computePrivateAdminHash(body.contentHash ?? '', devVars.ADMIN_HASH_PEPPER);
  } else {
    adminHash = body.adminHash ?? '';
  }

  // Create the drop
  await db.createDrop({
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

  return c.json({ success: true, version: 1, tier }, 201);
});

// PUT /api/drops/:id - Update a drop
app.put('/api/drops/:id', async (c) => {
  const { id } = c.req.param();
  const drop = await db.getDropById(id);

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

  // Validate MIME type
  if (body.mimeType && !isMimeTypeAllowed(body.mimeType)) {
    return c.json(
      { error: { code: 'INVALID_MIME_TYPE', message: `Unsupported MIME type: ${body.mimeType}` } },
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
          message: `Payload exceeds ${(maxSize / 1024).toFixed(0)}KB`,
        },
      },
      402
    );
  }

  // Check version limit
  const versionCount = await db.countDropVersions(id);
  const maxVersions = TIER_VERSION_LIMITS[drop.tier];
  if (versionCount >= maxVersions) {
    return c.json(
      { error: { code: 'VERSION_LIMIT', message: 'Maximum number of versions reached' } },
      403
    );
  }

  // Verify admin credentials
  let providedHash: string;
  let newAdminHash: string;
  if (drop.visibility === 'private') {
    providedHash = await computePrivateAdminHash(body.contentHash ?? '', devVars.ADMIN_HASH_PEPPER);
    newAdminHash = await computePrivateAdminHash(
      body.newContentHash ?? body.contentHash ?? '',
      devVars.ADMIN_HASH_PEPPER
    );
  } else {
    providedHash = await sha256((body.adminPassword ?? '') + drop.salt);
    newAdminHash = providedHash;
  }

  if (providedHash !== drop.adminHash) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  // Update the drop
  const updated = await db.updateDrop(id, {
    data: body.payload,
    r2Key: null,
    iv: body.iv ?? null,
    mimeType: body.mimeType,
    adminHash: newAdminHash,
  });

  return c.json({ success: true, version: updated?.version ?? drop.version + 1 });
});

// DELETE /api/drops/:id - Delete a drop
app.delete('/api/drops/:id', async (c) => {
  const { id } = c.req.param();
  const drop = await db.getDropById(id);

  if (!drop) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
  }

  const body = await c.req.json<{ contentHash?: string; adminPassword?: string }>();

  // Verify admin credentials
  let providedHash: string;
  if (drop.visibility === 'private') {
    providedHash = await computePrivateAdminHash(body.contentHash ?? '', devVars.ADMIN_HASH_PEPPER);
  } else {
    providedHash = await sha256((body.adminPassword ?? '') + drop.salt);
  }

  if (providedHash !== drop.adminHash) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  await db.deleteDrop(id);
  return c.json({ success: true });
});

// History endpoints
app.get('/api/drops/:id/history', async (c) => {
  const { id } = c.req.param();
  const drop = await db.getDropById(id);
  if (!drop) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
  }

  const history = await db.getDropHistoryList(id);
  return c.json({
    current: { version: drop.version, createdAt: drop.createdAt.toISOString() },
    history: history.map((h) => ({ version: h.version, createdAt: h.createdAt.toISOString() })),
  });
});

app.get('/api/drops/:id/history/:version', async (c) => {
  const { id, version } = c.req.param();
  const versionNum = parseInt(version, 10);

  const historyRecord = await db.getDropHistoryVersion(id, versionNum);
  if (!historyRecord) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Version not found' } }, 404);
  }

  return c.json({
    version: historyRecord.version,
    payload: historyRecord.data ?? '',
    iv: historyRecord.iv,
    encryptionAlgo: historyRecord.encryptionAlgo,
    mimeType: historyRecord.mimeType,
    createdAt: historyRecord.createdAt.toISOString(),
  });
});

// Upgrade endpoint
app.post('/api/drops/:id/upgrade', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ upgradeToken?: string }>();

  if (body.upgradeToken !== devVars.UPGRADE_TOKEN) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid upgrade token' } }, 401);
  }

  const drop = await db.getDropById(id);
  if (!drop) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Drop not found' } }, 404);
  }

  const updated = await db.upgradeDrop(id);
  return c.json({ success: true, tier: updated?.tier ?? 'deep' });
});

// Start server
console.log(`
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   dead-drop Local API Server                                │
│                                                             │
│   Server:  http://localhost:${PORT}                          │
│   API:     http://localhost:${PORT}/api/health               │
│   Docs:    http://localhost:${PORT}/api/docs                 │
│                                                             │
│   Database: ${DB_PATH}
│                                                             │
└─────────────────────────────────────────────────────────────┘
`);

// Server instance tracking for proper shutdown
let activeServer: ReturnType<typeof serve> | null = null;
let activePort = PORT;
const maxAttempts = 10;

function startServer(attempt: number = 0): void {
  if (attempt >= maxAttempts) {
    console.error(`Failed to find available port after ${maxAttempts} attempts`);
    process.exit(1);
  }

  const server = serve({
    fetch: app.fetch,
    port: activePort,
  });

  server.on('error', (err: Error & { code?: string }) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${activePort} in use, trying ${activePort + 1}...`);
      activePort++;
      startServer(attempt + 1);
    } else {
      throw err;
    }
  });

  server.on('listening', () => {
    activeServer = server;
    // Update the displayed port if it changed
    if (activePort !== PORT) {
      console.log(`\nServer started on alternate port ${activePort}`);
      console.log(`API URL: http://localhost:${activePort}/api/health`);
    }
  });
}

// Graceful shutdown function
function gracefulShutdown(signal: string): void {
  console.log(`\n${signal} received. Shutting down...`);

  if (activeServer) {
    activeServer.close(() => {
      console.log('Server closed, port released');
      db.close();
      process.exit(0);
    });
    // Force exit after 5 seconds if graceful shutdown fails
    setTimeout(() => {
      console.log('Forced exit after timeout');
      db.close();
      process.exit(0);
    }, 5000);
  } else {
    db.close();
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
