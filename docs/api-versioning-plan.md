# API Versioning Plan (Revised)

## Current State

- All routes under `/api/*` (unversioned)
- OpenAPI version: `1.0.0`
- API is **NOT public yet** - internal use only
- No backward compatibility needed

## Approach: Direct URL Path Versioning

Move directly to `/api/v1/*` without keeping `/api/*` aliases. Since API is not public, we can break clients immediately.

**Final structure:**
```
/api/v1/health
/api/v1/drops
/api/v1/drops/:id
/api/v1/drops/:id/history
/api/v1/drops/:id/history/:version
/api/v1/drops/:id/upgrade
/api/v1/drops/generate-name
/api/v1/drops/check/:id
/api/v1/docs
/api/v1/docs/openapi.json
```

## File Structure

```
apps/core/src/api/
├── v1/
│   ├── index.ts           # v1 router, exports all routes
│   ├── routes/
│   │   ├── drops.ts       # GET/POST/PUT/DELETE /drops
│   │   ├── health.ts      # GET /health
│   │   ├── generate-name.ts
│   │   └── history.ts     # GET /drops/:id/history
│   └── openapi.ts         # v1 OpenAPI config and schemas
├── middleware.ts          # Keep existing (security, rate limits, logging)
├── types.ts               # Keep existing
└── index.ts               # Main app, mounts v1 router
```

## Implementation Tasks (For Subagents)

### Task 1: Create v1 Directory Structure

**Agent:** General-purpose

**Files to create:**
- `apps/core/src/api/v1/index.ts` (new)
- `apps/core/src/api/v1/routes/drops.ts` (move logic)
- `apps/core/src/api/v1/routes/health.ts` (move logic)
- `apps/core/src/api/v1/routes/generate-name.ts` (move logic)
- `apps/core/src/api/v1/routes/history.ts` (move logic)
- `apps/core/src/api/v1/routes/check-availability.ts` (move logic)
- `apps/core/src/api/v1/openapi.ts` (move schemas)

**Steps:**
1. Create `apps/core/src/api/v1/` directory
2. Create `apps/core/src/api/v1/routes/` directory
3. Move route handlers from `apps/core/src/api/index.ts` to separate files
4. Move OpenAPI schemas from `apps/core/src/api/openapi.ts` to `v1/openapi.ts`
5. Create `v1/index.ts` that exports an `OpenAPIHono` router with all v1 routes

**Dependencies:**
- Import from `../middleware.ts`
- Import from `../types.ts`
- Import from `../../db.js`

---

### Task 2: Update v1 OpenAPI Configuration

**Agent:** General-purpose

**File:** `apps/core/src/api/v1/openapi.ts`

**Changes:**
1. Keep all existing schemas
2. Update `openApiConfig` to use `/api/v1` as base URL
3. Update version to `1.0.0`
4. Update title to "dead-drop API v1"

```typescript
export const v1OpenApiConfig = {
  openapi: '3.1.0',
  info: {
    title: 'dead-drop API v1',
    version: '1.0.0',
    description: 'Privacy-focused, ephemeral data-sharing API v1',
    contact: {
      name: 'dead-drop.xyz',
      url: 'https://dead-drop.xyz',
    },
  },
  servers: [
    { url: '/api/v1', description: 'v1 API' },
    { url: 'https://api.dead-drop.xyz/api/v1', description: 'Production v1 API' },
  ],
  tags: [
    { name: 'Drops', description: 'Drop CRUD operations' },
    { name: 'History', description: 'Drop version history' },
    { name: 'Health', description: 'Health check endpoints' },
  ],
};
```

---

### Task 3: Update Main API Index

**Agent:** General-purpose

**File:** `apps/core/src/api/index.ts`

**Changes:**
1. Remove all route definitions (moved to v1/)
2. Import `v1Router` from `./v1/index.ts`
3. Mount v1 router at `/api/v1`
4. Keep error handler
5. Keep CORS and middleware

