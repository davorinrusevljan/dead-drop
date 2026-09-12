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
| Start core API | `cd apps/core && pnpm dev:api` (port 9090) |
| Start core UI | `pnpm dev` from repo root (port 3010) — does NOT start API |
| Start admin | `cd apps/admin`, same pattern (9091 / 3011) |
| Health | `curl -s http://localhost:9090/api/v1/health` (header `X-API-Version: 1.0.0`) |
| Stop | `kill $(lsof -ti :9090) $(lsof -ti :3010)` |
| Reset local DB | stop API → `rm -f apps/core/.wrangler/state/local.db` → restart |
| Unit tests | `pnpm test` (repo root) |
| E2E | servers up → `cd e2e && npx playwright test --project=chromium` |

## Frontend ↔ API wiring (never "fix" via config)

Local UI reads `apps/core/.env.local` → `http://localhost:9090`. Production
build pins `https://api.dead-drop.xyz`; prod CSP blocks localhost entirely.
See ADR-0004.

## When something won't start

1. Check port: `lsof -ti :<port>`
2. Health-check API before blaming UI
3. Stale UI: kill next/turbo processes, `rm -rf apps/core/.next`, restart
4. Read `/tmp/dd-*.log` if servers were backgrounded

Prefer delegating to the `dev-server` / `tester` sub-agents when parallel work helps.
