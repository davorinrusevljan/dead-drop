# API TODOs Implementation Plan

Created on 2026-04-18.

---

## Remaining TODOs

| Priority | Item | Description |
|----------|-------|-------------|
| P1 | Restrict encryptionAlgo | Only allow `pbkdf2-aes256-gcm-v1` in API |
| P2 | Update OpenAPI MIME schema | Change schema to only `text/plain` |
| P3 | Add hashAlgo field | Enable future auth algorithm upgrades |
| P3 | Update documentation | Docs updates |

## Completed TODOs

| Priority | Item | Description | Status |
|----------|-------|-------------|--------|
| P3 | Update documentation | Correct adminHash docs, create API reference, document v1.0 features | ✅ COMPLETED |

---

## Implementation Plan

### Task 1: Restrict encryptionAlgo to currently supported

**Objective:** API should only accept `pbkdf2-aes256-gcm-v1` (what v1.0 client supports).

**Files to modify:**
1. `packages/engine/src/crypto/algorithms.ts` - Restrict type to only supported algorithm
2. `apps/core/src/api/openapi.ts` - Update schema to match
3. `apps/core/src/api/index.ts` - Ensure validation uses restricted type

**Changes:**

```typescript
// packages/engine/src/crypto/algorithms.ts
// BEFORE: declared 3 algorithms
export type EncryptionAlgorithm =
  | 'pbkdf2-aes256-gcm-v1'
  | 'xchacha20-poly1305-v1'      // ❌ Remove
  | 'argon2id-xchacha0-v1';       // ❌ Remove

// AFTER: v1.0 only
export type EncryptionAlgorithm = 'pbkdf2-aes256-gcm-v1';

// Update schema to match
export const encryptionAlgorithmSchema = z.literal('pbkdf2-aes256-gcm-v1');

// Update isAlgorithmSupported
export function isAlgorithmSupported(algorithm: string): algorithm is EncryptionAlgorithm {
  return algorithm === 'pbkdf2-aes256-gcm-v1';
}
```

```typescript
// apps/core/src/api/openapi.ts
export const encryptionAlgoSchema = z.literal('pbkdf2-aes256-gcm-v1').openapi({
  example: 'pbkdf2-aes256-gcm-v1',
  description: 'Encryption algorithm used for private drops. v1.0: pbkdf2-aes256-gcm-v1 only.',
});
```

**Database migration:** Not needed (no schema changes).

**Tests required:**
- Unit: `isAlgorithmSupported()` returns true for `pbkdf2-aes256-gcm-v1`, false for others
- Unit: Schema validation rejects unsupported algorithms
- E2E: API rejects requests with unsupported encryptionAlgo
- Manual: Test with invalid encryptionAlgo in request body

**Cloudflare testing:** Deploy to staging, test with invalid algorithm.

---

### Task 2: Update OpenAPI MIME type schema

**Objective:** Align OpenAPI schema with `isMimeTypeAllowed()` (which only allows `text/plain`).

**Files to modify:**
1. `apps/core/src/api/openapi.ts` - Update `mimeTypeSchema`

**Changes:**

```typescript
// apps/core/src/api/openapi.ts
// BEFORE
export const mimeTypeSchema = z.enum(['text/plain', 'application/json']).openapi({...});

// AFTER
export const mimeTypeSchema = z.literal('text/plain').openapi({
  example: 'text/plain',
  description: 'MIME type of drop content. v1.0: text/plain only.',
});
```

**Database migration:** Not needed (no schema changes).

**Tests required:**
- Unit: Schema validation accepts `text/plain`
- Unit: Schema validation rejects `application/json`
- E2E: API rejects requests with `application/json` mimeType
- Manual: Test with invalid mimeType in request body

**Cloudflare testing:** Deploy to staging, test with `application/json`.

---

### Task 3: Add hashAlgo field (Future - v1.1+)

**Objective:** Add `hashAlgo` field to enable auth algorithm upgrades.

**Files to modify:**
1. `packages/engine/src/db/schema.ts` - Add `hashAlgo` column
2. `apps/core/src/api/db.ts` - Update types and functions
3. `apps/core/src/api/index.ts` - Use hashAlgo in validation
4. `packages/engine/src/crypto.ts` - Add multi-algorithm support (future)
5. Migration script - Local D1 and Cloudflare D1

**Changes:**

```typescript
// packages/engine/src/db/schema.ts
export const drops = sqliteTable('drops', {
  // ... existing fields
  hashAlgo: text('hash_algo').default('sha-256').notNull(),
  // ... rest of fields
});
```

