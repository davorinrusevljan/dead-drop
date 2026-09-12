# Frontend API URL is resolved at build time

`apps/core/src/lib/config.ts` resolves the API URL in a fixed order:
`window.ENV_API_URL` (runtime hook — currently dead code, nothing injects it)
→ `NEXT_PUBLIC_API_URL` (build time) → hard default `https://api.dead-drop.xyz`.

Local dev gets `http://localhost:9090` from `apps/core/.env.local`; the
`deploy:pages` script pins `NEXT_PUBLIC_API_URL=https://api.dead-drop.xyz`
during the production build. The production CSP `connect-src` only permits
`api.dead-drop.xyz`, so a prod build can never call localhost by accident.

**Consequence**: changing where the UI points = changing build env, never a
runtime toggle. `config.ts` is on the never-modify list.
