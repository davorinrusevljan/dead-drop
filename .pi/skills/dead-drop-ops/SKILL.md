---
name: dead-drop-ops
description: Operating the dead-drop dev environment and Cloudflare deploys. Use for starting/stopping/resetting local servers (9090/3010/9091/3011), running tests, health checks, diagnosing "Server unreachable", and any deploy question. Enforces never-deploy-without-explicit-request.
---

Operate dead-drop per `docs/runbook.md` (canonical). Key facts:

## Hard rules

- **NEVER run deploy commands** (`deploy:api`, `deploy:pages`, any `wrangler deploy/d1 ... apply --remote`) unless the user explicitly requested deployment in this conversation. Asking "should I deploy?" is fine.
- **Never modify**: `apps/core/.env.local`, `apps/core/next.config.mjs`, `apps/core/src/lib/config.ts`, `apps/core/src/dev/server.ts`. Connectivity problems are always stale processes/caches, not config.
- Never `git push --force`.

## Quick reference

| Task | Command |
|------|---------|
| Start core stack | `pnpm dev:up` (API 9090 + UI 3010, health-checked, reuses healthy, kills zombies) |
| Start + admin | `pnpm dev:up:admin` (adds 9091/3011) |
| Status | `pnpm dev:status` (authoritative — `lsof` is blind to next-server here) |
| Stop everything | `pnpm dev:down` |
| Health | `curl -s http://localhost:9090/api/v1/health` (header `X-API-Version: 1.0.0`) |
| Reset local DB | `pnpm dev:down` → `rm -f apps/core/.wrangler/state/local.db` → `pnpm dev:up` |
| Unit tests | `pnpm test` (repo root) |
| Start for manual testing | `pnpm dev:up` (leave running; UI http://localhost:3010) — prefer delegating to `dev-server` agent |
| E2E | `cd e2e && npx playwright test --project=chromium` (boots its own servers if down; never kills a running stack)

## Frontend ↔ API wiring (never "fix" via config)

Local UI reads `apps/core/.env.local` → `http://localhost:9090`. Production
build pins `https://api.dead-drop.xyz`; prod CSP blocks localhost entirely.
See ADR-0004.

## When something won't start

1. `pnpm dev:status` — see what's actually on which port
2. `pnpm dev:down && pnpm dev:up` — zombie sweep + fresh start
3. Still failing: read `/tmp/dd-core-*.log`, try `rm -rf apps/core/.next` (stale UI cache)

Prefer delegating to the `dev-server` / `tester` sub-agents when parallel work helps.
