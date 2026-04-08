/**
 * Local development server for dead-drop API
 * Runs the same Hono API as Cloudflare Workers but locally with SQLite
 */

/* eslint-disable no-console -- CLI server requires console output */

import { serve } from '@hono/node-server';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import the API app with OpenAPI routes (shared with production)
import { createApiApp } from '../api/index.js';

// Import local D1-compatible database adapter from shared engine package
import { createLocalD1Database } from '@dead-drop/engine/dev/d1-adapter';

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
const db = createLocalD1Database(DB_PATH, SCHEMA_PATH);
const devVars = loadDevVars();

// Create the API app with all routes and OpenAPI support (shared code)
const apiApp = createApiApp();

// Override env for local dev with our local DB and secrets
const mockEnv = {
  DB: db,
  ADMIN_HASH_PEPPER: devVars.ADMIN_HASH_PEPPER,
  UPGRADE_TOKEN: devVars.UPGRADE_TOKEN,
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
┌───────────────────────────────────────────────────────────┐
│                                                             │
│   dead-drop Local API Server                                │
│                                                             │
│   Server:  http://localhost:${PORT}                          │
│   API:     http://localhost:${PORT}/api/health               │
│   Docs:    http://localhost:${PORT}/api/docs                 │
│   Database: ${DB_PATH}
│                                                             │
└───────────────────────────────────────────────────────────┘
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
      console.log(`Docs URL: http://localhost:${activePort}/api/docs`);
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
