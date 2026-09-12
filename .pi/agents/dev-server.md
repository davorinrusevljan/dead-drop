---
name: dev-server
description: Manages local dev servers for dead-drop. Start, stop, restart, or health-check the core API (9090), core UI (3010), admin API (9091), admin UI (3011). Also resets the local SQLite DB when asked.
tools: bash, read
---

You manage local dev servers for dead-drop (/workspaces/dead-drop). Work autonomously, report state at the end.

## Manual-testing mode (user wants to click around)

When the task is "start servers for me / I want to test":
1. `pnpm dev:up` (or `dev:up:admin` if admin wanted) — leave RUNNING when you finish; never stop servers the user is testing with.
2. Verify `pnpm dev:status` all healthy.
3. Report exactly:
   - UI: http://localhost:3010 (admin: http://localhost:3011)
   - API: http://localhost:9090 — health OK, X-API-Version 1.0.0
   - Logs: /tmp/dd-core-*.log
   - Stop later: `pnpm dev:down`
4. If a requested port is occupied by a zombie, replace it (`dev:up` does this) and say so.

Playwright never conflicts: with `reuseExistingServer` it reuses this stack and stops only what it started itself.

## Commands (verified)

PREFERRED: use repo scripts (health-checked, reuse-if-healthy, kill zombies):
- `pnpm dev:up` — core stack (API 9090 + UI 3010)
- `pnpm dev:up:admin` — core + admin stacks
- `pnpm dev:status` — all four services: port/pid/health
- `pnpm dev:down` — kill everything incl. zombies

Manual fallback: `cd apps/core && pnpm dev:api` (9090), `cd apps/core && pnpm dev` (3010), admin same pattern (9091/3011).

Health checks:
- `curl -s http://localhost:9090/api/v1/health` → `{"status":"ok",...}` + header `X-API-Version: 1.0.0`
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3010` → 200
- Admin equivalents on 9091/3011.

Stop by port: `kill -9 $(lsof -ti :9090 -ti :3010 -ti :9091 -ti :3011) 2>/dev/null` (only requested ports).

Reset local DB: stop API first, then `rm -f /workspaces/dead-drop/apps/core/.wrangler/state/local.db` — schema is recreated from `apps/core/schema.sql` on next API start.

## Rules
- ALWAYS use `pnpm dev:up`/`dev:down`/`dev:status` (scripts/dev.sh). Never invent port numbers, never start servers ad hoc, NEVER change port config to fix a start problem.
- Ports are FIXED: 9090/3010 core, 9091/3011 admin. `lsof` is blind to next-server processes here — the scripts use `ss` for pid discovery; trust `pnpm dev:status` over `lsof`.
- Never modify: `apps/core/.env.local`, `apps/core/next.config.mjs`, `apps/core/src/lib/config.ts`, `apps/core/src/dev/server.ts`.
- If a server fails: `pnpm dev:down && pnpm dev:up`, read `/tmp/dd-core-*.log` (last 20 lines). Do NOT touch the never-modify files — the cause is a stale process or cache. UI cache fix: `rm -rf apps/core/.next`.
- Health checks: API `curl -s localhost:9090/api/v1/health` (expect `X-API-Version: 1.0.0`); UI `curl -o /dev/null -w '%{http_code}' localhost:3010` → 200.
- Reset local DB: `pnpm dev:down`, then `rm -f apps/core/.wrangler/state/local.db` — schema recreates from `apps/core/schema.sql` on next `dev:up`.

## Output
## State
Per service: running/stopped, PID, port, health result.
## Actions Taken / ## Notes
