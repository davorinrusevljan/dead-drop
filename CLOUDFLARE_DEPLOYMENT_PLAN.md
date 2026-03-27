# Cloudflare Deployment Plan for dead-drop

## Overview

This document outlines the complete deployment process for dead-drop on Cloudflare, including:
- D1 Databases (Core + Admin)
- Workers (Core API + Admin API)
- Pages (Core Frontend + Admin Frontend)
- Secrets and Environment Variables
- Initial Admin User Creation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE EDGE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐                               │
│  │  Core Frontend  │     │  Admin Frontend │                               │
│  │  (Pages)        │     │  (Pages)        │                               │
│  │  dead-drop.xyz  │     │  admin.dead-    │                               │
│  │                 │     │  drop.xyz       │                               │
│  └────────┬────────┘     └────────┬────────┘                               │
│           │                       │                                         │
│           ▼                       ▼                                         │
│  ┌─────────────────┐     ┌─────────────────┐                               │
│  │   Core API      │     │   Admin API     │                               │
│  │   (Worker)      │     │   (Worker)      │                               │
│  │ api.dead-       │     │ admin-api.dead- │                               │
│  │ drop.xyz        │     │ drop.xyz        │                               │
│  └────────┬────────┘     └────────┬────────┘                               │
│           │                       │                                         │
│           ▼                       ▼                                         │
│  ┌─────────────────┐     ┌─────────────────┐                               │
│  │   Core D1 DB    │     │   Admin D1 DB   │                               │
│  │   (drops, etc)  │◄────│   (users)      │                               │
│  └─────────────────┘     └─────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Cloudflare Account** with:
   - Workers Paid plan (recommended) or Free tier
   - D1 databases enabled
   - Pages enabled

2. **Authenticated Wrangler CLI**:
   ```bash
   wrangler login
   wrangler whoami  # Verify authentication
   ```

3. **Domain configured** in Cloudflare (optional but recommended):
   - `dead-drop.xyz` - Core frontend
   - `api.dead-drop.xyz` - Core API
   - `admin.dead-drop.xyz` - Admin frontend
   - `admin-api.dead-drop.xyz` - Admin API

---

## Phase 1: Create D1 Databases

### Step 1.1: Create Core Database

```bash
# Create the core database
wrangler d1 create dead-drop-core

# Note the database_id from the output!
# Example output:
# ✅ Successfully created DB 'dead-drop-core'
# database_id = "abc12345-1234-5678-9012-abcdef123456"

# Apply the schema
wrangler d1 execute dead-drop-core --remote --file=apps/core/schema.sql

# Verify tables were created
wrangler d1 execute dead-drop-core --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### Step 1.2: Create Admin Database

```bash
# Create the admin database
wrangler d1 create dead-drop-admin

# Note the database_id from the output!

# Apply the schema
wrangler d1 execute dead-drop-admin --remote --file=apps/admin/schema.sql

# Verify tables were created
wrangler d1 execute dead-drop-admin --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### Step 1.3: Update wrangler.toml Files

Update the `database_id` values in the following files with the actual IDs from Step 1.1 and 1.2:

**apps/core/wrangler.api.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "dead-drop-core"
database_id = "YOUR-CORE-DB-ID"  # <-- Update this
```

**apps/core/wrangler.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "dead-drop-core"
database_id = "YOUR-CORE-DB-ID"  # <-- Update this
```

**apps/admin/wrangler.api.toml:**
```toml
[[d1_databases]]
binding = "ADMIN_DB"
database_name = "dead-drop-admin"
database_id = "YOUR-ADMIN-DB-ID"  # <-- Update this

[[d1_databases]]
binding = "CORE_DB"
database_name = "dead-drop-core"
database_id = "YOUR-CORE-DB-ID"  # <-- Update this
```

**apps/admin/wrangler.toml:**
```toml
[[d1_databases]]
binding = "ADMIN_DB"
database_name = "dead-drop-admin"
database_id = "YOUR-ADMIN-DB-ID"  # <-- Update this

[[d1_databases]]
binding = "CORE_DB"
database_name = "dead-drop-core"
database_id = "YOUR-CORE-DB-ID"  # <-- Update this
```

---

## Phase 2: Configure Secrets

### Step 2.1: Core API Secrets

```bash
# Generate secure random values
ADMIN_PEPPER=$(openssl rand -base64 32)
UPGRADE_TOKEN=$(openssl rand -hex 32)

# Set secrets for Core API Worker
wrangler secret put ADMIN_HASH_PEPPER --name dead-drop-core
# Paste: $ADMIN_PEPPER

wrangler secret put UPGRADE_TOKEN --name dead-drop-core
# Paste: $UPGRADE_TOKEN
```

