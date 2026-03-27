# dead-drop Development & Deployment Guide

## Quick Start (Recommended)

### Using the Server Management Script

```bash
# Start all servers at once
/workspaces/dead-drop/scripts/servers.sh start all

# Check server status
/workspaces/dead-drop/scripts/servers.sh status

# Create admin user (if needed)
/workspaces/dead-drop/scripts/servers.sh bootstrap

# Stop all servers
/workspaces/dead-drop/scripts/servers.sh stop all
```

**Server Ports:**
| Service | Port | URL |
|---------|------|-----|
| Core API | 9090 | http://localhost:9090 |
| Admin API | 9091 | http://localhost:9091 |
| Core Web | 3010 | http://localhost:3010 |
| Admin Web | 3011 | http://localhost:3011 |

**Default login:** `admin` / `admin123`

---

## Manual Start (Alternative)

### Core App

```bash
# Terminal 1: Start API server
cd /workspaces/dead-drop/apps/core
pnpm dev:api

# Terminal 2: Start Frontend (with local API URL)
cd /workspaces/dead-drop/apps/core
NEXT_PUBLIC_API_URL=http://localhost:9090 pnpm dev
```

### Admin Panel

```bash
# Terminal 1: Start Admin API server
cd /workspaces/dead-drop/apps/admin
JWT_SECRET=dev-secret-key-min-32-chars pnpm dev:api

# Terminal 2: Start Admin Frontend
cd /workspaces/dead-drop/apps/admin
pnpm dev
```

---

## Stopping Servers

### Using the Script (Recommended)
```bash
# Stop all servers
/workspaces/dead-drop/scripts/servers.sh stop all

# Stop specific server
/workspaces/dead-drop/scripts/servers.sh stop core-api
/workspaces/dead-drop/scripts/servers.sh stop admin-api
/workspaces/dead-drop/scripts/servers.sh stop core-web
/workspaces/dead-drop/scripts/servers.sh stop admin-web
```

### Manual Kill (if needed)
```bash
# Kill processes on specific ports
pkill -f "tsx.*core.*server.ts"  # Core API
pkill -f "tsx.*admin.*server.ts" # Admin API
pkill -f "next dev.*3010"        # Core Web
pkill -f "next dev.*3011"        # Admin Web
```

### Verify ports are free:
```bash
/workspaces/dead-drop/scripts/servers.sh status
```

---

## Admin Panel Specifics

### Architecture
```
┌──────────────────┐         ┌──────────────────┐
│   Admin Frontend │  HTTP   │   Admin API      │
│   Next.js        │ ──────► │   Hono + SQLite  │
│   port 3011      │         │   port 9091      │
└──────────────────┘         └────────┬─────────┘
                                      │
                            ┌─────────┴─────────┐
                            │                   │
                     ┌──────▼──────┐    ┌───────▼──────┐
                     │  Admin DB   │    │   Core DB    │
                     │ (users)     │    │  (stats)     │
                     └─────────────┘    └──────────────┘
```

### Create Admin User
```bash
cd /workspaces/dead-drop/apps/admin
JWT_SECRET=dev-secret-key-min-32-chars pnpm bootstrap-admin --username admin --password admin123
```

### Admin Scripts
| Script | Description |
|--------|-------------|
| `pnpm dev:api` | Start admin API server (port 9091) |
| `pnpm dev` | Start admin frontend (port 3011) |
| `pnpm bootstrap-admin` | Create first superadmin user |

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

### Port already in use
The server wasn't stopped properly. Kill remaining processes:
```bash
# Use the script to stop all servers
/workspaces/dead-drop/scripts/servers.sh stop all

# Or kill by port
pkill -f "tsx.*server.ts"   # API servers
pkill -f "next dev"          # Web frontends
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

### Admin login returns "Network Error"
1. Make sure Admin API is running on port 9091:
   ```bash
   curl http://localhost:9091/api/health
   ```
2. If not running, start it:
   ```bash
   /workspaces/dead-drop/scripts/servers.sh start admin-api
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
