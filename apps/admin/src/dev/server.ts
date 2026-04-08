/**
 * Local development server for Admin API
 * Runs the same Hono API as Cloudflare Workers but locally with SQLite
 */

/* eslint-disable no-console -- CLI server requires console output */

import { serve } from '@hono/node-server';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import the admin API app (shared with production)
import { createAdminApiApp } from '../api/index.js';

// Import local D1-compatible database adapter
import { createLocalD1Database } from './d1-adapter.js';

// Configuration
const DEFAULT_PORT = 9091;
const PORT = parseInt(process.env.API_PORT || String(DEFAULT_PORT), 10);
const ADMIN_DB_PATH = join(__dirname, '../../.wrangler/state/admin.db');
const CORE_DB_PATH = join(__dirname, '../../../core/.wrangler/state/local.db');
const ADMIN_SCHEMA_PATH = join(__dirname, '../../schema.sql');

// Load dev JWT secret
function loadJwtSecret(): string {
  const devVarsPath = join(__dirname, '../../.dev.vars');
  if (!existsSync(devVarsPath)) {
    console.warn('Warning: .dev.vars not found, using default JWT secret');
    return 'dev-jwt-secret-change-in-production';
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

  return vars.JWT_SECRET || 'dev-jwt-secret-change-in-production';
}

// Initialize databases
console.log('Initializing local databases...');
const adminDb = createLocalD1Database(ADMIN_DB_PATH, ADMIN_SCHEMA_PATH);
const coreDb = createLocalD1Database(CORE_DB_PATH);
const jwtSecret = loadJwtSecret();

// Create API app with all routes (shared code)
const apiApp = createAdminApiApp();

// Override env for local dev with our local DBs and secret
const mockEnv = {
  ADMIN_DB: adminDb,
  CORE_DB: coreDb,
  JWT_SECRET: jwtSecret,
};

// Wrapper to inject our mock env into Hono's request
const app = {
  fetch: (request: Request) => {
    const modifiedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    // Pass env as third argument to Hono's request() method
    return apiApp.request(modifiedRequest, {}, mockEnv);
  },
};

console.log(`
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   dead-drop Admin API Server                                │
│                                                             │
│   Server:  http://localhost:${PORT}                          │
│   API:     http://localhost:${PORT}/api/health               │
│                                                             │
│   Admin DB: ${ADMIN_DB_PATH}
│   Core DB:  ${CORE_DB_PATH}
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
    // Update displayed port if it changed
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
      adminDb.close();
      coreDb.close();
      process.exit(0);
    });
    // Force exit after 5 seconds if graceful shutdown fails
    setTimeout(() => {
      console.log('Forced exit after timeout');
      adminDb.close();
      coreDb.close();
      process.exit(0);
    }, 5000);
  } else {
    adminDb.close();
    coreDb.close();
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