**New structure:**
```typescript
import { v1Router } from './v1/index.js';
// ... other imports

export function createApiApp(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

  // Middleware (keep as-is)
  app.use('*', rateLimitHeaders);
  app.use('*', securityHeaders);
  app.use('*', logger());
  app.use('*', cors({...}));

  // Mount v1 router
  app.route('/api/v1', v1Router);

  // robots.txt (keep)
  app.get('/robots.txt', ...);

  // Error handler (keep)
  app.onError(...);

  return app;
}
```

---

### Task 4: Update Tests

**Agent:** General-purpose

**Files to update:**
- `apps/core/src/api/index.test.ts`
- `apps/core/src/api/routes/*.test.ts`

**Changes:**
1. Update all URLs from `/api/...` to `/api/v1/...`
2. Ensure all imports point to new locations
3. Add version header check: `expect(res.headers.get('x-api-version')).toBe('1.0.0')`

**Example test change:**
```typescript
// Before
const res = await app.request('/api/health');

// After
const res = await app.request('/api/v1/health');
expect(res.headers.get('x-api-version')).toBe('1.0.0');
```

---

### Task 5: Add Version Header Middleware

**Agent:** General-purpose

**File:** `apps/core/src/api/middleware.ts`

**Add:**
```typescript
export const versionHeader = async (c: Context, next: Next) => {
  await next();
  c.header('X-API-Version', '1.0.0');
};
```

**Apply in:**
- `apps/core/src/api/index.ts` - add `app.use('*', versionHeader);`

---

### Task 6: Update Frontend Client

**Agent:** General-purpose

**File:** `apps/core/src/lib/drop-client.ts`

**Changes:**
1. Update all API URLs to include `/v1`
2. Verify version header handling (if any)

**Example:**
```typescript
// Before
const response = await fetch(`/api/drops/${id}`);

// After
const response = await fetch(`/api/v1/drops/${id}`);
```

---

### Task 7: Update Swagger UI HTML

**Agent:** General-purpose

**File:** Move to `apps/core/src/api/v1/routes/docs.ts` or keep in main index

**Changes:**
1. Update OpenAPI URL to `/api/v1/docs/openapi.json`
2. Keep HTML generation as-is

---

## Local Testing & Verification (Do After Implementation, Before Deployment)

### Test 1: Run Test Suite

**Command:**
```bash
pnpm test
```

**Expected:**
- All 180+ tests pass
- No import errors
- No type errors

**Verify:**
```bash
pnpm typecheck
pnpm lint
```

---

### Test 2: Start Dev Server

**Command:**
```bash
pnpm dev
```

**Expected:**
- Server starts on port 8788 (or configured port)
- No errors on startup

---

### Test 3: Verify Endpoints (curl)

```bash
# Health check
curl http://localhost:8788/api/v1/health
# Expected: {"status":"ok","timestamp":"..."}

# Check X-API-Version header
curl -I http://localhost:8788/api/v1/health
# Expected: X-API-Version: 1.0.0

# OpenAPI spec
curl http://localhost:8788/api/v1/docs/openapi.json | jq '.info'
# Expected: version: "1.0.0", title: "dead-drop API v1"

# Generate name
curl http://localhost:8788/api/v1/drops/generate-name
# Expected: {"name":"...","id":"..."}

# Check availability
curl http://localhost:8788/api/v1/drops/check/7c4e8d3a9f1b6e2c8d4a7f3b9e1c5d8a2f6b4e9d3c7a1f8b5e2d9c4a6f3b7e1d
# Expected: {"id":"...","available":true}

# Swagger UI accessible
curl http://localhost:8788/api/v1/docs | grep -q "swagger-ui"
```

---

### Test 4: Verify Old Routes Return 404

```bash
# Old routes should NOT work
curl http://localhost:8788/api/health
# Expected: 404 Not Found

curl http://localhost:8788/api/drops/generate-name
# Expected: 404 Not Found
```

---

### Test 5: Manual E2E - Local API

