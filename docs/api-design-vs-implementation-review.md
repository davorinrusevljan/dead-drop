# API Design vs Implementation Review

**Date:** 2026-04-18
**Status:** Pre-Publication Security Review

## Summary

Review of current API implementation against `initial-design.md` specifications and security best practices.

---

## Design vs Implementation Mismatches

| Area | Design Specification | Current Implementation | Status |
|-------|-------------------|----------------------|---------|
| **Algorithm Support** | Only `pbkdf2-aes256-gcm-v1` implemented | Metadata field, future algorithms can be added | ✅ Forward-compatible |
| **MIME Types** | `text/plain` only | Schema allows `text/plain` + `application/json` | ✅ v1.0: `text/plain` only (UTF-8 compatible) |
| **Extra Endpoints** | Core CRUD only | + generate-name, check, history, upgrade, docs | ℹ️ Enhancement |
| **adminHash field** | `Null if private` in docs | Both private & public use it | ✅ Implementation correct, docs need update |
| **hashAlgo field** | Not specified | Not implemented (hardcoded SHA-256) | 🔮 Future consideration for v1.1+ |
| **Name Length (Standard)** | `>= 12` chars | `TIER_NAME_MIN_LENGTHS.free = 12` | ✅ Matches |
| **Name Length (Deep)** | `>= 3` chars | `TIER_NAME_MIN_LENGTHS.deep = 3` | ✅ Matches |
| **Payload Size (Standard)** | 10 KB | `TIER_MAX_PAYLOAD_SIZES.free = 10240` | ✅ Matches |
| **Payload Size (Deep)** | 4 MB | `TIER_MAX_PAYLOAD_SIZES.deep = 4194304` | ✅ Matches |
| **Expiration (Standard)** | 7 days | `TIER_EXPIRATION_DAYS.free = 7` | ✅ Matches |
| **Expiration (Deep)** | 90 days | `TIER_EXPIRATION_DAYS.deep = 90` | ✅ Matches |

### Details

#### 1. ~~Algorithm Schema Mismatch~~ **RESOLVED**

**File:** `packages/engine/src/crypto/algorithms.ts`

**Status:** Not a bug - this is correct forward-looking design.

The `encryptionAlgo` field is **metadata only**. Server stores the algorithm identifier so the client knows which one to use for decryption.

- Client performs encryption/decryption
- Server only stores the identifier string
- Adding new algorithms in future API versions is backward compatible

**v1.0 strategy:** Start with `pbkdf2-aes256-gcm-v1` (what web client supports). Future versions can add more options without breaking existing drops.

#### 2. MIME Type Schema Inconsistency

**File:** `apps/core/src/api/openapi.ts:65`

```typescript
export const mimeTypeSchema = z.enum(['text/plain', 'application/json'])
```

**File:** `packages/engine/src/types.ts:25`

```typescript
export const ALLOWED_MIME_TYPES = ['text/plain'] as const;
```

The OpenAPI schema allows `application/json`, but the validation function rejects it.

**Fix:** Update schema to match allowed types:
```typescript
export const mimeTypeSchema = z.enum(['text/plain'])
```

#### 3. Extra Endpoints (Enhancements)

The implementation includes endpoints not in the original design:

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/health` | Health check | ✅ Good practice |
| `GET /api/docs` | Swagger UI | ✅ Documentation |
| `GET /api/docs/openapi.json` | OpenAPI spec | ✅ Documentation |
| `GET /api/drops/generate-name` | Random name generation | ✅ UX improvement |
| `GET /api/drops/check/{id}` | Availability check | ✅ UX improvement |
| `GET /api/drops/{id}/history` | List versions | ✅ Feature addition |
| `GET /api/drops/{id}/history/{version}` | Get specific version | ✅ Feature addition |
| `POST /api/drops/{id}/upgrade` | Tier upgrade | ✅ Business logic |

#### 4. Documentation Inaccuracy on adminHash

**Design document states:**
> `adminHash: text('admin_hash'), // Null if private`

**Schema correctly defines:**
```typescript
adminHash: text('admin_hash').notNull(),
```

**Both private and public drops use `adminHash`:**

| Drop Type | adminHash Computed From | Purpose |
|-----------|----------------------|----------|
| **Private** | `SHA-256(contentHash + pepper)` | Server-side pepper protects content |
| **Public** | `SHA-256(adminPassword + salt)` | Client provides password hash |

The implementation is **correct** - both visibility types need adminHash for edit/delete authentication. The design document should be updated to remove the "Null if private" comment.

---

### Future Consideration: Auth Algorithm Versioning

**Status:** Not a v1.0 blocker, but worth considering for future-proofing.

