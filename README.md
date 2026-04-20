# dead-drop.xyz

Privacy-focused, ephemeral data-sharing service running on Cloudflare Workers.

**Live sites:**
- **Main app**: [dead-drop.xyz](https://dead-drop.xyz)
- **Admin panel**: [admin.dead-drop.xyz](https://admin.dead-drop.xyz)

## Features

- **Free drops**: 10KB, 7-day lifespan, text only
- **Deep drops** (coming soon): 4MB, 90-day lifespan, files supported
- **Zero-knowledge encryption**: Content encrypted client-side
- **Version history**: Track all changes with 5 version limit
- **Public & Private drops**: Choose visibility level

## Quick Start

### Prerequisites

- Node.js 22.x
- pnpm 9.x
- Git

### Installation

```bash
git clone <repository-url>
cd dead-drop
pnpm install
```

### Local Development

```bash
# Copy environment template
cp apps/core/.env.example apps/core/.env.local

# Start development servers
pnpm dev
```

This starts:
- API server on `http://localhost:9090`
- Frontend on `http://localhost:3010`

### Environment Configuration

See [docs/environment.md](docs/environment.md) for detailed setup instructions.

**Quick reference:**
- Local: `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:9090`
- Production: Deploy script sets `NEXT_PUBLIC_API_URL=https://api.dead-drop.xyz`

## Development

```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm test:coverage     # Run tests with coverage
pnpm lint             # Lint code
pnpm typecheck        # TypeScript checking
```

### Server Ports

| Service | Port | URL |
|---------|------|-----|
| Core API | 9090 | http://localhost:9090 |
| Core Web | 3010 | http://localhost:3010 |

## Deployment

### Prerequisites

1. Cloudflare account with D1 and Workers enabled
2. Wrangler CLI: `npx wrangler login`
3. Domain configured in Cloudflare

### Deploy Core App

```bash
cd apps/core

# Set secrets (first time only)
wrangler secret put ADMIN_HASH_PEPPER --name dead-drop-core
wrangler secret put UPGRADE_TOKEN --name dead-drop-core

# Deploy API
pnpm deploy:api

# Deploy Frontend
pnpm deploy:pages
```

See [CLAUDE.md](CLAUDE.md) for detailed deployment instructions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                            │
├─────────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                      │
│  │   Frontend   │      │   API Worker  │                      │
│  │   (Pages)    │──────▶│  (Hono)      │                      │
│  │ dead-drop.xyz │      │  /api/v1/*   │                      │
│  └──────┬───────┘      └──────┬───────┘                      │
│         │                     │                              │
│         ▼                     ▼                              │
│  ┌──────────────────────────────────────┐                        │
│  │         D1 Database               │                        │
│  │         (drops)                   │                        │
│  └──────────────────────────────────────┘                        │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Documentation

- [Claude AI Config](CLAUDE.md) - AI assistant configuration
- [Environment Setup](docs/environment.md) - Local and production env configuration
- [API Versioning Plan](docs/api-versioning-plan.md) - v1 API structure
- [API Changes](API_CHANGES.md) - API version history
- [Design Document](initial-design.md) - Full system design

## License

MIT
