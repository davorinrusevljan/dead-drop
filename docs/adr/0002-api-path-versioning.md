# API versioned by URL path

All routes live under `/api/v1/*`. Old unversioned `/api/*` routes return 404 —
no aliases, no redirects. Every response carries `X-API-Version: 1.0.0`.

Chosen when the API was still internal (pre-launch, 2026-04): breaking clients
immediately was cheaper than maintaining compat shims. The OpenAPI spec
(`/api/v1/docs/openapi.json`) is canonical for endpoint behavior; the
hand-written `docs/api-reference.md` is a convenience copy that must be
updated in step.
