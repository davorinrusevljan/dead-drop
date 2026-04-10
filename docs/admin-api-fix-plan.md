# Admin API Local Server Fix Plan

## Problem Statement

The admin API local server (`apps/admin/src/dev/server.ts`) has the **same code duplication problem** that the core API had before it was fixed:

1. **Duplicate routes** - All API routes (auth, stats, users) are re-implemented inline
2. **Duplicate DB layer** - Custom `LocalAdminDatabase` and `LocalCoreDatabase` wrappers
3. **Duplicate middleware** - Auth middleware logic is duplicated
4. **No code sharing** - Completely ignores `createAdminApiApp()` from `src/api/index.ts`

This leads to:
- Maintenance nightmare - changes must be made in two places
- Inconsistent behavior between local and production
- Potential for bugs in production code that don't exist locally (or vice versa)

## Solution Approach

Apply the **same fix pattern** used for the core API:

### 1. Create D1-Compatible Adapter

**File**: `apps/admin/src/dev/d1-adapter.ts`

Create a D1-compatible wrapper using better-sqlite3 that matches Cloudflare D1's API:
- `prepare(sql)` → D1Statement
- `bind(...)` → D1Statement
- `first<T>()` → Promise<T | null>
- `run()` → Promise<D1Result>
- `all<T>()` → Promise<D1Result<T>>
- `batch(statements)` → Promise<D1BatchResult>
- `exec(sql)` → Promise<D1Result>

This adapter will be shared with or adapted from the core app's `d1-adapter.ts`.

### 2. Rewrite Local Server

**File**: `apps/admin/src/dev/server.ts`

Replace the current 633-line standalone server with a minimal wrapper that:
- Creates two local databases using the D1 adapter
  - Admin DB: `apps/admin/.wrangler/state/admin.db`
  - Core DB: `apps/core/.wrangler/state/local.db`
- Loads JWT secret from `.dev.vars`
- Uses `createAdminApiApp()` from `src/api/index.ts`
- Injects local databases and secrets into the Hono request context

### 3. Delete Duplicated Code

Remove from `src/dev/server.ts`:
- Custom `LocalAdminDatabase` class
- Custom `LocalCoreDatabase` class
- Inline route implementations (auth, stats, users)
- Duplicate middleware implementations
- Duplicate CORS configuration

### 4. Verify Shared Code Works

The production API code already exists and works:
- `src/api/index.ts` → `createAdminApiApp()`
- `src/api/db-admin.ts` → Admin user operations
- `src/api/db-stats.ts` → Statistics operations
- `src/api/middleware.ts` → Auth middleware
- `src/api/routes/` → Modular route handlers

All of this uses `drizzle-orm/d1` which the D1 adapter will emulate.

## Implementation Steps

### Step 1: Create D1 Adapter
```bash
# Can reuse core's d1-adapter.ts or create admin-specific one
cp apps/core/src/dev/d1-adapter.ts apps/admin/src/dev/
# Or create admin-specific version if needed
```

### Step 2: Rewrite server.ts
```typescript
import { serve } from '@hono/node-server';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { createAdminApiApp } from '../api/index.js';
import { createLocalD1Database } from './d1-adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Paths
const ADMIN_DB_PATH = join(__dirname, '../../.wrangler/state/admin.db');
const CORE_DB_PATH = join(__dirname, '../../../core/.wrangler/state/local.db');
const ADMIN_SCHEMA_PATH = join(__dirname, '../../schema.sql');
const DEV_VARS_PATH = join(__dirname, '../../.dev.vars');

// Load JWT secret
const JWT_SECRET = readFileSync(DEV_VARS_PATH, 'utf-8').trim();

// Create local databases
const adminDb = createLocalD1Database(ADMIN_DB_PATH, ADMIN_SCHEMA_PATH);
const coreDb = createLocalD1Database(CORE_DB_PATH);

// Create API app (shared with production)
const apiApp = createAdminApiApp();

// Inject local env
const localEnv = {
  ADMIN_DB: adminDb,
  CORE_DB: coreDb,
  JWT_SECRET,
};

// Server wrapper
const app = {
  fetch: (request: Request) => {
    return apiApp.request(request, {}, localEnv);
  },
};

// Start server on port 9091
serve({ fetch: app.fetch, port: 9091 });
```

### Step 3: Update package.json if needed
```json
{
  "scripts": {
    "dev:api": "npx tsx src/dev/server.ts"
  }
}
```

### Step 4: Test Locally
```bash
# Terminal 1 - Admin API
cd apps/admin
pnpm dev:api

# Terminal 2 - Admin UI
pnpm dev

# Test endpoints
curl http://localhost:9091/api/health
curl http://localhost:9091/api/drops/generate-name
```

### Step 5: Verify Production Still Works
```bash
cd apps/admin
pnpm deploy:api
# Check production API
curl https://admin-api.dead-drop.xyz/api/health
```

## Expected Outcome

- **~90% code reduction** in `server.ts` (633 lines → ~50 lines)
- **100% code sharing** between local and production
- **Single source of truth** for all API logic
- **Consistent behavior** across environments
- **Easier maintenance** - changes automatically apply everywhere

## Notes

- The admin API uses **two D1 databases**: ADMIN_DB (users) and CORE_DB (stats)
- The CORE_DB in local dev should point to the same file the core API uses
- The D1 adapter needs to handle multiple database connections
- Consider sharing a single `d1-adapter.ts` file between core and admin apps

## Files to Modify

| File | Action |
|------|--------|
| `apps/admin/src/dev/server.ts` | Complete rewrite (~50 lines) |
| `apps/admin/src/dev/d1-adapter.ts` | Create (or copy from core) |
| `CLAUDE.md` | Add admin dev procedures |