### Step 2.2: Admin API Secrets

```bash
# Generate secure JWT secret (min 32 characters)
JWT_SECRET=$(openssl rand -base64 32)

# Set secret for Admin API Worker
wrangler secret put JWT_SECRET --name dead-drop-admin-api
# Paste: $JWT_SECRET

# Store this securely! You'll need it for admin operations.
echo "JWT_SECRET: $JWT_SECRET" | tee -a .secrets.txt
```

**⚠️ Security Note:** Add `.secrets.txt` to `.gitignore` and store credentials in a password manager.

---

## Phase 3: Deploy API Workers

### Step 3.1: Deploy Core API

```bash
cd apps/core

# Build the engine package first (if not already built)
cd ../..
pnpm build

# Deploy Core API Worker
cd apps/core
pnpm deploy:api
# or: wrangler deploy -c wrangler.api.toml

# Verify deployment
curl https://dead-drop-core.YOUR-SUBDOMAIN.workers.dev/api/health
```

### Step 3.2: Deploy Admin API

```bash
cd apps/admin

# Deploy Admin API Worker
pnpm deploy:api
# or: wrangler deploy -c wrangler.api.toml

# Verify deployment
curl https://dead-drop-admin-api.YOUR-SUBDOMAIN.workers.dev/api/health
```

---

## Phase 4: Create Initial Admin User

### Option A: Use Remote Bootstrap Script (Recommended)

```bash
cd apps/admin

# Make the script executable
chmod +x scripts/bootstrap-admin-remote.sh

# Create superadmin user
./scripts/bootstrap-admin-remote.sh superadmin "YOUR-SECURE-PASSWORD-HERE"
```

This script:
1. Generates a secure random salt
2. Hashes the password using PBKDF2 (same algorithm as the app)
3. Inserts the user directly into the remote D1 database

### Option B: Manual D1 Insert

If you prefer to do it manually:

```bash
# Generate salt
SALT=$(openssl rand -base64 32 | tr -d '\n')

# Generate hash (requires Node.js)
PASSWORD_HASH=$(node -e "
const crypto = require('crypto');
const password = 'YOUR-PASSWORD';
const salt = '$SALT';
(async () => {
    const keyMaterial = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
    );
    console.log(Buffer.from(bits).toString('base64'));
})();
")

# Insert into D1
wrangler d1 execute dead-drop-admin --remote --command="
INSERT INTO admin_users (username, password_hash, salt, role, created_at)
VALUES ('superadmin', '$PASSWORD_HASH', '$SALT', 'superadmin', unixepoch());
"
```

### Verify Admin User

```bash
wrangler d1 execute dead-drop-admin --remote --command="
SELECT id, username, role, created_at FROM admin_users;
"
```

**Recommended Approach:** Use Option A (bootstrap script) for simplicity and consistency.

---

## Phase 5: Deploy Frontends (Pages)

### Step 5.1: Build and Deploy Core Frontend

```bash
cd apps/core

# Set environment variable for API URL
export NEXT_PUBLIC_API_URL=https://api.dead-drop.xyz

# Build for Cloudflare Pages
pnpm build:pages

# Deploy to Pages
wrangler pages deploy .vercel/output/static --project-name=dead-drop

# Or using the npm script:
# pnpm deploy:pages
```

### Step 5.2: Build and Deploy Admin Frontend

```bash
cd apps/admin

# Set environment variable for API URL
export NEXT_PUBLIC_API_URL=https://admin-api.dead-drop.xyz

# Build for Cloudflare Pages
pnpm build:pages

# Deploy to Pages
wrangler pages deploy .vercel/output/static --project-name=dead-drop-admin

# Or using the npm script:
# pnpm deploy:pages
```

### Step 5.3: Configure Pages Environment Variables

For each Pages project, set environment variables:

**Core Frontend (dead-drop):**
```bash
wrangler pages secret put NEXT_PUBLIC_API_URL --project-name=dead-drop
# Value: https://api.dead-drop.xyz
```

**Admin Frontend (dead-drop-admin):**
```bash
wrangler pages secret put NEXT_PUBLIC_API_URL --project-name=dead-drop-admin
# Value: https://admin-api.dead-drop.xyz
```

---

## Phase 6: Configure Custom Domains (Optional)

### Step 6.1: Core Frontend Domain

```bash
# Add custom domain to Core Frontend
wrangler pages domain create dead-drop dead-drop.xyz

# Or via Cloudflare Dashboard:
# Pages > dead-drop > Custom domains > Add domain
```

