/**
 * Local development server for Admin API
 * Runs the Hono API directly on Node.js with SQLite
 */

/* eslint-disable no-console */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateSalt } from '@dead-drop/engine';
import { verifyPassword, hashPassword } from '../lib/password.js';
import {
  signAdminJwt,
  verifyAdminJwt,
  extractJwtFromCookie,
  getAuthCookieOptions,
  getClearCookieOptions,
  AUTH_COOKIE_NAME,
} from '../lib/jwt.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const DEFAULT_PORT = 9091;
const PORT = parseInt(process.env.API_PORT || String(DEFAULT_PORT), 10);
const ADMIN_DB_PATH =
  process.env.DATABASE_PATH || join(__dirname, '../../.wrangler/state/admin.db');
const CORE_DB_PATH = join(__dirname, '../../../core/.wrangler/state/local.db');
const ADMIN_SCHEMA_PATH = join(__dirname, '../../schema.sql');

// Load dev JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// Type definitions for admin user rows
interface AdminUserRow {
  id: number;
  username: string;
  password_hash: string;
  salt: string;
  role: string;
  created_at: number;
  last_login_at: number | null;
}

interface AdminUserListRow {
  id: number;
  username: string;
  role: string;
  created_at: number;
  last_login_at: number | null;
}

// Admin database wrapper for better-sqlite3
class LocalAdminDatabase {
  private db: Database.Database;

  constructor(dbPath: string, schemaPath: string) {
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const isNew = !existsSync(dbPath);
    this.db = new Database(dbPath);

    if (isNew || !this.tableExists('admin_users')) {
      const schema = readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);
    }
  }

  private tableExists(name: string): boolean {
    const result = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(name);
    return !!result;
  }

  getAdminUserByUsername(username: string): AdminUserRow | undefined {
    return this.db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as
      | AdminUserRow
      | undefined;
  }

  getAdminUserById(id: number): AdminUserRow | undefined {
    return this.db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as
      | AdminUserRow
      | undefined;
  }

  createAdminUser(data: { username: string; passwordHash: string; salt: string; role?: string }) {
    const stmt = this.db.prepare(`
      INSERT INTO admin_users (username, password_hash, salt, role, created_at)
      VALUES (?, ?, ?, ?, unixepoch())
    `);
    stmt.run(data.username, data.passwordHash, data.salt, data.role || 'admin');
    return this.getAdminUserByUsername(data.username);
  }

  updateLastLogin(id: number) {
    this.db.prepare('UPDATE admin_users SET last_login_at = unixepoch() WHERE id = ?').run(id);
  }

  listAdminUsers(): AdminUserListRow[] {
    return this.db
      .prepare('SELECT id, username, role, created_at, last_login_at FROM admin_users')
      .all() as AdminUserListRow[];
  }

  deleteAdminUser(id: number): boolean {
    const result = this.db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  updateAdminPassword(id: number, passwordHash: string, salt: string) {
    this.db
      .prepare('UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?')
      .run(passwordHash, salt, id);
  }

  close() {
    this.db.close();
  }
}

// Core database wrapper (read-only for stats)
class LocalCoreDatabase {
  private db: Database.Database | null;

  constructor(dbPath: string) {
    if (existsSync(dbPath)) {
      this.db = new Database(dbPath, { readonly: true });
    } else {
      console.warn(`Warning: Core database not found at ${dbPath}, stats will be empty`);
      this.db = null;
    }
  }

  query(sql: string, params: (string | number | null)[] = []): unknown[] {
    if (!this.db) return [];
    return this.db.prepare(sql).all(...params);
  }

  queryOne(sql: string, params: (string | number | null)[] = []): unknown {
    if (!this.db) return null;
    return this.db.prepare(sql).get(...params);
  }

  close() {
    if (this.db) this.db.close();
  }
}

// Initialize databases
console.log('Initializing local databases...');
const adminDb = new LocalAdminDatabase(ADMIN_DB_PATH, ADMIN_SCHEMA_PATH);
const coreDb = new LocalCoreDatabase(CORE_DB_PATH);

// Create Hono app
const app = new Hono();

// Middleware
app.use('*', logger());

// CORS configuration for credentials (cookies)
// When credentials: true, origin must be specific, not '*'
const ALLOWED_ORIGINS = [
  'http://localhost:3011', // Admin frontend
  'http://127.0.0.1:3011',
  'http://localhost:3010', // Core frontend (if needed)
  'http://127.0.0.1:3010',
];

app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like curl, mobile apps)
      if (!origin) return origin;
      // Allow whitelisted origins
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      // Fallback for development
      return ALLOWED_ORIGINS[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposeHeaders: ['Set-Cookie'],
    credentials: true,
  })
);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'dead-drop Admin API',
    version: '1.0.0',
    status: 'running',
    mode: 'local-development',
  });
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth middleware for local dev
async function localAuthMiddleware(c: Context, next: Next) {
  const cookieHeader = c.req.header('Cookie');
  const token = extractJwtFromCookie(cookieHeader);

  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401);
  }

  const payload = await verifyAdminJwt(token, JWT_SECRET);
  if (!payload) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401);
  }

  const userId = parseInt(payload.sub, 10);
  const user = adminDb.getAdminUserById(userId);
  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } }, 401);
  }

  c.set('user', {
    id: user.id,
    username: user.username,
    role: user.role as 'admin' | 'superadmin',
  });

  return next();
}