**Purpose:** Verify all v1 endpoints work correctly via curl/browser

**Step 5.1: Health check**
```bash
curl -v http://localhost:8788/api/v1/health
```
- Verify: Response is `{"status":"ok","timestamp":"..."}`
- Verify: Header `X-API-Version: 1.0.0` is present
- Verify: Header `X-RateLimit-Limit: 100` is present

**Step 5.2: Generate name**
```bash
curl -v http://localhost:8788/api/v1/drops/generate-name
```
- Verify: Response has `name` (4 words, kebab-case)
- Verify: Response has `id` (64 hex chars)
- Verify: Header `X-API-Version: 1.0.0` is present

**Step 5.3: Check availability**
```bash
curl -v http://localhost:8788/api/v1/drops/check/7c4e8d3a9f1b6e2c8d4a7f3b9e1c5d8a2f6b4e9d3c7a1f8b5e2d9c4a6f3b7e1d
```
- Verify: Response is `{"id":"...","available":true}` (or false if exists)
- Verify: Header `X-API-Version: 1.0.0` is present

**Step 5.4: OpenAPI spec**
```bash
curl -v http://localhost:8788/api/v1/docs/openapi.json | jq '.info'
```
- Verify: `title` is "dead-drop API v1"
- Verify: `version` is "1.0.0"
- Verify: `servers[0].url` is "/api/v1"

**Step 5.5: Swagger UI in browser**
1. Open `http://localhost:8788/api/v1/docs` in browser
2. Verify: Swagger UI loads
3. Verify: "dead-drop API v1" in title
4. Verify: Click "GET /api/v1/health" → Expand → "Try it out" → "Execute"
5. Verify: Response shows `{"status":"ok"}`
6. Verify: Response headers show `X-API-Version: 1.0.0`

**Step 5.6: Old routes return 404**
```bash
curl -I http://localhost:8788/api/health
curl -I http://localhost:8788/api/drops/generate-name
```
- Verify: Both return `HTTP/1.1 404 Not Found`

---

### Test 6: Manual E2E - Local Frontend

**Purpose:** Verify full user flow works with v1 API

**Preparation:**
```bash
# Start both API and frontend
pnpm dev
```

**Step 6.1: Open frontend**
1. Open `http://localhost:3000` in browser
2. Open DevTools → Network tab
3. Filter by "Fetch/XHR"

**Step 6.2: Generate a drop name**
1. Click "Generate Name" button
2. Verify: Network shows request to `/api/v1/drops/generate-name`
3. Verify: Response 200 with name and id
4. Verify: Drop name appears on page

**Step 6.3: Create a private drop**
1. Enter drop content: "Test drop for v1 API"
2. Set visibility to "Private"
3. Click "Create Drop"
4. Verify: Network shows POST to `/api/v1/drops`
5. Verify: Response 201 with `success: true`, `version: 1`, `tier: "free"`
6. Verify: Redirect to drop page

**Step 6.4: View the drop**
1. On drop page, enter phrase to decrypt
2. Click "Unlock"
3. Verify: Network shows GET to `/api/v1/drops/{id}`
4. Verify: Content displays correctly

**Step 6.5: Edit the drop**
1. Click "Edit" button
2. Change content to "Updated test drop"
3. Save
4. Verify: Network shows PUT to `/api/v1/drops/{id}`
5. Verify: Response 200 with new version number
6. Verify: Updated content displays

**Step 6.6: View history**
1. Click "History" button
2. Verify: Network shows GET to `/api/v1/drops/{id}/history`
3. Verify: All versions listed
4. Click on previous version
5. Verify: Network shows GET to `/api/v1/drops/{id}/history/{version}`
6. Verify: Previous version content displays

**Step 6.7: Create a public drop**
1. Go to homepage
2. Enter content: "Public test drop"
3. Set visibility to "Public"
4. Set admin password: "test-admin-123"
5. Click "Create Drop"
6. Verify: Network shows POST to `/api/v1/drops`
7. Verify: Drop created successfully

