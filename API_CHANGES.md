# API Changes

## v1.0.0 - Public Launch (2026-04-18)

### Overview
Initial public release with full support for private and public drops, tier system, and enhanced API features.

---

## Changes to `apps/core/src/api/index.ts`

### 1. POST /api/drops (Create Drop)

**Location:** Lines 491-509

**Change:** Added validation to ensure `adminHash` is provided and non-empty for public drops.

```typescript
let adminHash: string;
if (body.visibility === 'private') {
  adminHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
} else {
  // Public drops require adminHash to be provided and non-empty
  if (!body.adminHash || body.adminHash === '') {
    console.debug(`[CREATE_DROP] Rejected: MISSING_ADMIN_HASH - public drop requires adminHash`);
    return c.json(
      {
        error: {
          code: 'MISSING_ADMIN_HASH',
          message: 'Public drops require an admin hash. Please provide a password.',
        },
      },
      400
    );
  }
  adminHash = body.adminHash;
}
```

**New Error Response:**
- **Code:** `MISSING_ADMIN_HASH`
- **Status:** `400 Bad Request`
- **Trigger:** Public drop creation without `adminHash` or with empty `adminHash`

---

### 2. PUT /api/drops/{id} (Update Drop)

**Location:** Lines 641-665

**Change:** Added validation to ensure `adminPassword` is provided and non-empty for public drops before attempting edit.

```typescript
// Validate public drop requires adminPassword
if (drop.visibility === 'public' && (!body.adminPassword || body.adminPassword === '')) {
  return c.json(
    {
      error: {
        code: 'MISSING_ADMIN_PASSWORD',
        message: 'Public drops require an admin password to edit.',
      },
    },
    400
  );
}

let providedHash: string;
let newAdminHash: string;
if (drop.visibility === 'private') {
  providedHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
  newAdminHash = await computePrivateAdminHash(
    body.newContentHash ?? body.contentHash ?? '',
    pepper
  );
} else {
  // adminPassword is validated to be non-empty above for public drops
  const adminPassword: string | undefined = body.adminPassword;
  providedHash = await sha256(adminPassword + drop.salt);
  newAdminHash = providedHash;
}
```

**New Error Response:**
- **Code:** `MISSING_ADMIN_PASSWORD`
- **Status:** `400 Bad Request`
- **Trigger:** Public drop edit without `adminPassword` or with empty `adminPassword`

---

### 3. DELETE /api/drops/{id} (Delete Drop)

**Location:** Lines 735-760

**Change:** Added validation to ensure `adminPassword` is provided and non-empty for public drops before attempting delete. Also added `400` response to OpenAPI schema.

```typescript
// Validate public drop requires adminPassword
if (drop.visibility === 'public' && (!body.adminPassword || body.adminPassword === '')) {
  return c.json(
    {
      error: {
        code: 'MISSING_ADMIN_PASSWORD',
        message: 'Public drops require an admin password to delete.',
      },
    },
    400
  );
}

let providedHash: string;
if (drop.visibility === 'private') {
  providedHash = await computePrivateAdminHash(body.contentHash ?? '', pepper);
} else {
  // adminPassword is validated to be non-empty above, so we can safely cast
  const adminPassword: string | undefined = body.adminPassword;
  providedHash = await sha256(adminPassword + drop.salt);
}
```

**New Error Response:**
- **Code:** `MISSING_ADMIN_PASSWORD`
- **Status:** `400 Bad Request`
- **Trigger:** Public drop delete without `adminPassword` or with empty `adminPassword`

**OpenAPI Schema Update (Lines 711-727):**
```typescript
responses: {
  200: { /* ... */ },
  400: {
    content: { 'application/json': { schema: errorResponseSchema } },
    description: 'Invalid request',
  },
  401: { /* ... */ },
  404: { /* ... */ },
},
```

---

## New Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_ADMIN_HASH` | 400 | Public drop creation requires `adminHash` |
| `MISSING_ADMIN_PASSWORD` | 400 | Public drop edit/delete requires `adminPassword` |

---

## Client-Side Implications

When creating/editing/deleting public drops, clients must:

1. **Create**: Include `adminHash` field (SHA-256 of `password + salt`)
2. **Edit**: Include `adminPassword` field
3. **Delete**: Include `adminPassword` field

**Important:** Do not send `null` values for optional fields like `iv`, `contentHash`, `newContentHash` when working with public drops. Omit them entirely.

---

## v1.0 Features

### Rate Limit Headers

**Location:** `apps/core/src/api/middleware.ts`

**Change:** Added rate limit headers to all API responses for forward compatibility. In v1.0, rate limiting is not enforced - these headers prepare clients for future rate limiting without breaking changes.

