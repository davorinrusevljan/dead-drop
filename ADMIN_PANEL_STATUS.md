# Admin Panel Implementation Status

## Task Overview
Implement an admin panel for dead-drop.xyz with:
- Login-protected dashboard
- Statistics from existing drop data
- User management for admin accounts
- Separate database for admin users (security isolation)

## What's Completed

### 1. Code Implementation ✅
- **Location**: `apps/admin/`
- **Frontend**: Next.js on port 3011
  - Login page: `src/app/login/page.tsx`
  - Dashboard with Recharts: `src/app/dashboard/page.tsx`
  - User management: `src/app/users/page.tsx`
- **API**: Hono on port 9091
  - Auth routes: `src/api/routes/auth.ts` (login, logout, me)
  - Stats routes: `src/api/routes/stats.ts` (overview, distribution, activity)
  - User routes: `src/api/routes/users.ts` (CRUD for admin users)
- **Database**: Separate SQLite for admin users
  - Schema: `apps/admin/schema.sql` (admin_users table)
  - Stored in: `apps/admin/.wrangler/state/admin.db`
- **Tests**: 28 tests passing in `src/lib/*.test.ts`

### 2. Git Commit ✅
- Commit: `6947261 Add admin panel for monitoring and user management`
- 33 files changed, 3,646 insertions

### 3. Login Issue RESOLVED ✅

**Root Cause:** The original "Network Error" was caused by:
1. Admin API server was not running (port 9091)
2. Cookie `Secure` flag was blocking cookies over HTTP localhost (fixed in `src/lib/jwt.ts`)

**Fixes Applied:**
- Cookie options updated in `src/lib/jwt.ts` - removed `Secure` flag for local development
- Created server management script (`scripts/servers.sh`) for reliable start/stop

## How to Use

### Quick Start
```bash
# Start all servers
/workspaces/dead-drop/scripts/servers.sh start all

# Check status
/workspaces/dead-drop/scripts/servers.sh status

# Stop all servers
/workspaces/dead-drop/scripts/servers.sh stop all
```

### Manual Start
```bash
# Start Admin API (Terminal 1)
cd /workspaces/dead-drop/apps/admin
JWT_SECRET=dev-secret-key-min-32-chars pnpm dev:api

# Start Admin Web (Terminal 2)
cd /workspaces/dead-drop/apps/admin
pnpm dev
```

### Create Admin User
```bash
cd /workspaces/dead-drop/apps/admin
JWT_SECRET=dev-secret-key-min-32-chars pnpm bootstrap-admin --username admin --password admin123
```

### Test Login
```bash
# Via curl
curl -v -X POST http://localhost:9091/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Should return: {"success":true,"user":{...}}
# And set a cookie: admin_auth_token=...
```

### Browser Access
- **Admin Panel**: http://localhost:3011/login
- **Login**: `admin` / `admin123`

## Architecture

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

## Key Files

| File | Purpose |
|------|---------|
| `apps/admin/src/lib/jwt.ts` | JWT signing/verification, cookie options |
| `apps/admin/src/lib/api-config.ts` | API_BASE_URL for frontend |
| `apps/admin/src/dev/server.ts` | Local dev API server |
| `apps/admin/src/api/routes/auth.ts` | Login/logout endpoints |
| `scripts/servers.sh` | Server management script |
| `DEV_DEPLOY.md` | Full development guide |

## Production Notes

When deploying to production with HTTPS:
1. Add `Secure` flag back to cookie options in `jwt.ts`
2. Set proper `JWT_SECRET` environment variable (32+ chars)
3. Configure CORS to only allow the admin frontend domain