```typescript
// apps/core/src/api/db.ts
export interface DropRecord {
  // ... existing fields
  hashAlgo: 'sha-256' | 'sha-512' | 'argon2id' | string;
  // ... rest of fields
}

// Update auth functions to check hashAlgo
async function computeAuthHash(drop: DropRecord, input: AuthInput): Promise<string> {
  if (drop.hashAlgo === 'sha-512') {
    return await sha512(input.contentHash + pepper);
  } else if (drop.hashAlgo === 'argon2id') {
    return await argon2id(input.contentHash + pepper);
  }
  return await sha256(input.contentHash + pepper); // default
}
```

**Database migration:** REQUIRED - Add `hashAlgo` column to both local and CF D1.

Migration SQL:
```sql
ALTER TABLE drops ADD COLUMN hash_algo TEXT DEFAULT 'sha-256' NOT NULL;
```

**Tests required:**
- Unit: Migration script works locally
- Unit: Migration script works on CF D1 (via wrangler)
- Unit: API respects hashAlgo when provided
- Unit: API defaults to `sha-256` when hashAlgo not provided
- E2E: Create drop with new hashAlgo, authenticate with correct algorithm
- Manual: Run migration on local DB, verify data
- Manual: Run migration on CF D1, verify data

**Cloudflare testing:** Deploy migration to staging, verify no data loss.

---

### Task 4: Update documentation ✅ COMPLETED

**Files modified:**
1. `initial-design.md` - Corrected adminHash comment
2. `docs/api-reference.md` - Created comprehensive API reference
3. `API_CHANGES.md` - Added v1.0 features section
4. `README.md` - Updated documentation references

**Changes made:**

```markdown
<!-- initial-design.md -->
<!-- BEFORE -->
adminHash: text('admin_hash'), // Null if private

<!-- AFTER -->
adminHash: text('admin_hash'), // Both private & public drops use this for authentication
```

**New documentation created:**
- `docs/api-reference.md`: Complete API reference with all endpoints, algorithms, and client-side implementation guide
- `API_CHANGES.md`: Added v1.0 features section documenting rate limit headers, algorithm restrictions, and additional endpoints

**Tests required:** N/A (documentation only)

**Cloudflare testing:** N/A

**Status:** ✅ COMPLETED

---

## Execution Order

1. Task 1: Restrict encryptionAlgo (P1) - No migration, simpler
2. Task 2: Update OpenAPI MIME schema (P2) - No migration, simpler
3. Task 3: Add hashAlgo field (P3) - Requires migration, more complex
4. Task 4: Update documentation (P3) - Documentation only

---

## Testing Requirements (for all tasks)

### Unit Tests
- Test schema validation
- Test edge cases (null, empty string, invalid values)
- Test error responses
- Maintain 100% coverage

### E2E Tests
- Test API endpoints with invalid inputs
- Test error responses are correct
- Test valid inputs work end-to-end

### Manual Testing
1. **Local:**
   - Start dev server: `cd apps/core && pnpm dev:api`
   - Test with curl/Postman/HTTPie
   - Verify responses are correct

2. **Cloudflare (staging):**
   - Deploy: `cd apps/core && pnpm deploy:api --env staging`
   - Test via staging URL
   - Verify all endpoints work

### Database Migration (if needed)
1. **Local:**
   - Run migration: `pnpm db:migrate` (if script exists)
   - Verify schema: `wrangler d1 execute local-db --file schema.sql`
   - Test queries work with new schema

2. **Cloudflare:**
   - Backup existing data (if production)
   - Run migration: `wrangler d1 execute dead-drop-core --file migration.sql`
   - Verify: Query CF D1 to confirm schema
   - Test: Create/update drops with new fields

---

## Rollback Plan

If any task causes issues:

1. **Local:** `git revert` to restore working state
2. **CF D1:** 
   - Have rollback SQL ready before migration
   - Test rollback: `wrangler d1 execute dead-drop-core --file rollback.sql`
   - Keep backups for at least 24 hours

---

## Success Criteria

Each task is complete when:
- ✅ Code changes committed and pushed
- ✅ Unit tests pass (100% coverage maintained)
- ✅ E2E tests pass
- ✅ Manual local testing passes
- ✅ Cloudflare testing passes
- ✅ Database migrations tested (if applicable)
- ✅ Documentation updated (if applicable)
- ✅ TODO item marked complete