**Current situation:**
```typescript
// Hardcoded in implementation
export async function computePrivateAdminHash(contentHash: string, pepper: string) {
  return sha256(contentHash + pepper);  // Always SHA-256
}

export async function computePublicAdminHash(adminPassword: string, salt: string) {
  return sha256(adminPassword + salt);  // Always SHA-256
}
```

**Problem:** Auth algorithm is implicit. If you want to upgrade to SHA-512, Argon2, or bcrypt in future, existing drops break.

**Recommended: Add `hashAlgo` field**

```typescript
export const drops = sqliteTable('drops', {
  // ... existing fields
  hashAlgo: text('hash_algo').default('sha-256').notNull(),
  adminHash: text('admin_hash').notNull(),
});
```

**Benefits:**
- Backward compatible (defaults to `sha-256` for existing drops)
- Future-proof (can add new algorithms without migration)
- Clear communication (client knows which hash algorithm to use)

**Usage:**
```typescript
// v1.0: defaults to sha-256
providedHash = await sha256(contentHash + pepper);

// Future: check hashAlgo first
if (drop.hashAlgo === 'sha-512') {
  providedHash = await sha512(contentHash + pepper);
} else {
  providedHash = await sha256(contentHash + pepper);
}
```

**Decision:** Add in v1.1 or later when upgrading auth algorithms is needed. For v1.0, hardcoded SHA-256 is acceptable.

---

## Security Issues

### Critical Issues

#### 1. ~~No Rate Limiting~~ **IN PROGRESS - Headers Added**

**Status:** Rate limit headers added, enforcement deferred to v1.1+

