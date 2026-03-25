# dead-drop Development & Deployment Guide

## Quick Start

```bash
# Terminal 1: Start API server
cd /workspaces/dead-drop/apps/core
pnpm dev:api

# Terminal 2: Start Frontend
cd /workspaces/dead-drop/apps/core
pnpm dev
```

- **API**: http://localhost:9090
- **Frontend**: http://localhost:3010

---

## How to PROPERLY Stop the API Server

When you start `pnpm dev:api`, it spawns multiple processes. To properly stop it:

### Option 1: Press Ctrl+C in the terminal where you started it
This sends SIGINT to all child processes.

### Option 2: Kill all tsx server processes
```bash
# Run this to find and kill the server processes
for dir in /proc/[0-9]*; do
  pid=$(basename $dir)
  cmdline=$(cat "$dir/cmdline" 2>/dev/null | tr '\0' ' ')
  if echo "$cmdline" | grep -q "tsx.*server.ts"; then
    kill -9 $pid 2>/dev/null
  fi
done
```

### Verify port is free:
```bash
node -e "
const net = require('net');
const s = net.createServer();
s.listen(9090, () => { console.log('Port 9090 is FREE'); s.close(() => process.exit(0)); });
s.on('error', (e) => console.log('Port in use:', e.code));
"
```

---

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
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev:api` | Start local API server (port 9090) |
| `pnpm dev` | Start Next.js frontend (port 3010) |
| `pnpm test` | Run all tests |
| `pnpm build` | Build for production |
| `pnpm deploy:api` | Deploy API to Cloudflare Workers |
| `pnpm deploy:pages` | Deploy frontend to Cloudflare Pages |

---

## Configuration Files

| File | Purpose |
|------|---------|
| `apps/core/src/dev/server.ts` | Local API server (Node.js) |
| `apps/core/src/dev/db-local.ts` | Local SQLite database layer |
| `apps/core/.dev.vars` | Local secrets |
| `apps/core/schema.sql` | Database schema |
| `apps/core/src/lib/config.ts` | API URL resolution |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `9090` | Port for local API server |
| `NEXT_PUBLIC_API_URL` | `http://localhost:9090` | API URL for frontend |

---

## Troubleshooting

### Port 9090 already in use
The server wasn't stopped properly. Kill remaining processes:
```bash
# Kill tsx server processes
for dir in /proc/[0-9]*; do
  pid=$(basename $dir)
  cmdline=$(cat "$dir/cmdline" 2>/dev/null | tr '\0' ' ')
  if echo "$cmdline" | grep -q "tsx.*server.ts"; then
    kill -9 $pid 2>/dev/null
  fi
done
```

### Frontend can't connect to API
1. Verify API is running: `curl http://localhost:9090/api/health`
2. Check the port matches (default: 9090)
3. Check browser console for CORS errors

### Reset local database
```bash
rm -rf apps/core/.wrangler/state
pnpm dev:api  # Recreates database on startup
```

---

## Production Deployment

### Prerequisites
- Cloudflare account with D1 and Workers enabled
- wrangler authenticated: `wrangler login`

### Deploy API
```bash
cd /workspaces/dead-drop/apps/core

# First time: set secrets
wrangler secret put ADMIN_HASH_PEPPER --name dead-drop-core
wrangler secret put UPGRADE_TOKEN --name dead-drop-core

# Deploy
pnpm deploy:api
```
Deploys to: https://api.dead-drop.xyz

### Deploy Frontend
```bash
cd /workspaces/dead-drop/apps/core
pnpm deploy:pages
```
Deploys to: https://dead-drop.xyz
