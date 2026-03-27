# dead-drop.xyz

A privacy-focused, ephemeral data-sharing service running on Cloudflare Workers.

**Live sites:**
- **Main app**: [dead-drop.xyz](https://dead-drop.xyz)
- **Admin panel**: [admin.dead-drop.xyz](https://admin.dead-drop.xyz)

## Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- Git

### Quick Start

```bash
# Clone and open in dev container
git clone <repository-url>
cd dead-drop
code .

# Click "Reopen in Container" when prompted

# Install dependencies
pnpm install

# Start all servers (core + admin)
/workspaces/dead-drop/scripts/servers.sh start all

# Check status
/workspaces/dead-drop/scripts/servers.sh status
```

### Server Ports

| Service | Port | URL |
|---------|------|-----|
| Core API | 9090 | http://localhost:9090 |
| Admin API | 9091 | http://localhost:9091 |
| Core Web | 3010 | http://localhost:3010 |
| Admin Web | 3011 | http://localhost:3011 |

### Manual Start (Alternative)

**Core App:**
```bash
# Terminal 1: API
cd apps/core && pnpm dev:api

# Terminal 2: Frontend
cd apps/core && NEXT_PUBLIC_API_URL=http://localhost:9090 pnpm dev
```

**Admin Panel:**
```bash
# Terminal 1: API
cd apps/admin && JWT_SECRET=dev-secret-key-min-32-chars pnpm dev:api

# Terminal 2: Frontend
cd apps/admin && pnpm dev
```

### Create Local Admin User

```bash
cd apps/admin
JWT_SECRET=dev-secret-key-min-32-chars pnpm bootstrap-admin --username admin --password admin123
```

Access admin panel at: http://localhost:3011/login

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE EDGE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │  Core Frontend  │     │  Admin Frontend │     │  (Future SaaS)  │       │
│  │  (Pages)        │     │  (Pages)        │     │                 │       │
│  │  dead-drop.xyz  │     │  admin.dead-    │     │  saas.dead-     │       │
│  │                 │     │  drop.xyz       │     │  drop.xyz       │       │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘       │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │   Core API      │     │   Admin API     │     │   SaaS API      │       │
│  │   (Worker)      │     │   (Worker)      │     │   (Worker)      │       │
│  │ api.dead-       │     │ admin-api.dead- │     │ saas-api.dead-  │       │
│  │ drop.xyz        │     │ drop.xyz        │     │ drop.xyz        │       │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘       │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │   Core D1 DB    │◄────│   Admin D1 DB   │     │   SaaS D1 DB    │       │
│  │   (drops)       │     │   (users)       │     │   (subscriptions)│      │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cloudflare Deployment

### Prerequisites

1. Cloudflare account with D1 and Workers enabled
2. Wrangler CLI authenticated:
   ```bash
   wrangler login
   wrangler whoami
   ```
3. Domain configured in Cloudflare (`dead-drop.xyz`)

### Cloudflare Resources

| Resource | Name | ID |
|----------|------|-----|
| Core D1 Database | `dead-drop-core` | `d7b160c6-078a-40db-a51c-29eb73bc8eb2` |
| Admin D1 Database | `dead-drop-admin` | `002a7e33-34a7-4928-aaf0-315dc588c9ad` |
| Core API Worker | `dead-drop-core` | - |
| Admin API Worker | `dead-drop-admin-api` | - |
| Core Frontend (Pages) | `dead-drop` | - |
| Admin Frontend (Pages) | `dead-drop-admin` | - |

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

### Deploy Admin Panel

```bash
cd apps/admin

# Set JWT secret (first time only)
wrangler secret put JWT_SECRET --name dead-drop-admin-api
# Use a secure random string (min 32 characters)

# Deploy API
pnpm deploy:api

# Deploy Frontend
pnpm deploy:pages
```

### Create Production Admin User

**Option 1: Using Node.js script (recommended)**

Create a temporary script to generate the hash:

```bash
node -e "
const password = 'YOUR-SECURE-PASSWORD';
const salt = require('crypto').randomBytes(16).toString('hex');

(async () => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hash = Buffer.from(bits).toString('base64');
  console.log('Salt:', salt);
  console.log('Hash:', hash);
})();
"
```

Then insert into D1:

```bash
wrangler d1 execute dead-drop-admin --remote --command="
INSERT INTO admin_users (username, password_hash, salt, role, created_at)
VALUES ('superadmin', 'HASH_FROM_ABOVE', 'SALT_FROM_ABOVE', 'superadmin', unixepoch());
"
```

**Option 2: Verify existing user**

```bash
wrangler d1 execute dead-drop-admin --remote --command="
SELECT id, username, role, created_at FROM admin_users;
"
```

### Custom Domains

Domains are configured via Cloudflare Dashboard or wrangler routes:

| Domain | Type | Target |
|--------|------|--------|
| `dead-drop.xyz` | Pages | dead-drop |
| `api.dead-drop.xyz` | Worker Route | dead-drop-core |
| `admin.dead-drop.xyz` | Pages | dead-drop-admin |
| `admin-api.dead-drop.xyz` | Worker Route | dead-drop-admin-api |

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js frontend (port 3010/3011) |
| `pnpm dev:api` | Start local API server (port 9090/9091) |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm lint` | Lint all code |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm deploy:api` | Deploy API to Cloudflare Workers |
| `pnpm deploy:pages` | Deploy frontend to Cloudflare Pages |

### Package-specific Commands

```bash
# Run tests for specific package
pnpm --filter @dead-drop/engine test
pnpm --filter @dead-drop/core test
pnpm --filter @dead-drop/admin test

# Run coverage for specific package
pnpm --filter @dead-drop/engine test:coverage
```

---

## Troubleshooting

### Port already in use

```bash
# Stop all servers
/workspaces/dead-drop/scripts/servers.sh stop all

# Or kill specific processes
pkill -f "tsx.*server.ts"   # API servers
pkill -f "next dev"          # Frontends
```

### Frontend can't connect to API

1. Verify API is running: `curl http://localhost:9090/api/health`
2. Check browser console for CORS errors
3. Ensure correct `NEXT_PUBLIC_API_URL` environment variable

### Admin login fails in production

1. Check API health: `curl https://admin-api.dead-drop.xyz/api/health`
2. Verify user exists in database
3. Check browser console for CORS or cookie errors
4. Ensure cookies are enabled (not blocked by browser)

### Reset local database

```bash
rm -rf apps/core/.wrangler/state
rm -rf apps/admin/.wrangler/state
```

---

## Documentation

- [Design Document](./initial-design.md) - Full system design
- [Frontend Redesign Plan](./FRONTEND-REDESIGN-PLAN.md) - Future UI improvements
