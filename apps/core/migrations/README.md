# Database Migrations

This directory contains SQL migration scripts for the dead-drop D1 database.

## Migration Files

### `add-hash-algo.sql` (v1.1+)

Adds the `hash_algo` column to the `drops` table for future-proofing hash algorithm support.

**SQL:**
```sql
ALTER TABLE drops ADD COLUMN hash_algo TEXT DEFAULT 'sha-256' NOT NULL;
```

**Rollback:**
```sql
ALTER TABLE drops DROP COLUMN hash_algo;
```

## Applying Migrations

### Local Development

The local D1 database is created dynamically during test runs. To test migrations locally:

1. Start the dev server:
   ```bash
   pnpm dev
   ```

2. The database will be at `.wrangler/state/v3/d1miniflare-D1DatabaseObject/`

3. Apply migration (if database exists):
   ```bash
   wrangler d1 execute dead-drop-core --local --file migrations/add-hash-algo.sql
   ```

### Cloudflare D1 (Production)

1. **Check current database:**
   ```bash
   wrangler d1 list
   wrangler d1 info dead-drop-core
   ```

2. **Apply migration:**
   ```bash
   wrangler d1 execute dead-drop-core --file migrations/add-hash-algo.sql
   ```

3. **Verify migration:**
   ```bash
   wrangler d1 execute dead-drop-core --command "SELECT sql FROM sqlite_master WHERE name='drops'"
   ```

4. **Test existing drops have default value:**
   ```bash
   wrangler d1 execute dead-drop-core --command "SELECT id, hash_algo FROM drops LIMIT 5"
   ```

## Migration Checklist

- [x] SQL migration script created
- [x] Database schema updated (`packages/engine/src/db/schema.ts`)
- [x] TypeScript types updated (`apps/core/src/api/db.ts`)
- [x] API endpoint updated (`apps/core/src/api/index.ts`)
- [x] OpenAPI schema updated (`apps/core/src/api/openapi.ts`)
- [x] Tests written (`apps/core/src/api/routes/hash-algo-migration.test.ts`)
- [x] All tests passing
- [ ] Local migration tested (manual verification)
- [ ] Cloudflare migration executed (manual - run commands above)

## Notes

- The `hash_algo` field has a DEFAULT value of 'sha-256', so existing rows will automatically get this value
- The field is NOT NULL to ensure all drops have a hash algorithm specified
- Future versions (v1.1+) can use this field to support additional hash algorithms
- Current implementation (v1.0) only supports 'sha-256' and ignores the field