// Auth routes
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid input' } }, 400);
  }

  const user = adminDb.getAdminUserByUsername(username);
  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  const valid = await verifyPassword(password, user.salt, user.password_hash);
  if (!valid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  const token = await signAdminJwt(
    { userId: user.id, role: user.role as 'admin' | 'superadmin' },
    JWT_SECRET
  );
  adminDb.updateLastLogin(user.id);

  return new Response(
    JSON.stringify({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${AUTH_COOKIE_NAME}=${token}; ${getAuthCookieOptions()}`,
      },
    }
  );
});

app.post('/api/auth/logout', (c) => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${AUTH_COOKIE_NAME}=; ${getClearCookieOptions()}`,
    },
  });
});

app.get('/api/auth/me', localAuthMiddleware, (c) => {
  const user = c.get('user');
  return c.json({ authenticated: true, user });
});

// Stats routes
app.get('/api/stats/overview', localAuthMiddleware, async (c) => {
  const now = new Date();
  const totalResult = coreDb.queryOne('SELECT count(*) as count FROM drops') as {
    count: number;
  } | null;
  const activeResult = coreDb.queryOne('SELECT count(*) as count FROM drops WHERE expires_at > ?', [
    Math.floor(now.getTime() / 1000),
  ]) as { count: number } | null;
  return c.json({ totalDrops: totalResult?.count ?? 0, activeDrops: activeResult?.count ?? 0 });
});

app.get('/api/stats/by-period', localAuthMiddleware, async (c) => {
  const periods = {
    hour: 60,
    day: 24 * 60,
    threeDays: 3 * 24 * 60,
    week: 7 * 24 * 60,
    month: 30 * 24 * 60,
    year: 365 * 24 * 60,
  };

  const result: Record<string, { created: number; edited: number; deleted: number }> = {};
  const now = Date.now();

  for (const [period, minutes] of Object.entries(periods)) {
    const startDate = new Date(now - minutes * 60 * 1000);
    const startTs = Math.floor(startDate.getTime() / 1000);

    const created = coreDb.queryOne(
      "SELECT count(*) as count FROM drop_audit_log WHERE action = 'created' AND created_at >= ?",
      [startTs]
    ) as { count: number } | null;
    const edited = coreDb.queryOne(
      "SELECT count(*) as count FROM drop_audit_log WHERE action = 'edited' AND created_at >= ?",
      [startTs]
    ) as { count: number } | null;
    const deleted = coreDb.queryOne(
      "SELECT count(*) as count FROM drop_audit_log WHERE action = 'deleted' AND created_at >= ?",
      [startTs]
    ) as { count: number } | null;

    result[period] = {
      created: created?.count ?? 0,
      edited: edited?.count ?? 0,
      deleted: deleted?.count ?? 0,
    };
  }

  return c.json(result);
});

app.get('/api/stats/distribution', localAuthMiddleware, async (c) => {
  const tierResult = coreDb.query('SELECT tier, count(*) as count FROM drops GROUP BY tier');
  const visibilityResult = coreDb.query(
    'SELECT visibility, count(*) as count FROM drops GROUP BY visibility'
  );

  const byTier = { free: 0, deep: 0 };
  const byVisibility = { public: 0, private: 0 };

  for (const row of tierResult as Array<{ tier: string; count: number }>) {
    if (row.tier === 'free') byTier.free = row.count;
    else if (row.tier === 'deep') byTier.deep = row.count;
  }

  for (const row of visibilityResult as Array<{ visibility: string; count: number }>) {
    if (row.visibility === 'public') byVisibility.public = row.count;
    else if (row.visibility === 'private') byVisibility.private = row.count;
  }

  return c.json({ byTier, byVisibility });
});

app.get('/api/stats/storage', localAuthMiddleware, async (c) => {
  const textResult = coreDb.queryOne(
    'SELECT coalesce(sum(length(data)), 0) as total FROM drops WHERE data IS NOT NULL'
  ) as { total: number } | null;
  const r2Result = coreDb.queryOne(
    'SELECT count(*) as count FROM drops WHERE r2_key IS NOT NULL'
  ) as { count: number } | null;

  return c.json({
    textBytes: textResult?.total ?? 0,
    estimatedR2Bytes: (r2Result?.count ?? 0) * 1024 * 1024,
  });
});