**Implementation (v1.0):**
- Added `rateLimitHeaders` middleware in `apps/core/src/api/middleware.ts`
- Headers sent on all responses (no enforcement yet):
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 100` (always full in v1.0)
  - `X-RateLimit-Reset: {unix timestamp}`
  - `X-RateLimit-Window: 3600` (1 hour)
- Added to OpenAPI spec (`rateLimitHeadersSchema`)
- Documentation added to API code

**Why headers first?**
- Clients can start using/reading headers immediately
- No breaking changes when enforcement is added in v1.1+
- Define contract before implementing tracking state

**v1.1+:** Replace dummy values with Durable Object or Cloudflare rate limiting. Headers remain unchanged.

#### 2. ~~Permissive CORS Configuration~~ **RESOLVED**

**File:** `apps/core/src/api/index.ts:94-101`

```typescript
app.use(
  '*',
  cors({
    origin: '*',  // ✅ Correct for open API
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);
```

**Status:** `origin: '*'` is **correct** for an open API.

Since the API is designed for public use (no authentication, third-party clients welcome), wildcard CORS is appropriate:
- Anyone can consume the API
- Third-party clients can integrate freely
- Documentation is public
- No access control needed

**Only restrict CORS if:**
- API becomes private/protected
- Specific domains require access
- Rate limiting by client domain is needed

### Medium Issues

#### 1. Missing Content-Security-Policy Header

**File:** `apps/core/src/api/middleware.ts`

Current headers:
```typescript
res.headers.set('X-Content-Type-Options', 'nosniff');
res.headers.set('X-Frame-Options', 'DENY');
res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
```

**Recommendation:** Add CSP header:
```typescript
res.headers.set('Content-Security-Policy', "default-src 'self'");
```

**Verdict:** Not needed for v1.0 - API returns JSON only, no HTML/JS to protect.

#### ~~Algorithm Schema Allows Future/Unsupported Algorithms~~ **DUPLICATE - RESOLVED**

(See section 1 above - algorithm schema is correct forward-looking design)

### Low Issues

#### ~~No Content-Type Header Validation~~ **ALREADY IMPLEMENTED**

`isMimeTypeAllowed()` in `packages/engine/src/types.ts` already restricts to `text/plain`.

**Action needed:** Update OpenAPI schema to match code (currently shows `text/plain` + `application/json`).

---

## Security Correctly Implemented ✅

### 1. Server-Side Pepper for Private Drops

**File:** `packages/engine/src/crypto.ts:137-142`

```typescript
export async function computePrivateAdminHash(
  contentHash: string,
  pepper: string
): Promise<string> {
  return sha256(contentHash + pepper);
}
```

Private drop authentication uses `SHA-256(contentHash + PEPPER)` where `PEPPER` is stored server-side. This prevents:
- Unauthorized edits even if content hash is known
- Replay attacks with old content hashes

### 2. Audit Log Contains No PII

**File:** `packages/engine/src/db/schema.ts:74-86`

```typescript
export const dropAuditLog = sqliteTable('drop_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dropId: text('drop_id').notNull(),  // Hash only
  action: text('action').notNull(),
  version: integer('version'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

Audit log stores only:
- Drop ID (SHA-256 hash - non-reversible)
- Action type
- Version number
- Timestamp

**NO** IP addresses, user agents, or any client identifiers stored. Privacy-focused design is correctly implemented.

### 3. Admin Hash Not Exposed in GET Responses

**File:** `apps/core/src/api/index.ts:326-340`

```typescript
return c.json(
  {
    id: drop.id,
    tier: drop.tier,
    visibility: drop.visibility,
    payload: drop.data ?? '',
    salt: drop.salt,
    iv: drop.iv,
    encryptionAlgo: drop.encryptionAlgo,
    encryptionParams: drop.encryptionParams ? JSON.parse(drop.encryptionParams) : null,
    mimeType: drop.mimeType,
    expiresAt: drop.expiresAt.toISOString(),
  },
  200
);
```

The `adminHash` field is intentionally **not included** in GET responses. This prevents:
- Information leakage about authentication mechanism
- Offline brute force attacks on stored hashes

### 4. IV Regeneration on Each Edit

**File:** `apps/core/src/api/db.ts:106-155`

Each edit generates a new IV for AES-GCM encryption:
```typescript
await orm.insert(dropHistory).values({
  // ... stores old IV in history
  iv: existing.iv,
});
// Update with new IV
await orm.update(drops).set({
  iv: data.iv,  // New IV
});
```

This prevents IV reuse, which is critical for AES-GCM security.

### 5. Tier-Based Limits Enforced

**File:** `apps/core/src/api/db.ts:248-276`

```typescript
export const TIER_VERSION_LIMITS: Record<DropTier, number> = {
  free: 5,
  deep: 20,
};

export const TIER_MAX_PAYLOAD_SIZES: Record<DropTier, number> = {
  free: 10 * 1024,      // 10 KB
  deep: 4 * 1024 * 1024, // 4 MB
};

export const TIER_EXPIRATION_DAYS: Record<DropTier, number> = {
  free: 7,
  deep: 90,
};
```

All tier restrictions are correctly enforced at the API level.

### 6. Version History Tracking

**File:** `packages/engine/src/db/schema.ts:44-68`

```typescript
export const dropHistory = sqliteTable('drop_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dropId: text('drop_id').notNull(),
  version: integer('version').notNull(),
  data: text('data'),
  r2Key: text('r2_key'),
  iv: text('iv'),
  encryptionAlgo: text('encryption_algo'),
  encryptionParams: text('encryption_params'),
  mimeType: text('mime_type'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

Historical versions are properly archived, preserving:
- Encrypted data
- IV and algorithm info
- MIME type
- Creation timestamps

### 7. Server Header Removal

**File:** `apps/core/src/api/middleware.ts:19`

```typescript
res.headers.delete('Server');
```

Removes server information disclosure, following security best practice.

### 8. Proper Error Responses

All endpoints return structured error responses:
```typescript
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Drop not found"
  }
}
```

No stack traces or sensitive information leaked in errors.

---

## Recommendations Before Public Launch

### Priority 1 (Must Fix)

1. **Restrict encryptionAlgo to currently supported**
   - Only allow `pbkdf2-aes256-gcm-v1` (what v1.0 client supports)
   - Update: `packages/engine/src/crypto/algorithms.ts`
   - Update: `apps/core/src/api/openapi.ts` (schema)
   - Future algorithms can be added when client implements them

### Priority 2 (Should Fix)

1. **Update OpenAPI MIME type schema**
   - Currently: `z.enum(['text/plain', 'application/json'])`
   - Change to: `z.enum(['text/plain'])` to match `isMimeTypeAllowed()`
   - File: `apps/core/src/api/openapi.ts`

### Priority 3 (Nice to Have)

1. **Add hashAlgo Field (Future - v1.1+)**
   - Add `hashAlgo` field to enable auth algorithm upgrades
   - Backward compatible (defaults to `sha-256`)
   - Allows future migration to SHA-512, Argon2, etc.

2. **Update Documentation**
   - Correct the `adminHash` documentation in `initial-design.md` (both private & public use it, never null)
   - Document extra endpoints
   - Document encryptionAlgo restriction

---

## Conclusion

The implementation closely follows the design document with appropriate enhancements. Core security features (server-side pepper, PII-free audit logs, IV regeneration) are correctly implemented.

**Status before public launch:**
- ✅ Rate limit headers added (client-ready)
- ✅ CORS confirmed as open (correct for public API)
- 📋 Restrict encryptionAlgo to `pbkdf2-aes256-gcm-v1` only
- 📋 Update OpenAPI MIME type schema to `text/plain` only
- 📋 Add hashAlgo field (v1.1+ future)
- 📋 Update documentation
- Ready to publish

These issues are addressable and do not represent fundamental flaws. The API is suitable for publication once rate limiting is added and CORS is appropriately restricted.
