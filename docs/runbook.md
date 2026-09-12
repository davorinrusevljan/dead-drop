# Runbook

Every command here has been executed and verified locally (except deploy
steps, which touch production). If reality and this file disagree, fix the
file — or file a bug if reality is wrong.

## Ports

| Service | Port | URL |
|---|---|---|
| Core API | 9090 | http://localhost:9090 |
| Core UI | 3010 | http://localhost:3010 |
| Admin API | 9091 | http://localhost:9091 |
| Admin UI | 3011 | http://localhost:3011 |

## Local development

### Prerequisites (once)

```bash
pnpm install                          # repo root
cp apps/core/.env.example apps/core/.env.local   # UI → localhost:9090
cp apps/core/wrangler.api.toml.example apps/core/wrangler.api.toml   # deploy only
cp apps/core/wrangler.toml.example apps/core/wrangler.toml           # deploy only
```

`.dev.vars` (core and admin) supplies local API secrets; the dev server
warns and uses dev defaults if missing:

```
ADMIN_HASH_PEPPER=dev-pepper
UPGRADE_TOKEN=dev-upgrade-token
```

### Start (canonical: lifecycle scripts)

```bash
pnpm dev:up               # core stack: API 9090 + UI 3010, health-checked,
                          # reuses healthy servers, kills zombies, never touches config
pnpm dev:up:admin         # + admin stack (9091/3011)
pnpm dev:status           # port/pid/health of all four services
pnpm dev:down             # stop everything (sweeps zombie process trees too)
```

**Manual testing flow**: `pnpm dev:up`, open http://localhost:3010, test;
`pnpm dev:down` when done. Servers persist across terminal/agent sessions
(`nohup`) — that's the design. Ask the agent to start them for you; it must
leave them running and hand you the URLs.

The scripts live in `scripts/dev.sh`. Pid discovery uses `ss` — `lsof` is blind
to `next-server` processes in this environment (hard-won lesson; see git history).

### Start (manual alternative, two terminals)

```bash
# Terminal 1 — core API (Node + SQLite, NOT wrangler)
cd apps/core && pnpm dev:api

# Terminal 2 — core UI
cd apps/core && pnpm dev        # next dev --port 3010
```

**Root `pnpm dev` is turbo and starts ALL apps' UIs at once** — prefer the
scripts or per-app invocation. **Nothing here starts the API for you** except
`dev:up` and Playwright's webServer. UI without API = "Server unreachable".

### Verify

```bash
curl -s http://localhost:9090/api/v1/health        # {"status":"ok",...}
curl -sI http://localhost:9090/api/v1/health | grep -i x-api-version   # 1.0.0
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3010         # 200
```

### Stop

```bash
pnpm dev:down       # all four ports; kills listeners AND their process trees
```

Manual: `kill $(ss -ltnp 'sport = :9090' | grep -oE 'pid=[0-9]+' | cut -d= -f2)`
(remember: `lsof` may not see next-server pids here).

### Reset local database

Local SQLite lives at `apps/core/.wrangler/state/local.db` (schema recreated
from `apps/core/schema.sql` on next API start):

```bash
pnpm dev:down
rm -f apps/core/.wrangler/state/local.db
pnpm dev:up        # fresh DB
```

### Frontend ↔ API wiring (the classic confusion)

`apps/core/src/lib/config.ts` resolves, in order:

1. `window.ENV_API_URL` — runtime hook, **currently dead code** (nothing injects it)
2. `NEXT_PUBLIC_API_URL` — build time: `.env.local` says `http://localhost:9090`;
   the `deploy:pages` script pins `https://api.dead-drop.xyz`
3. Hard fallback: `https://api.dead-drop.xyz`

| Environment | Where UI sends API calls |
|---|---|
| Local UI dev (via `dev:up` or per-app `pnpm dev`) | `http://localhost:9090` (from `.env.local`) |
| Production build | `https://api.dead-drop.xyz` (pinned at build) |