**Step 6.8: Verify all requests use v1**
1. Check Network tab
2. Verify: All API requests start with `/api/v1/`
3. Verify: All responses have `X-API-Version: 1.0.0` header

**Step 6.9: Check console for errors**
1. Check browser console
2. Verify: No JavaScript errors
3. Verify: No 404 errors in Network tab

**STOP HERE. Report to user. Wait for "go" before deploying.**

---

### Test 7: Build Verification

**Commands:**
```bash
pnpm build
```

**Expected:**
- Build completes successfully
- No TypeScript errors
- No build warnings

---

## Cloudflare Deployment

### Pre-Deployment Checks

1. **Commit changes:**
```bash
git add .
git commit -m "feat: Add v1 API versioning"
git push
```

2. **Verify CI passes:**
- Check GitHub Actions
- All tests pass
- Build succeeds

---

### Deploy API to Cloudflare Workers

**Command:**
```bash
cd apps/core
pnpm deploy:api
```

**Expected output:**
```
Published dead-drop-core (X.YY sec)
  https://api.dead-drop.xyz
```

---

### Deploy Frontend to Cloudflare Pages

**Command:**
```bash
cd apps/core
pnpm deploy:pages
```

**Expected output:**
```
Published dead-drop (X.YY sec)
  https://dead-drop.xyz
```

---

## Cloudflare Verification (After User Says "Go")

### Test 1: Health Check

**Step 1.1: Basic health check**
```bash
curl -v https://api.dead-drop.xyz/api/v1/health
```
- Verify: Response is `{"status":"ok","timestamp":"..."}`
- Verify: Header `X-API-Version: 1.0.0` is present
- Verify: Header `X-RateLimit-Limit: 100` is present
- Verify: No errors in response

**Step 1.2: Check headers only**
```bash
curl -I https://api.dead-drop.xyz/api/v1/health
```
- Verify: `HTTP/2 200`
- Verify: `X-API-Version: 1.0.0`
- Verify: `X-RateLimit-Limit: 100`
- Verify: `X-RateLimit-Remaining: 100`

---

### Test 2: OpenAPI Spec

```bash
curl -v https://api.dead-drop.xyz/api/v1/docs/openapi.json | jq '.info'
```
- Verify: `title` is "dead-drop API v1"
- Verify: `version` is "1.0.0"
- Verify: `servers[0].url` is "/api/v1"

---

### Test 3: Swagger UI in Browser

**Steps:**
1. Open `https://api.dead-drop.xyz/api/v1/docs` in browser
2. Verify: Swagger UI loads
3. Verify: "dead-drop API v1" in title
4. Click "GET /api/v1/health" → Expand → "Try it out" → "Execute"
5. Verify: Response shows `{"status":"ok"}`
6. Verify: Response headers show `X-API-Version: 1.0.0`

---

### Test 4: Generate Name

```bash
curl -v https://api.dead-drop.xyz/api/v1/drops/generate-name
```
- Verify: Response has `name` (4 words, kebab-case)
- Verify: Response has `id` (64 hex chars)
- Verify: Header `X-API-Version: 1.0.0`

---

### Test 5: Check Availability

```bash
curl -v https://api.dead-drop.xyz/api/v1/drops/check/7c4e8d3a9f1b6e2c8d4a7f3b9e1c5d8a2f6b4e9d3c7a1f8b5e2d9c4a6f3b7e1d
```
- Verify: Response is `{"id":"...","available":true}` (or false if exists)
- Verify: Header `X-API-Version: 1.0.0`

---

### Test 6: Old Routes Return 404

```bash
curl -I https://api.dead-drop.xyz/api/health
curl -I https://api.dead-drop.xyz/api/drops/generate-name
```
- Verify: Both return `HTTP/2 404 Not Found`

---

### Test 7: Full Frontend Flow (Production)