app.get('/api/stats/activity', localAuthMiddleware, async (c) => {
  const period = c.req.query('period') || 'week';
  const periodMinutes: Record<string, number> = {
    hour: 60,
    day: 24 * 60,
    threeDays: 3 * 24 * 60,
    week: 7 * 24 * 60,
    month: 30 * 24 * 60,
    year: 365 * 24 * 60,
  };
  const bucketMinutes: Record<string, number> = {
    hour: 1,
    day: 60,
    threeDays: 60,
    week: 24 * 60,
    month: 24 * 60,
    year: 7 * 24 * 60,
  };

  const minutes = periodMinutes[period] || periodMinutes.week;
  const bucketMins = bucketMinutes[period] || bucketMinutes.week;
  const startDate = new Date(Date.now() - minutes * 60 * 1000);
  const startTs = Math.floor(startDate.getTime() / 1000);

  const entries = coreDb.query(
    'SELECT action, drop_id, created_at FROM drop_audit_log WHERE created_at >= ? ORDER BY created_at DESC',
    [startTs]
  );

  // Group into buckets
  const bucketMs = bucketMins * 60 * 1000;
  const buckets: Map<string, { created: number; edited: number; deleted: number }> = new Map();
  const now = Date.now();

  for (let t = Math.floor(now / bucketMs) * bucketMs; t >= startDate.getTime(); t -= bucketMs) {
    const key = new Date(t).toISOString();
    buckets.set(key, { created: 0, edited: 0, deleted: 0 });
  }

  for (const entry of entries as Array<{ action: string; drop_id: string; created_at: number }>) {
    const bucketTime = Math.floor((entry.created_at * 1000) / bucketMs) * bucketMs;
    const key = new Date(bucketTime).toISOString();
    const bucket = buckets.get(key);
    if (bucket && ['created', 'edited', 'deleted'].includes(entry.action)) {
      bucket[entry.action as 'created' | 'edited' | 'deleted']++;
    }
  }

  const bucketArray = Array.from(buckets.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const recent = (entries as Array<{ action: string; drop_id: string; created_at: number }>)
    .slice(0, 50)
    .map((e) => ({
      action: e.action,
      dropId: e.drop_id,
      createdAt: new Date(e.created_at * 1000).toISOString(),
    }));

  return c.json({ buckets: bucketArray, recent });
});

// User management routes
app.get('/api/users', localAuthMiddleware, async (c) => {
  const users = adminDb.listAdminUsers();
  return c.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: new Date(u.created_at * 1000).toISOString(),
      lastLoginAt: u.last_login_at ? new Date(u.last_login_at * 1000).toISOString() : null,
    })),
  });
});

app.post('/api/users', localAuthMiddleware, async (c) => {
  const currentUser = c.get('user');
  if (currentUser.role !== 'superadmin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Superadmin access required' } }, 403);
  }

  const body = await c.req.json();
  const { username, password, role } = body;

  if (!username || username.length < 3 || !password || password.length < 8) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid input' } }, 400);
  }

  const existing = adminDb.getAdminUserByUsername(username);
  if (existing) {
    return c.json({ error: { code: 'USERNAME_EXISTS', message: 'Username already taken' } }, 409);
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  try {
    const user = adminDb.createAdminUser({
      username,
      passwordHash,
      salt,
      role: role || 'admin',
    });
    return c.json(
      { success: true, user: { id: user!.id, username: user!.username, role: user!.role } },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE')) {
      return c.json({ error: { code: 'USERNAME_EXISTS', message: 'Username already taken' } }, 409);
    }
    throw err;
  }
});

app.delete('/api/users/:id', localAuthMiddleware, async (c) => {
  const currentUser = c.get('user');
  if (currentUser.role !== 'superadmin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Superadmin access required' } }, 403);
  }

  const idParam = c.req.param('id');
  const id = parseInt(idParam ?? '', 10);
  if (isNaN(id)) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid user ID' } }, 400);
  }

  if (id === currentUser.id) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Cannot delete yourself' } }, 403);
  }

  const deleted = adminDb.deleteAdminUser(id);
  if (!deleted) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  return c.json({ success: true });
});

app.put('/api/users/:id/password', localAuthMiddleware, async (c) => {
  const currentUser = c.get('user');
  if (currentUser.role !== 'superadmin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Superadmin access required' } }, 403);
  }

  const idParam = c.req.param('id');
  const id = parseInt(idParam ?? '', 10);
  if (isNaN(id)) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'Invalid user ID' } }, 400);
  }

  const body = await c.req.json();
  const { password } = body;
  if (!password || password.length < 8) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Password must be at least 8 characters' } },
      400
    );
  }

  const user = adminDb.getAdminUserById(id);
  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  adminDb.updateAdminPassword(id, passwordHash, salt);

  return c.json({ success: true });
});

// Start server
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

let activeServer: ReturnType<typeof serve> | null = null;
let activePort = PORT;

function startServer(attempt = 0): void {
  const maxAttempts = 10;
  if (attempt >= maxAttempts) {
    console.error(`Failed to find available port after ${maxAttempts} attempts`);
    process.exit(1);
  }

  const server = serve({ fetch: app.fetch, port: activePort });

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
    if (activePort !== PORT) {
      console.log(`\nServer started on alternate port ${activePort}`);
      console.log(`API URL: http://localhost:${activePort}/api/health`);
    }
  });
}

function gracefulShutdown(signal: string): void {
  console.log(`\n${signal} received. Shutting down...`);
  if (activeServer) {
    activeServer.close(() => {
      console.log('Server closed');
      adminDb.close();
      coreDb.close();
      process.exit(0);
    });
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

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
