# Monorepo with two apps and a shared engine

Turborepo + pnpm workspaces. `apps/core` (community edition: Next.js UI + Hono
API on D1) and `apps/admin` (admin panel) are separate deployables;
`packages/engine` holds all shared logic (Zod schemas, Drizzle schema, crypto)
so the two apps cannot drift apart.

**Consequences**: everything the API and UI both understand (drop shapes,
validation, crypto) belongs in `engine`, not in either app. The original
design doc planned a `apps/saas` edition instead of admin — superseded.
