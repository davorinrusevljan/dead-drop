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
```

### Server Ports

| Service | Port | URL |
|---------|------|-----|
| Core API | 9090 | http://localhost:9090 |
| Admin API | 9091 | http://localhost:9091 |
| Core Web | 3010 | http://localhost:3010 |
| Admin Web | 3011 | http://localhost:3011 |

### Manual Start (Alternative)

**⚠️ CRITICAL - ALWAYS check ports before starting servers:**
- NEVER start any dev server without first checking if the port is in use
- Check: `lsof -ti :<port>` - this shows which process is using each port
- Kill if occupied: `lsof -ti :<port> | xargs -r kill -9`
- Example (before starting core API): `lsof -ti :9090 | xargs -r kill -9`
- If you skip this step, you'll cause port conflicts and "hung" processes

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
cd apps/admin && pnpm dev:api

# Terminal 2: Frontend
cd apps/admin && pnpm dev
```

**Create `.dev.vars` for admin:**
```bash
# apps/admin/.dev.vars
JWT_SECRET=dev-secret-key-min-32-chars
```

### Create Local Admin User

```bash
cd apps/admin
pnpm bootstrap-admin --username admin --password admin123
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
│  │  Core Frontend  │     │  Admin Frontend │     │  SaaS Frontend  │       │
│  │  (Pages)        │     │  (Pages)        │     │  (Pages)        │       │
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
│  │   Core D1 DB    │     │   Admin D1 DB   │     │   SaaS D1 DB    │       │
│  │   (drops)       │     │   (users)       │     │   (subscriptions)│      │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Shared Engine Package

The `@dead-drop/engine` package contains shared logic used across all applications:

- **Validation**: Zod schemas for drop phrases, payload types
- **Crypto**: Web Crypto API wrappers (AES-GCM, PBKDF2, SHA-256)
- **Database**: Drizzle ORM schemas and the D1-compatible local adapter
- **Local Development**: `createLocalD1Database()` function for running locally with SQLite

The D1-compatible adapter allows you to run the exact same API code locally and in production:
- **Local**: Uses `better-sqlite3` wrapped in a D1-compatible interface
- **Production**: Uses real Cloudflare D1 database

```typescript
import { createLocalD1Database } from '@dead-drop/engine';

// Local dev
const db = createLocalD1Database('./local.db', './schema.sql');

// Production (via Cloudflare Workers binding)
// Uses env.DB directly
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
4. Copy `wrangler.toml.example` and `wrangler.api.toml.example` to create your config files with your database IDs

### Setup Wrangler Configuration

For security, `wrangler.toml` files with database IDs are not tracked in git. You must create them from templates:

**Core App:**
```bash
cd apps/core

# Create config files from templates
cp wrangler.toml.example wrangler.toml
cp wrangler.api.toml.example wrangler.api.toml

# Edit the files and replace <YOUR-DATABASE-ID> with your actual ID
# To find your database ID:
wrangler d1 info dead-drop-core
```

**Admin Panel:**
```bash
cd apps/admin

# Create config files from templates
cp wrangler.toml.example wrangler.toml
cp wrangler.api.toml.example wrangler.api.toml

# Edit the files and replace <YOUR-ADMIN-DB-ID> and <YOUR-CORE-DB-ID> with actual IDs
# To find database IDs:
wrangler d1 info dead-drop-admin
wrangler d1 info dead-drop-core
```

**Important:** The actual `wrangler.toml` and `wrangler.api.toml` files are in `.gitignore` and will never be committed.
4. Copy `wrangler.toml.example` and `wrangler.api.toml.example` to create your config files with your database IDs

### Cloudflare Resources

| Resource | Name |
|----------|------|
| Core D1 Database | `dead-drop-core` |
| Admin D1 Database | `dead-drop-admin` |
| Core API Worker | `dead-drop-core` |
| Admin API Worker | `dead-drop-admin-api` |
| Core Frontend (Pages) | `dead-drop` |
| Admin Frontend (Pages) | `dead-drop-admin` |

**To find database IDs:**
```bash
# List all D1 databases
wrangler d1 list

# Get specific database ID
wrangler d1 info dead-drop-core
wrangler d1 info dead-drop-admin
```

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

**⚠️ ALWAYS check ports before starting servers:**

```bash
# Check what's using a port
lsof -i :3010  # Core UI
lsof -i :9090  # Core API
lsof -i :3011  # Admin UI
lsof -i :9091  # Admin API

# Kill process on port
lsof -ti :9090 | xargs -r kill -9

# Or kill all dev processes
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

## Pre-Commit Workflow

The project uses lint-staged with Husky for automated code quality:

- **Pre-commit hook**: `.husky/pre-commit` runs `npx lint-staged`
- **lint-staged config**: `.lintstagedrc` runs `eslint --fix`, `prettier --write`, and `git add` on staged files
- **Important**: After `prettier --write` modifies files, they are automatically re-staged before commit

This means:
1. Edit files and stage them with `git add`
2. Pre-commit runs: `eslint --fix` → `prettier --write` → `git add` (automatic)
3. Commit includes the fixed formatting ✅

If you edit files and commit directly (bypassing pre-commit), the formatting won't be fixed.

---

## Documentation

- [Design Document](./initial-design.md) - Full system design
- [API Reference](./docs/api-reference.md) - Complete API documentation
- [Frontend Redesign Plan](./FRONTEND-REDESIGN-PLAN.md) - Future UI improvements
- [API Changes](./API_CHANGES.md) - API version history and changes
