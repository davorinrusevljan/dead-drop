# Local API development runs on Node + SQLite, not `wrangler dev`

The local dev API (`apps/core/src/dev/server.ts`, same for admin) runs the
**production** Hono app (`createApiApp()`) under `@hono/node-server` with a
D1-compatible SQLite adapter from `@dead-drop/engine/dev/d1-adapter`. `wrangler`
is used only for deployment.

**Why**: faster startup, reliable in dev containers (8787 often blocked; we
use 9090), and route parity is enforced by sharing the exact app factory
rather than reimplementing routes. **Consequences**: never edit dev-server
files to "fix" behavior differences — divergence is a bug in the shared app;
also, `.dev.vars` supplies local secrets (`ADMIN_HASH_PEPPER`,
`UPGRADE_TOKEN`).
