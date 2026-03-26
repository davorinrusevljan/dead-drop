# dead-drop.xyz

A privacy-focused, ephemeral data-sharing service running on Cloudflare Workers.

**Live site: [dead-drop.xyz](https://dead-drop.xyz)**

## Development Setup

### Prerequisites

Before starting, ensure you have installed:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- Git

### Getting Started

1. **Clone and open in dev container:**
   ```bash
   git clone <repository-url>
   cd dead-drop
   code .
   ```

2. **Reopen in container:**
   - VS Code will prompt "Reopen in Container"
   - Click "Reopen in Container"
   - Wait for container to build (first time takes a few minutes)

3. **Install dependencies:**
   ```bash
   pnpm install
   ```

### Local Development

The project requires two separate servers: API and Frontend.

**Terminal 1: Start API Server**
```bash
cd /workspaces/dead-drop/apps/core
pnpm dev:api
```
- Runs on port 9090 by default
- Uses local SQLite database at `apps/core/.wrangler/state/local.db`

**Terminal 2: Start Frontend**
```bash
cd /workspaces/dead-drop/apps/core
NEXT_PUBLIC_API_URL=http://localhost:9090 pnpm dev
```
- Runs on port 3010

### Stopping Servers

**Properly stop the API server:**
- Press `Ctrl+C` in the terminal where `pnpm dev:api` is running
- The server handles graceful shutdown and releases the port

**Kill any remaining processes:**
```bash
# Find and kill tsx server processes
for dir in /proc/[0-9]*; do
  pid=$(basename $dir)
  cmdline=$(cat "$dir/cmdline" 2>/dev/null | tr '\0' ' ')
  if echo "$cmdline" | grep -q "tsx.*server.ts"; then
    kill -9 $pid 2>/dev/null
  fi
done
```

**Verify port is free:**
```bash
node -e "
const net = require('net');
const s = net.createServer();
s.listen(9090, () => { console.log('Port 9090 is FREE'); s.close(() => process.exit(0)); });
s.on('error', (e) => console.log('Port in use:', e.code));
"
```

## Cloudflare Deployment

### Prerequisites
- Cloudflare account with D1 and Workers enabled
- wrangler authenticated: `wrangler login`

### Deploy API (Cloudflare Workers)
```bash
cd /workspaces/dead-drop/apps/core
pnpm deploy:api
```
Deploys to: https://api.dead-drop.xyz

### Deploy Frontend (Cloudflare Pages)
```bash
cd /workspaces/dead-drop/apps/core
pnpm deploy:pages
```
Deploys to: https://dead-drop.xyz

### Setting API Secrets
```bash
wrangler secret put ADMIN_HASH_PEPPER --name dead-drop-core
wrangler secret put UPGRADE_TOKEN --name dead-drop-core
```

### Key Cloudflare Resources
| Resource | Name |
|----------|------|
| D1 Database | dead-drop-core |
| API Worker | dead-drop-core |
| Pages Project | dead-drop |

## Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js frontend (port 3010) |
| `pnpm dev:api` | Start local API server (port 9090) |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm lint` | Lint all code |
| `pnpm deploy:api` | Deploy API to Cloudflare Workers |
| `pnpm deploy:pages` | Deploy frontend to Cloudflare Pages |

## Architecture

```
LOCAL DEVELOPMENT
=================

┌──────────────────┐         ┌──────────────────┐
│   Frontend       │  HTTP   │   API            │
│   Next.js        │ ──────► │   Hono + SQLite  │
│   port 3010      │         │   port 9090      │
└──────────────────┘         └────────┬─────────┘
                                      │
                            ┌─────────▼─────────┐
                            │   Local SQLite    │
                            │   .wrangler/state │
                            └───────────────────┘

PRODUCTION
==========

┌──────────────────┐         ┌──────────────────┐
│   Frontend       │  HTTP   │   API            │
│   Cloudflare     │ ──────► │   Cloudflare     │
│   Pages          │         │   Workers        │
│   dead-drop.xyz  │         │   api.dead-drop  │
└──────────────────┘         └────────┬─────────┘
                                      │
                            ┌─────────▼─────────┐
                            │   Cloudflare D1   │
                            │   SQLite          │
                            └───────────────────┘
```

## Documentation

- [Development & Deployment Guide](./DEV_DEPLOY.md) - Detailed local dev and deployment instructions
- [Design Document](./initial-design.md) - Full system design
