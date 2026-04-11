# API Changes for Public Drop Support

## Overview
Added validation and authentication for public drop creation, editing, and deletion.

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
