# Cloudflare D1 Migration Plan

Created on 2026-04-19.

---

## Objective

Migrate Cloudflare D1 production database to add `hash_algo` column for v1.0 API enhancements.

**Current state:**
- Local database: ✅ Migrated (has `hash_algo` column)
- Cloudflare D1: ❌ Not migrated (missing `hash_algo` column)
- Migration SQL ready: `apps/core/migrations/add-hash-algo.sql`
- Code updated: All packages use `hash_algo` field

**Risk:** If production API tries to create/update drops before migration, it will **CRASH** because Drizzle tries to INSERT into non-existent column.

---

## Migration SQL

```sql
-- File: apps/core/migrations/add-hash-algo.sql
ALTER TABLE drops ADD COLUMN hash_algo TEXT DEFAULT 'sha-256' NOT NULL;
```

**Details:**
- Adds `hash_algo` column to `drops` table
- Default value: `'sha-256'` - ensures all rows have a value
- NOT NULL constraint - ensures all rows have a hash algorithm specified
- Backward compatible - existing rows automatically get default value

---

## Migration Plan

### Step 1: Pre-Migration Backup (CRITICAL)

**Why:** Must protect production data before making schema changes.

**Actions:**
1. Export current production D1 database
   ```bash
   wrangler d1 export dead-drop-core --file backup-before-hash-algo.sql
   ```

2. Verify backup file created

3. Store backup file securely in case rollback needed

**Backup file:** `backup-before-hash-algo.sql`

### Step 2: Maintenance Mode (RECOMMENDED)

**Why:** Prevent writes during migration to avoid race conditions or partial states.

**Actions:**
1. Set Cloudflare Worker to maintenance mode (if supported)
   ```bash
   wrangler secret put MAINTENANCE_MODE true --name dead-drop-core
   ```

   OR: Add maintenance check to API
   ```bash
   wrangler secret put MAINTENANCE_MODE true --name dead-drop-core
   ```

2. Optionally: Update UI to show maintenance banner

3. Monitor API traffic during migration (should drop to near zero)

### Step 3: Execute Migration

**Actions:**
1. Apply migration to production D1
   ```bash
   wrangler d1 execute dead-drop-core --file apps/core/migrations/add-hash-algo.sql
   ```

2. Verify migration succeeded
   ```bash
   wrangler d1 execute dead-drop-core --command "SELECT sql FROM sqlite_master WHERE name='drops'"
   ```

3. Verify `hash_algo` column exists and has DEFAULT value
   ```bash
   wrangler d1 execute dead-drop-core --command "PRAGMA table_info(drops)"
   ```

4. Test that API still works (health check)
   ```bash
   curl https://api.dead-drop.xyz/api/health
   ```

### Step 4: Post-Migration Verification (CRITICAL)

**Actions:**
1. Test CREATE drop with default hash_algo (should use `sha-256`)
   ```bash
   curl -X POST https://api.dead-drop.xyz/api/drops \
     -H "Content-Type: application/json" \
     -d '{
         "id": "test-id-hash",
         "nameLength": 12,
         "visibility": "private",
         "payload": "test-payload",
         "salt": "test-salt-1234567890123456789",
         "iv": "test-iv-123456789012",
         "encryptionAlgo": "pbkdf2-aes256-gcm-v1",
         "mimeType": "text/plain"
       }'
   ```

2. Test CREATE drop with explicit hash_algo
   ```bash
   curl -X POST https://api.dead-drop.xyz/api/drops \
     -H "Content-Type: application/json" \
     -d '{
         "id": "test-id-explicit-hash",
         "nameLength": 12,
         "visibility": "private",
         "payload": "test-payload",
         "salt": "test-salt-1234567890123456789",
         "iv": "test-iv-123456789012",
         "encryptionAlgo": "pbkdf2-aes256-gcm-v1",
         "mimeType": "text/plain",
         "hashAlgo": "sha-256"
       }'
   ```

3. Verify existing drops have default value
   ```bash
   wrangler d1 execute dead-drop-core --command "SELECT id, hash_algo FROM drops LIMIT 5"
   ```

4. Test READ drop endpoint returns hash_algo

5. Disable maintenance mode (if enabled)

### Step 5: Rollback Plan (if needed)

**Rollback SQL:**
```sql
-- File: apps/core/migrations/rollback-add-hash-algo.sql
-- WARNING: This removes the hash_algo column. Use only if migration failed completely.
ALTER TABLE drops DROP COLUMN hash_algo;
```

