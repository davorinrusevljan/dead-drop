# dead-drop.xyz

Privacy-focused, ephemeral data-sharing service running on Cloudflare.

- **App**: [dead-drop.xyz](https://dead-drop.xyz)
- **Admin**: [admin.dead-drop.xyz](https://admin.dead-drop.xyz)
- **API**: [api.dead-drop.xyz](https://api.dead-drop.xyz) · [OpenAPI docs](https://api.dead-drop.xyz/api/v1/docs)

## What it does

Share text under a name only you and the recipient know. Content is
zero-knowledge encrypted **in the browser** — the server stores ciphertext it
cannot decrypt. Drops expire.

- Free drops: 10 KB, text only, 7-day lifespan, 5 versions
- Public (plaintext) or protected (encrypted) visibility
- Choose your own drop name, or let one be generated

## Quick start

Requires Node 22+, pnpm 9+.

```bash
pnpm install
cp apps/core/.env.example apps/core/.env.local

# API and UI are separate processes:
cd apps/core && pnpm dev:api     # API on :9090
# new terminal, repo root:
pnpm dev                          # UI on :3010
```

Open http://localhost:3010.

## Development

```bash
pnpm build             # build all packages
pnpm test              # unit tests
pnpm test:coverage     # with coverage
pnpm lint / typecheck
```

E2E (needs both dev servers running):

```bash
cd e2e && npx playwright install chromium
npx playwright test --config=playwright.config.ts --project=chromium
```

## Documentation

- [Runbook](docs/runbook.md) — start/stop/test/deploy, local and Cloudflare
- [Domain glossary](CONTEXT.md) — the project's exact terminology
- [ADRs](docs/adr/README.md) — architecture decisions and why
- [API reference](docs/api-reference.md) — v1 endpoints (OpenAPI spec is canonical)
- [Changelog](docs/changelog.md)

## Deploy

See the [runbook](docs/runbook.md#deployment-cloudflare). Short version:
Cloudflare account with D1/Workers, `wrangler login`, then per app
`pnpm deploy:api` + `pnpm deploy:pages` from `apps/core` / `apps/admin`.

## License

MIT
