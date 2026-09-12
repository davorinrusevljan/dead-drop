# ADRs

Architecture Decision Records. Format defined by the `domain-modeling` skill
(`.pi/skills/domain-modeling/ADR-FORMAT.md`): minimal — 1-3 sentences of
context, decision, why. Optional sections only when they earn their place.

Offer a new ADR only when a decision is (1) hard to reverse, (2) surprising
without context, and (3) a real trade-off.

| # | Decision |
|---|----------|
| [0001](0001-monorepo-two-apps.md) | Monorepo, two apps, shared engine package |
| [0002](0002-api-path-versioning.md) | API versioned by URL path (`/api/v1/*`), old routes 404 |
| [0003](0003-local-dev-via-node-not-wrangler.md) | Local API dev on Node+SQLite, not `wrangler dev` |
| [0004](0004-build-time-api-url.md) | Frontend API URL baked at build time |
| [0005](0005-admin-separate-d1.md) | Admin panel is a separate app with its own D1 database |
| [0006](0006-zero-knowledge-client-side.md) | Zero-knowledge: encryption is client-side only |
