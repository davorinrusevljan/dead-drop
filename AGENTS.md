# AGENTS.md — agent instructions for dead-drop

Privacy-focused, ephemeral data-sharing service on Cloudflare Workers.
**Read first:** [CONTEXT.md](CONTEXT.md) (domain language — use these exact
terms), [docs/runbook.md](docs/runbook.md) (start/stop/test/deploy),
[docs/adr/](docs/adr/README.md) (decisions — don't silently violate them).

## Stack

Node 22, pnpm 9, Turborepo · Next.js 15 (App Router) · Hono edge API ·
Cloudflare D1 + Workers/Pages · Drizzle, Zod, Vitest, Playwright.

## Layout

- `apps/core` — community edition: UI (:3010) + API (:9090). API is versioned `/api/v1/*`, header `X-API-Version: 1.0.0`, old `/api/*` = 404.
- `apps/admin` — admin panel: UI (:3011) + API (:9091), own D1 + core D1 read binding.
- `packages/engine` — shared schemas/validation/crypto/db. Anything both apps use belongs here.
- `packages/ui` — shared React components.
- `e2e/` — Playwright vs localhost; `v1-production.spec.ts` hits production.

## Hard rules

1. **Never `git commit` or `git push` unless the user explicitly says so in
   the current turn.** Showing a proposed commit/diff and asking is always OK.
2. **Never `git push --force`** (user requirement).
3. **Never deploy** (`pnpm deploy:api`/`deploy:pages`, wrangler) unless the
   user explicitly requests it this session.
4. **After every `git push`**: run `gh run list --limit 1`, wait for CI, report
   result; fix failures before proceeding.
5. **Never modify** without explicit instruction:
   `apps/core/.env.local`, `apps/core/next.config.mjs`,
   `apps/core/src/lib/config.ts`, `apps/core/src/dev/server.ts`.
6. Check ports are free before starting servers (see runbook).

## Everyday commands

Full detail in [docs/runbook.md](docs/runbook.md).

```bash
# Dev servers — THE way (health-checked, reuse-if-healthy, zombie-sweeping):
pnpm dev:up               # core stack (add ` admin` via `pnpm dev:up:admin` for both)
pnpm dev:status           # port/pid/health of all four services
pnpm dev:down             # stop everything, including zombies

pnpm test | test:coverage | typecheck | lint
cd e2e && npx playwright test --project=chromium   # starts its own servers if down
```

**Never** start dev servers by ad-hoc commands, never change ports or port-bearing
config to fix startup problems (see rule 5). Root `pnpm dev` = turbo = starts ALL
apps' UIs at once — avoid; use `dev:up`.

API health: `curl http://localhost:9090/api/v1/health`.

## PI harness setup (this repo)

- **Skills** live in `.pi/skills/` (project-wide). Notable:
  `grilling`/`grill-me`/`grill-with-docs` (plan stress-testing; the last also
  writes CONTEXT.md/ADRs — use for design sessions),
  `domain-modeling` (defines the ADR + CONTEXT.md formats this repo uses),
  `code-review` (two-axis, spawns sub-agents), `security-review`,
  `security-threat-model`, `frontend-design`, `caveman`.
- **Subagents**: `.pi/extensions/subagent/` + agents in `.pi/agents/`
  (`scout`, `dev-server`, `tester`, `reviewer`). Call the `subagent` tool with
  `agentScope: "project"`. Delegate server management and test runs instead of
  doing them inline when convenient.
- **Strategy/marketing docs live in the separate private repo**
  `dead-drop-strategy` — not here.

## Terminology traps

- "Drop name" ≥ 12 chars (after hyphenation) for the free tier, ≥ 3 for deep —
  see CONTEXT.md; don't trust older docs' numbers.
- `Deep Drop` tier: constants exist, feature unimplemented.
- Frontend API URL is build-time (ADR-0004) — never a runtime fix.
