# dead-drop.xyz Development Guide

## Project Overview

Privacy-focused, ephemeral data-sharing service running on Cloudflare Workers (Edge Runtime).

### Architecture

**Monorepo Structure** (Turborepo + pnpm workspaces):
```
/workspaces/dead-drop/
├── apps/
│   ├── core/          # Community edition (free tier, D1 storage)
│   └── admin/         # Admin panel (not primary focus)
├── packages/
│   ├── engine/        # Shared logic (Zod schemas, Drizzle DB, Web Crypto)
│   └── ui/            # Shared React components
└── scripts/           # Utility scripts
```

**Tech Stack**:
- Node.js 22.x, pnpm 9.x
- Next.js 15.x (App Router)
- Hono (Edge API)
- Cloudflare D1 (SQLite), R2 (Object Storage)
- Drizzle ORM, Zod validation
- Vitest (100% coverage required)

---

## Local Development

### Starting the Servers

**Terminal 1 - Start API Server:**
```bash
cd /workspaces/dead-drop/apps/core
pnpm dev:api
```
- Runs on: `http://localhost:9090`
- Uses local SQLite: `.wrangler/state/local.db`
- API Docs: `http://localhost:9090/api/docs`

**Terminal 2 - Start UI Server:**
```bash
cd /workspaces/dead-drop/apps/core
pnpm dev
```
- Runs on: `http://localhost:3010`
- Automatically connects to API at `http://localhost:9090`

### Stopping the Servers

**Stop API Server:**
- Press `Ctrl+C` in the terminal running `pnpm dev:api`

**Stop UI Server:**
- Press `Ctrl+C` in the terminal running `pnpm dev`

**Clean up hung processes:**
```bash
# Kill Next.js processes
pkill -f "next-server"

# Kill anything on specific ports
lsof -ti :3010 | xargs -r kill -9
lsof -ti :9090 | xargs -r kill -9
```

### Testing the API

```bash
# Health check
curl http://localhost:9090/api/health

# Generate random drop name
curl http://localhost:9090/api/drops/generate-name

# Check if drop name is available
curl http://localhost:9090/api/drops/check/<drop-id>
```

### Database

Local development uses `better-sqlite3` wrapped in a D1-compatible adapter:
- **Location**: `apps/core/.wrangler/state/local.db`
- **Schema**: `apps/core/schema.sql`
- **Adapter**: `apps/core/src/dev/d1-adapter.ts`

The API code in `apps/core/src/api/index.ts` is **shared** between local dev and production. The only difference is the database:
- **Local**: D1-compatible adapter using better-sqlite3
- **Production**: Real Cloudflare D1 database

---

## Deployment

### Production Environment

Two separate deployments:

| Service | URL | Command | Config |
|---------|-----|---------|--------|
| Frontend | https://dead-drop.xyz | `pnpm deploy:pages` | `wrangler.toml` |
| API | https://api.dead-drop.xyz | `pnpm deploy:api` | `wrangler.api.toml` |

### Cloudflare Resources

| Resource | Name | ID |
|----------|------|-----|
| D1 Database | dead-drop-core | `d7b160c6-078a-40db-a51c-29eb73bc8eb2` |
| API Worker | dead-drop-core | - |
| Pages Project | dead-drop | - |

### Deploy Frontend (Cloudflare Pages)

```bash
cd /workspaces/dead-drop/apps/core
pnpm deploy:pages
```

This:
1. Builds Next.js with `@cloudflare/next-on-pages`
2. Outputs to `.vercel/output/static`
3. Deploys to Cloudflare Pages

### Deploy API (Cloudflare Workers)

```bash
cd /workspaces/dead-drop/apps/core
pnpm deploy:api
```

This deploys the Hono worker to Cloudflare Workers with D1 binding.

### Setting Secrets

Required secrets for API Worker:
```bash
cd /workspaces/dead-drop/apps/core

# Set production secrets
wrangler secret put ADMIN_HASH_PEPPER --name dead-drop-core
wrangler secret put UPGRADE_TOKEN --name dead-drop-core
```

For local development, create `.dev.vars`:
```bash
ADMIN_HASH_PEPPER=dev-pepper
UPGRADE_TOKEN=dev-upgrade-token
```

---

## Common Commands

### From Root Directory

```bash
# Install dependencies
pnpm install

# Run all dev servers
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run linting
pnpm lint

# Type checking
pnpm typecheck

# Clean all build artifacts
pnpm clean
```

### From apps/core Directory

```bash
# Start API server (local)
pnpm dev:api

# Start UI server
pnpm dev

# Start Wrangler dev (production DB - NOT for local dev)
pnpm dev:worker

# Build frontend
pnpm build

# Build for Cloudflare Pages
pnpm build:pages

# Deploy to Cloudflare Pages
pnpm deploy:pages

# Deploy API to Cloudflare Workers
pnpm deploy:api
```

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using a port
lsof -i :3010  # UI
lsof -i :9090  # API

# Kill process on port
lsof -ti :3010 | xargs -r kill -9
```

### Database Issues

```bash
# Reset local database
rm /workspaces/dead-drop/apps/core/.wrangler/state/local.db
# Database will be recreated on next start
```

### Module Resolution Issues

```bash
# Clean and reinstall
rm -rf node_modules .next
pnpm install
```

---

## API Endpoints

All endpoints are documented at: `http://localhost:9090/api/docs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/drops/generate-name` | Generate random drop name |
| GET | `/api/drops/check/{id}` | Check if drop exists |
| GET | `/api/drops/{id}` | Get drop data |
| POST | `/api/drops` | Create new drop |
| PUT | `/api/drops/{id}` | Update drop |
| DELETE | `/api/drops/{id}` | Delete drop |
| GET | `/api/drops/{id}/history` | List drop versions |
| GET | `/api/drops/{id}/history/{version}` | Get specific version |
| POST | `/api/drops/{id}/upgrade` | Upgrade to Deep tier |

---

## Important Notes

1. **Never use `wrangler dev` for local development** - it uses production database config. Always use `pnpm dev:api`.

2. **Local API shares 100% of production API code** - The only difference is the database adapter (`d1-adapter.ts` for local, D1 for production).

3. **Hash-based routing** - Drop access uses URL fragments (`/#drop-name`) for privacy - the fragment never reaches the server.

4. **Database Schema** - Located at `apps/core/schema.sql` - uses `IF NOT EXISTS` so it can be run multiple times safely.

5. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` - Override API URL for UI (default: `http://localhost:9090` in dev, `https://api.dead-drop.xyz` in prod)
   - `ADMIN_HASH_PEPPER` - Secret pepper for admin hash derivation
   - `UPGRADE_TOKEN` - Secret token for upgrading drops (mock payment)