**When to use rollback:**
- If migration fails partially (some rows migrated, some not)
- If migration causes unexpected errors
- If API crashes after migration

**Rollback procedure:**
1. Stop maintenance mode
2. Apply rollback SQL
3. Verify API returns to normal operation
4. Investigate root cause of failure

### Step 6: Post-Migration Testing

**Actions:**
1. Run full API test suite
2. Test all CRUD operations (CREATE, READ, UPDATE, DELETE)
3. Test with both valid and invalid hash_algo values
4. Monitor error logs for any issues

---

## Execution Checklist

- [ ] Step 1: Create production backup
- [ ] Step 2: Enable maintenance mode (optional)
- [ ] Step 3: Execute migration
- [ ] Step 4: Verify migration success
- [ ] Step 4b: Disable maintenance mode
- [ ] Step 5: Post-migration verification (test all operations)
- [ ] Step 6: Post-migration testing (full test suite)

---

## Critical Success Criteria

Migration is **SUCCESSFUL** when:
- ✅ `wrangler d1 export` completed (backup file created)
- ✅ `wrangler d1 execute --file` completed (no errors)
- ✅ `PRAGMA table_info(drops)` shows `hash_algo` column with DEFAULT
- ✅ Health check returns 200 OK
- ✅ Test drop created with default hash_algo works
- ✅ Test drop created with explicit hash_algo works
- ✅ Existing drops return default `sha-256` value
- ✅ Full API test suite passes
- ✅ No API errors or crashes observed

**Rollback needed if:**
- ❌ Migration command fails (SQL syntax error)
- ❌ `wrangler d1 execute` times out
- ❌ API crashes immediately after migration
- ❌ Test drops created show errors

---

## Commands Reference

### Backup
```bash
# Export D1 to SQL file
wrangler d1 export dead-drop-core --file backup-before-hash-algo.sql

# Verify backup exists
wrangler d1 execute dead-drop-core --command "SELECT name FROM sqlite_master WHERE type='table' AND name='drops'"
```

### Migration
```bash
# Execute migration SQL
wrangler d1 execute dead-drop-core --file apps/core/migrations/add-hash-algo.sql

# Verify column exists
wrangler d1 execute dead-drop-core --command "PRAGMA table_info(drops)"

# Check table schema
wrangler d1 execute dead-drop-core --command "SELECT sql FROM sqlite_master WHERE name='drops'"
```

### Testing
```bash
# Health check
curl https://api.dead-drop.xyz/api/health

# Create test drop with defaults
curl -X POST https://api.dead-drop.xyz/api/drops \
  -H "Content-Type: application/json" \
  -d '{"id":"test","visibility":"private","payload":"test","salt":"test1234567890123456789","iv":"test123456789012","encryptionAlgo":"pbkdf2-aes256-gcm-v1","mimeType":"text/plain"}'

# Create test drop with explicit hash_algo
curl -X POST https://api.dead-drop.xyz/api/drops \
  -H "Content-Type: application/json" \
  -d '{"id":"test","visibility":"private","payload":"test","salt":"test1234567890123456789","iv":"test123456789012","encryptionAlgo":"pbkdf2-aes256-gcm-v1","mimeType":"text/plain","hashAlgo":"sha-256"}'
```

### Rollback (if needed)
```bash
# Remove column (use only if needed!)
wrangler d1 execute dead-drop-core --file apps/core/migrations/rollback-add-hash-algo.sql

# Verify column removed
wrangler d1 execute dead-drop-core --command "PRAGMA table_info(drops)"
```

---

## Notes

1. **Downtime:** Migration takes ~5-10 seconds. Set appropriate maintenance expectations.

2. **Backups:** Keep backup file for at least 7 days before deleting.

3. **Testing data:** Test drops are temporary. Clean up after migration is verified successful:
   ```bash
   wrangler d1 execute dead-drop-core --command "DELETE FROM drops WHERE id LIKE 'test%'"
   ```

4. **Monitoring:** Watch Cloudflare Analytics for unusual error rates or request patterns after migration.

5. **Safety:** Migration uses `DEFAULT 'sha-256' NOT NULL`, so existing rows automatically get a value. No data loss risk.

---

## Subagent Instructions

Execute this migration plan using subagent:
- Execute Step 1: Backup
- Execute Step 2: Maintenance mode (optional)
- Execute Step 3: Migration
- Execute Step 4: Verification
- Execute Step 4b: Disable maintenance
- Execute Step 5: Post-migration verification
- Execute Step 6: Post-migration testing

Report back with detailed results for each step, including any issues encountered and whether rollback is needed.