**Steps:**
1. Open `https://dead-drop.xyz` in browser
2. Open DevTools → Network tab
3. Filter by "Fetch/XHR"

**Step 7.1: Generate a drop name**
1. Click "Generate Name" button
2. Verify: Network shows request to `/api/v1/drops/generate-name`
3. Verify: Response 200 with name and id
4. Verify: Drop name appears on page

**Step 7.2: Create a private drop**
1. Enter drop content: "Production test for v1 API"
2. Set visibility to "Private"
3. Click "Create Drop"
4. Verify: Network shows POST to `/api/v1/drops`
5. Verify: Response 201 with `success: true`, `version: 1`
6. Verify: Redirect to drop page

**Step 7.3: View the drop**
1. On drop page, enter phrase to decrypt
2. Click "Unlock"
3. Verify: Network shows GET to `/api/v1/drops/{id}`
4. Verify: Content displays correctly

**Step 7.4: Edit the drop**
1. Click "Edit" button
2. Change content to "Updated production test"
3. Save
4. Verify: Network shows PUT to `/api/v1/drops/{id}`
5. Verify: Response 200 with new version
6. Verify: Updated content displays

**Step 7.5: Create a public drop**
1. Go to homepage
2. Enter content: "Public production test"
3. Set visibility to "Public"
4. Set admin password: "prod-test-123"
5. Click "Create Drop"
6. Verify: Network shows POST to `/api/v1/drops`
7. Verify: Drop created successfully

**Step 7.6: Verify all requests use v1**
1. Check Network tab
2. Verify: All API requests start with `/api/v1/`
3. Verify: All responses have `X-API-Version: 1.0.0` header

**Step 7.7: Check console for errors**
1. Check browser console
2. Verify: No JavaScript errors
3. Verify: No 404 errors in Network tab

---

### Test 8: Check Cloudflare Worker Logs (Optional)

```bash
wrangler tail --name dead-drop-core
```

**Watch for:**
- Request logs show `/api/v1/*` paths
- No errors
- Version header present

---

## Rollback Plan

If deployment fails:

```bash
# Revert commit
git revert HEAD
git push

# Redeploy
cd apps/core
pnpm deploy:api
pnpm deploy:pages
```

---

## Success Criteria

### Local (After Implementation, Before Deployment)
- [ ] All automated tests pass (180+ tests)
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Health check returns 200 with `X-API-Version: 1.0.0`
- [ ] Generate name works
- [ ] Check availability works
- [ ] Swagger UI loads and works
- [ ] Old `/api/*` routes return 404
- [ ] Frontend full flow works (create, view, edit, history)
- [ ] All API requests use `/api/v1/*` paths
- [ ] No console errors
- [ ] No 404 errors in Network tab

### Cloudflare (After Deployment)
- [ ] Health check returns 200 with `X-API-Version: 1.0.0`
- [ ] Generate name works
- [ ] Check availability works
- [ ] OpenAPI spec shows v1
- [ ] Swagger UI loads and works
- [ ] Old `/api/*` routes return 404
- [ ] Frontend full flow works (create, view, edit, history)
- [ ] All API requests use `/api/v1/*` paths
- [ ] No console errors
- [ ] No 404 errors in Network tab

---

## Subagent Handoff Summary

**Total tasks:** 7 implementation tasks

**Agents needed:** General-purpose (all tasks can be done by one agent sequentially)

**Dependencies:** Task 1 must complete before Task 3 (Task 3 imports from Task 1's output)

**Estimated time:** 30-45 minutes for all implementation tasks

**Verification time:**
- Local automated tests: 2-3 minutes
- Local manual E2E (API): 5-10 minutes
- Local manual E2E (Frontend): 10-15 minutes
- **STOP HERE - Report to user**

**Deployment time (after user approval):**
- Deploy API: 2-3 minutes
- Deploy Pages: 2-3 minutes
- Cloudflare verification: 10-15 minutes

**Total:** ~1 hour implementation + ~25 minutes verification + ~10 minutes deployment
