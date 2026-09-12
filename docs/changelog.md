# Changelog

Notable releases. Commit history carries the detail; entries here stay short.

## v1.0.0 — Public Launch (2026-04-18)

- API moved to `/api/v1/*` with `X-API-Version: 1.0.0`; old `/api/*` routes 404
  ([ADR-0002](adr/0002-api-path-versioning.md)).
- Full private/public drop support: public drops are plaintext with
  password-gated edits; protected drops are zero-knowledge encrypted
  client-side.
- `encryptionAlgo` restricted to `pbkdf2-aes256-gcm-v1`; `hash_algo` column
  added (SHA-256 drop IDs) with backward-compatible read path.
- Rate-limit headers on API responses; OpenAPI spec + Swagger UI at
  `/api/v1/docs`.
- Breaking change for pre-launch clients: create/update/delete request and
  response shapes finalized; see git history of that date for field-level
  detail (old `API_CHANGES.md` folded into this entry).
