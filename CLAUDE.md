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
├── saas/        # Production edition (Deep Drops, Stripe, R2)
└── admin/      # Admin panel

packages/
├── engine/     # Shared logic (schemas, crypto, db)
└── ui/         # Shared React components
```

## Key Commands

```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm deploy:api       # Deploy API to Cloudflare
pnpm deploy:pages     # Deploy frontend to Cloudflare
```

## API Versioning

The API uses URL path versioning: `/api/v1/*`

- **v1 endpoints**: All current API calls use v1
- **Response header**: `X-API-Version: 1.0.0` on all responses
- **Old routes**: `/api/*` returns 404 (redirected to v1 in previous versions)

See: [API Versioning Plan](./docs/api-versioning-plan.md)

## Environment Configuration

For local development setup and production deployment, see: [Environment Configuration](./docs/environment.md)

**Quick Start:**
```bash
cp apps/core/.env.example apps/core/.env.local
pnpm dev
```

## Testing

```bash
# Local API tests (via curl)
curl http://localhost:9090/api/v1/health

# E2E tests (Playwright)
cd e2e
npx playwright test --config=playwright.config.ts

# Test coverage
pnpm test:coverage
```

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
- **Port allocation**:
  - Core API: 9090
  - Admin API: 9091
  - Core UI: 3010
  - Admin UI: 3011

## Memory

See `/root/.claude/projects/-workspaces-dead-drop/memory/` for project-specific context and learnings.