**Headers:**
- `X-RateLimit-Limit`: Maximum requests per window (default: 100)
- `X-RateLimit-Remaining`: Requests remaining (v1.0: always full limit)
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `X-RateLimit-Window`: Window length in seconds (default: 3600 = 1 hour)

**v1.1+:** Rate limit values will be actively tracked and enforced.

**Implementation:**
```typescript
export const rateLimitHeaders: MiddlewareHandler = async (c, next) => {
  const window = 3600; // 1 hour
  const limit = 100;
  const reset = Math.floor(Date.now() / 1000) + window;

  await next();

  const res = c.res;
  res.headers.set('X-RateLimit-Limit', limit.toString());
  res.headers.set('X-RateLimit-Remaining', limit.toString()); // Full for v1.0
  res.headers.set('X-RateLimit-Reset', reset.toString());
  res.headers.set('X-RateLimit-Window', window.toString());
};
```

---

### Algorithm Restrictions

**Location:** `packages/engine/src/crypto/algorithms.ts`

**Change:** Restricted encryption algorithm to `pbkdf2-aes256-gcm-v1` only for v1.0. Future algorithms can be added without breaking compatibility.

**Implementation:**
```typescript
export type EncryptionAlgorithm = 'pbkdf2-aes256-gcm-v1';
export const encryptionAlgorithmSchema = z.literal('pbkdf2-aes256-gcm-v1');

export function isAlgorithmSupported(algorithm: string): algorithm is EncryptionAlgorithm {
  return encryptionAlgorithmSchema.safeParse(algorithm).success;
}
```

**Benefits:**
- Clear contract for v1.0 clients
- Forward-compatible for future algorithms
- Prevents accidental use of unsupported algorithms

---

### Additional API Endpoints

The implementation includes endpoints not in the original design:

| Endpoint | Purpose | Description |
|----------|---------|-------------|
| `GET /api/health` | Health check | Returns API status and timestamp |
| `GET /api/docs` | Swagger UI | Interactive API documentation |
| `GET /api/docs/openapi.json` | OpenAPI spec | Machine-readable API specification |
| `GET /api/drops/generate-name` | Random name | Generate random drop names for UX |
| `GET /api/drops/check/{id}` | Availability check | Check if drop ID is available |
| `GET /api/drops/{id}/history` | Version list | List all versions of a drop |
| `GET /api/drops/{id}/history/{version}` | Get version | Retrieve specific version of a drop |
| `POST /api/drops/{id}/upgrade` | Tier upgrade | Upgrade from free to deep tier |

---

### OpenAPI Documentation

**Location:** `apps/core/src/api/openapi.ts`

**Change:** Added comprehensive OpenAPI 3.0 schemas for all endpoints, including:

- Request/response schemas with Zod validation
- Detailed field descriptions and examples
- Error response schemas
- Rate limit header schemas
- Security headers documentation

**Access:**
- **Swagger UI:** `https://api.dead-drop.xyz/api/docs`
- **OpenAPI JSON:** `https://api.dead-drop.xyz/api/docs/openapi.json`

---

### Security Enhancements

**Location:** `apps/core/src/api/middleware.ts`

**Change:** Added security headers to all API responses:

```typescript
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  const res = c.res;
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.headers.delete('Server'); // Remove server information disclosure
};
```

**Benefits:**
- Prevents MIME type sniffing attacks
- Prevents clickjacking via frame embedding
- Enforces HTTPS connections
- Removes server version information

---

## Documentation Updates

### Design Document Corrections

**File:** `initial-design.md`

**Change:** Corrected `adminHash` documentation to reflect implementation:

**Before:**
```typescript
adminHash: text('admin_hash'), // Null if private
```

**After:**
```typescript
adminHash: text('admin_hash'), // Both private & public drops use this for authentication
```

**Rationale:** Both visibility types require `adminHash` for edit/delete operations:
- **Private drops:** `SHA-256(contentHash + pepper)` for server-side protection
- **Public drops:** `SHA-256(adminPassword + salt)` for client-provided authentication

---

### New Documentation Files

**File:** `docs/api-reference.md`

**Change:** Created comprehensive API reference documentation covering:

- API overview and key concepts
- All endpoints with request/response examples
- Algorithm specifications (v1.0)
- Tier specifications and limits
- Error codes and handling
- Client-side implementation guide
- Security considerations
- Future roadmap

**Purpose:** Single source of truth for API consumers and developers.

---

## Breaking Changes

**None in v1.0.0**

All changes are additions or enhancements. No existing functionality was removed or changed in a breaking manner.
