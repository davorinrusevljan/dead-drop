# Cloudflare Deployment Plan for dead-drop

## Overview

This document outlines the deployment process for the **Admin Panel** on Cloudflare.

> **Note:** Core API and Frontend are already deployed. This guide focuses only on the Admin Panel components.

## Already Deployed (Do Not Recreate)

| Component | Name | Status |
|-----------|------|--------|
| Core D1 Database | `dead-drop-core` | ✅ Already exists |
| Core API Worker | `dead-drop-core` | ✅ Already deployed |
| Core Frontend (Pages) | `dead-drop` | ✅ Already deployed |

## What We Need to Deploy

| Component | Name | Description |
|-----------|------|-------------|
| Admin D1 Database | `dead-drop-admin` | Stores admin users |
| Admin API Worker | `dead-drop-admin-api` | Handles authentication & stats |
| Admin Frontend (Pages) | `dead-drop-admin` | Admin panel UI |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE EDGE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐                               │
│  │  Core Frontend  │     │  Admin Frontend │  ← TO DEPLOY                  │
│  │  (Pages) ✅      │     │  (Pages)        │                               │
│  │  dead-drop.xyz  │     │  admin.dead-    │                               │
│  │                 │     │  drop.xyz       │                               │
│  └────────┬────────┘     └────────┬────────┘                               │
│           │                       │                                         │
│           ▼                       ▼                                         │
│  ┌─────────────────┐     ┌─────────────────┐                               │
│  │   Core API      │     │   Admin API     │  ← TO DEPLOY                  │
│  │   (Worker) ✅    │     │   (Worker)      │                               │
│  │ api.dead-       │     │ admin-api.dead- │                               │
│  │ drop.xyz        │     │ drop.xyz        │                               │
│  └────────┬────────┘     └────────┬────────┘                               │
│           │                       │                                         │
│           ▼                       ▼                                         │
│  ┌─────────────────┐     ┌─────────────────┐                               │
│  │   Core D1 DB    │     │   Admin D1 DB   │  ← TO CREATE                  │
│  │   (drops, etc)  │◄────│   (users)      │                               │
│  │      ✅          │     │                 │                               │
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

3. **Domain configured** in Cloudflare:
   - `dead-drop.xyz` - Core frontend ✅
   - `api.dead-drop.xyz` - Core API ✅
   - `admin.dead-drop.xyz` - Admin frontend (to configure)
   - `admin-api.dead-drop.xyz` - Admin API (to configure)

---

## Phase 1: Create Admin D1 Database

```bash
# Create the admin database
wrangler d1 create dead-drop-admin

# Note the database_id from the output!
# Example: database_id = "abc12345-1234-5678-9012-abcdef123456"

# Apply the schema
wrangler d1 execute dead-drop-admin --remote --file=apps/admin/schema.sql

# Verify tables were created
wrangler d1 execute dead-drop-admin --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### Update wrangler.toml Files

Update `apps/admin/wrangler.api.toml` with the new database ID:

```toml
# Admin database (separate from core for security isolation)
[[d1_databases]]
binding = "ADMIN_DB"
database_name = "dead-drop-admin"
database_id = "YOUR-NEW-ADMIN-DB-ID"  # <-- Update this

# Core database (read-only for stats) - already exists
[[d1_databases]]
binding = "CORE_DB"
database_name = "dead-drop-core"
database_id = "d7b160c6-078a-40db-a51c-29eb73bc8eb2"  # Keep existing
```

Also update `apps/admin/wrangler.toml` with the same bindings.

---

## Phase 2: Configure Admin API Secrets

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

## Phase 3: Deploy Admin API Worker

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

## Phase 5: Deploy Admin Frontend (Pages)

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

### Configure Pages Environment Variables

```bash
wrangler pages secret put NEXT_PUBLIC_API_URL --project-name=dead-drop-admin
# Value: https://admin-api.dead-drop.xyz
```

---

## Phase 6: Configure Custom Domains (Optional)

### Admin Frontend Domain

```bash
# Add custom domain to Admin Frontend
wrangler pages domain create dead-drop-admin admin.dead-drop.xyz
```

### Admin API Domain

```bash
# Add custom route to Admin API Worker
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

- [ ] **Phase 1: Admin Database**
  - [ ] Create `dead-drop-admin` D1 database
  - [ ] Apply admin schema
  - [ ] Update `apps/admin/wrangler*.toml` with database ID

- [ ] **Phase 2: Admin API Secrets**
  - [ ] Set `JWT_SECRET` for Admin API Worker
  - [ ] Store secret securely

- [ ] **Phase 3: Admin API Worker**
  - [ ] Deploy Admin API Worker
  - [ ] Verify Admin API health

- [ ] **Phase 4: Admin User**
  - [ ] Create initial superadmin user
  - [ ] Test login via API

- [ ] **Phase 5: Admin Frontend**
  - [ ] Build and deploy Admin Frontend to Pages
  - [ ] Set environment variables

- [ ] **Phase 6: Domains (Optional)**
  - [ ] Configure `admin.dead-drop.xyz`
  - [ ] Configure `admin-api.dead-drop.xyz`

- [ ] **Phase 7: Final Configuration**
  - [ ] Update CORS for production
  - [ ] Redeploy Admin API
  - [ ] Test full login flow in production

---

## Quick Deployment Commands (Summary)

```bash
# === PHASE 1: Admin Database ===
wrangler d1 create dead-drop-admin
wrangler d1 execute dead-drop-admin --remote --file=apps/admin/schema.sql
# Update database_id in apps/admin/wrangler*.toml

# === PHASE 2: Admin Secrets ===
wrangler secret put JWT_SECRET --name dead-drop-admin-api

# === PHASE 3: Deploy Admin API ===
cd apps/admin && pnpm deploy:api

# === PHASE 4: Create Admin User ===
cd apps/admin && ./scripts/bootstrap-admin-remote.sh superadmin "YOUR-PASSWORD"

# === PHASE 5: Deploy Admin Frontend ===
cd apps/admin && NEXT_PUBLIC_API_URL=https://admin-api.dead-drop.xyz pnpm deploy:pages
```

---

## Rollback Procedure

If something goes wrong:

```bash
# Rollback Admin API to previous version
wrangler rollback dead-drop-admin-api

# Rollback Admin Pages deployment
wrangler pages deployment list --project-name=dead-drop-admin
wrangler pages deployment rollback --project-name=dead-drop-admin --deployment-id=<DEPLOYMENT_ID>
```

---

## Monitoring & Logs

```bash
# Tail Admin API logs
wrangler tail dead-drop-admin-api

# View Admin Pages deployment logs
wrangler pages deployment tail --project-name=dead-drop-admin
```
