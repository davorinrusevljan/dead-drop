# Claude AI Configuration for dead-drop.xyz

## Project Context

Privacy-focused, ephemeral data-sharing service running on Cloudflare Workers.

**Tech Stack:**
- Node.js 22.x, pnpm 9.x, Turborepo
- Next.js 15.x (App Router)
- Hono (Edge API)
- Cloudflare D1, R2
- Drizzle ORM, Zod validation
- Vitest (100% coverage)

## Project Structure

```
apps/
├── core/       # Community edition (free tier, text only, D1)
└── admin/      # Admin panel

packages/
├── engine/     # Shared logic (schemas, crypto, db)
└── ui/         # Shared React components
```

## Key Commands

```bash
pnpm build            # Build all packages
pnpm test             # Run unit tests
pnpm test:coverage    # Run tests with coverage
pnpm deploy:api       # Deploy API to Cloudflare
pnpm deploy:pages     # Deploy frontend to Cloudflare
```

## API Versioning

The API uses URL path versioning: `/api/v1/*`

- **v1 endpoints**: All current API calls use v1
- **Response header**: `X-API-Version: 1.0.0` on all responses
- **Old routes**: `/api/*` returns 404 (redirected to v1 in previous versions)

See: [API Versioning Plan](./docs/api-versioning-plan.md)

## Local Development

**Starting servers:** `pnpm dev` only starts the Next.js UI (port 3010). The API must be started separately.

```bash
# Terminal 1: Start API (local Node server with SQLite)
cd apps/core && pnpm dev:api

# Terminal 2: Start UI
pnpm dev
```

**Why not wrangler?** The API uses `apps/core/src/dev/server.ts` — a local Hono server backed by SQLite (via `@dead-drop/engine/dev/d1-adapter`). This is faster and more reliable than `wrangler dev` for local development. Wrangler is only used for deployment.

**Verify servers:**
```bash
curl http://localhost:9090/api/v1/health   # API health check
curl http://localhost:3010                  # UI check
```

## E2E Testing

E2E tests use Playwright against local servers (API on :9090, UI on :3010). **Start both servers before running e2e.**

```bash
# Start servers first (see Local Development above)

cd e2e
npx playwright install chromium   # First time only
npx playwright test --config=playwright.config.ts --project=chromium
```

**Test categories:**
- `v1-production.spec.ts` — hits production (`api.dead-drop.xyz`, `dead-drop.xyz`). No local servers needed.
- All other `*.spec.ts` — hit localhost. Requires `pnpm dev:api` + `pnpm dev` running.

## Deployment

- **API**: Cloudflare Workers at `https://api.dead-drop.xyz`
- **Frontend**: Cloudflare Pages at `https://dead-drop.xyz`
- **Admin**: Cloudflare Pages at `https://admin.dead-drop.xyz`

**Deploy commands:**
```bash
# Core app
cd apps/core
pnpm deploy:api      # API worker
pnpm deploy:pages    # Frontend pages
```

## Important Notes

- **Never use `--force` when pushing** git (user requirement)
- **Never deploy to Cloudflare without explicit request** - Do not run `pnpm deploy:api` or `pnpm deploy:pages` unless the user explicitly requests deployment
- **Always check ports** before starting dev servers to avoid conflicts
- **After every `git push`** — run `gh run list --limit 1` and wait for CI to complete. Report result to user. If CI fails, investigate and fix before proceeding.
- **Port allocation**:
  - Core API: 9090
  - Admin API: 9091
  - Core UI: 3010
  - Admin UI: 3011

### ⛔ NEVER Modify These Files

These files control server configuration and must **NEVER** be modified without explicit user instruction:

- `apps/core/.env.local` — API URL config, always `http://localhost:9090`
- `apps/core/next.config.mjs` — Next.js build/deploy config
- `apps/core/src/lib/config.ts` — API URL resolution logic
- `apps/core/src/dev/server.ts` — Local API dev server

**If a server won't start or the UI shows "Server unreachable":**
1. Kill all processes: `kill -9 $(ps aux | grep -E 'turbo|next|node.*9090' | grep -v grep | awk '{print $2}')`
2. Clean build cache: `rm -rf apps/core/.next`
3. Start API: `cd apps/core && pnpm dev:api &`
4. Start UI: `cd /workspaces/dead-drop && pnpm dev &`
5. Verify: `curl http://localhost:9090/api/v1/health && curl http://localhost:3010`
6. **Do NOT touch config files.** The problem is always a stale cache or process conflict.

## Memory

See `/root/.claude/projects/-workspaces-dead-drop/memory/` for project-specific context and learnings.