Production CSP `connect-src` allows only `api.dead-drop.xyz` — a prod build
cannot call localhost even by mistake. Never modify `config.ts`,
`.env.local`, or `next.config.mjs` to "fix" connectivity: the cause is always
a stale cache or a dead process (see Troubleshooting).

## Tests

```bash
pnpm test               # unit, all packages (vitest via turbo)
pnpm test:coverage      # + coverage
pnpm typecheck && pnpm lint
```

### E2E (Playwright; self-managing)

```bash
cd e2e
npx playwright install chromium        # first time only
npx playwright test --project=chromium
```

The config's `webServer` array boots the API (readiness = `/api/v1/health`)
and UI itself, reuses healthy servers, and **stops what it started** — no
zombies, no manual two-terminal setup.

`v1-production.spec.ts` hits **production** (`api.dead-drop.xyz`,
`dead-drop.xyz`) and runs without local servers. Two UI-selector tests in
`v1-api-frontend.spec.ts` are flaky under slow hydration — known issue.

Admin e2e lives in `apps/admin/e2e/` (needs admin servers on 9091/3011).

## Deployment (Cloudflare)

> **Never deploy unless the user explicitly asks.** Deploy commands touch
> production immediately; there is no staging.

Prerequisites once: `npx wrangler login`, real `wrangler.toml` +
`wrangler.api.toml` (from `.example` + your D1 `database_id`), secrets:

```bash
cd apps/core
wrangler secret put ADMIN_HASH_PEPPER --name dead-drop-core
wrangler secret put UPGRADE_TOKEN --name dead-drop-core
```

### Core

```bash
cd apps/core
pnpm deploy:api      # API worker → https://api.dead-drop-core.<account>.workers.dev / api.dead-drop.xyz (wrangler.api.toml)
pnpm deploy:pages    # UI → https://dead-drop.xyz (pins NEXT_PUBLIC_API_URL to prod at build)
```

### Admin

```bash
cd apps/admin
pnpm bootstrap-admin          # first time: create admin user
pnpm deploy:api               # admin API worker (wrangler.api.toml, own D1 + core D1 binding)
pnpm deploy:pages             # → https://admin.dead-drop.xyz
```

### D1 migrations (when schema changes)

Local dev recreates from `schema.sql`; production needs explicit migrations:

```bash
cd apps/core
wrangler d1 migrations apply dead-drop-core --remote    # add --local for the local wrangler DB
```

Migration files live in `apps/core/migrations/` (see its README).

### Post-deploy verification

```bash
curl -s https://api.dead-drop.xyz/api/v1/health
curl -sI https://api.dead-drop.xyz/api/v1/health | grep -i x-api-version
curl -s -o /dev/null -w "%{http_code}\n" https://dead-drop.xyz
curl -s "https://api.dead-drop.xyz/api/v1/drops/generate-name"   # {"name":...,"id":...}
```

### API docs (Redoc, pre-rendered)

```bash
pnpm build:api-docs    # scripts/build-api-docs.mjs → api-docs-dist/ (gitignored)
```

## Troubleshooting

- **Port occupied / server won't start / anything weird**: `pnpm dev:down &&
  pnpm dev:up`. Never change ports or config to fix startup (ADR/fixed ports).
- **"Port busy but no pid in lsof"**: known — `lsof` misses `next-server`
  processes; `pnpm dev:status` uses `ss` and is authoritative.
- **UI won't start / shows stale content**: kill everything, wipe cache:
  `kill -9 $(ps aux | grep -E 'turbo|next' | grep -v grep | awk '{print $2}'); rm -rf apps/core/.next`
- **Port already in use**: `lsof -ti :<port>` → decide kill vs different port.
- **Do NOT touch** `apps/core/.env.local`, `next.config.mjs`, `src/lib/config.ts`,
  `src/dev/server.ts`. The problem is always a stale process or cache.
- **Crashed processes leaving `core.*` files**: core dumps from OOM/crashes —
  `find . -name 'core.*' -not -path './node_modules/*' -delete` (they're gitignored).