### Step 6.2: Core API Domain

```bash
# Add custom domain to Core API Worker
wrangler workers routes publish --name dead-drop-core

# In wrangler.api.toml, add:
# routes = [
#   { pattern = "api.dead-drop.xyz/*", zone_name = "dead-drop.xyz" }
# ]
```

### Step 6.3: Admin Frontend Domain

```bash
# Add custom domain to Admin Frontend
wrangler pages domain create dead-drop-admin admin.dead-drop.xyz
```

### Step 6.4: Admin API Domain

```bash
# Add custom domain to Admin API Worker
# In apps/admin/wrangler.api.toml, add:
# routes = [
#   { pattern = "admin-api.dead-drop.xyz/*", zone_name = "dead-drop.xyz" }
# ]
```

---

## Phase 7: Update CORS Configuration for Production

After deployment, update the CORS settings in the Admin API to use production origins.

Edit `apps/admin/src/api/index.ts`:

```typescript
// Production CORS configuration
const ALLOWED_ORIGINS = [
  'https://admin.dead-drop.xyz',
  'https://dead-drop.xyz',
];
```

Then redeploy:
```bash
cd apps/admin && pnpm deploy:api
```

---

## Deployment Checklist

- [ ] **Phase 1: Databases**
  - [ ] Create `dead-drop-core` D1 database
  - [ ] Apply core schema
  - [ ] Create `dead-drop-admin` D1 database
  - [ ] Apply admin schema
  - [ ] Update all `wrangler*.toml` with database IDs

- [ ] **Phase 2: Secrets**
  - [ ] Set `ADMIN_HASH_PEPPER` for Core API
  - [ ] Set `UPGRADE_TOKEN` for Core API
  - [ ] Set `JWT_SECRET` for Admin API
  - [ ] Store secrets securely

- [ ] **Phase 3: API Workers**
  - [ ] Deploy Core API Worker
  - [ ] Verify Core API health
  - [ ] Deploy Admin API Worker
  - [ ] Verify Admin API health

- [ ] **Phase 4: Admin User**
  - [ ] Create initial superadmin user
  - [ ] Test login via API

- [ ] **Phase 5: Frontends**
  - [ ] Build and deploy Core Frontend
  - [ ] Build and deploy Admin Frontend
  - [ ] Set environment variables

- [ ] **Phase 6: Domains (Optional)**
  - [ ] Configure `dead-drop.xyz`
  - [ ] Configure `api.dead-drop.xyz`
  - [ ] Configure `admin.dead-drop.xyz`
  - [ ] Configure `admin-api.dead-drop.xyz`

- [ ] **Phase 7: Final Configuration**
  - [ ] Update CORS for production
  - [ ] Redeploy Admin API
  - [ ] Test full login flow in production

---

## Quick Deployment Commands (Summary)

```bash
# === PHASE 1: Databases ===
wrangler d1 create dead-drop-core
wrangler d1 create dead-drop-admin
wrangler d1 execute dead-drop-core --remote --file=apps/core/schema.sql
wrangler d1 execute dead-drop-admin --remote --file=apps/admin/schema.sql

# === PHASE 2: Secrets ===
wrangler secret put ADMIN_HASH_PEPPER --name dead-drop-core
wrangler secret put UPGRADE_TOKEN --name dead-drop-core
wrangler secret put JWT_SECRET --name dead-drop-admin-api

# === PHASE 3: Deploy APIs ===
cd apps/core && pnpm deploy:api
cd apps/admin && pnpm deploy:api

# === PHASE 4: Create Admin ===
# (See Phase 4 details above)

# === PHASE 5: Deploy Frontends ===
cd apps/core && NEXT_PUBLIC_API_URL=https://api.dead-drop.xyz pnpm deploy:pages
cd apps/admin && NEXT_PUBLIC_API_URL=https://admin-api.dead-drop.xyz pnpm deploy:pages
```

---

## Rollback Procedure

If something goes wrong:

```bash
# Rollback Core API to previous version
wrangler rollback dead-drop-core

# Rollback Admin API to previous version
wrangler rollback dead-drop-admin-api

# Rollback Pages deployment
wrangler pages deployment list --project-name=dead-drop
wrangler pages deployment rollback --project-name=dead-drop --deployment-id=<DEPLOYMENT_ID>
```

---

## Monitoring & Logs

```bash
# Tail Core API logs
wrangler tail dead-drop-core

# Tail Admin API logs
wrangler tail dead-drop-admin-api

# View Pages deployment logs
wrangler pages deployment tail --project-name=dead-drop
```
