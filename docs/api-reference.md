# dead-drop.xyz API Reference

**Version:** 1.0.0
**Base URL:** `https://api.dead-drop.xyz`
**Documentation UI:** `https://api.dead-drop.xyz/api/docs`

---

## Overview

The dead-drop.xyz API is a RESTful service for creating and managing ephemeral, privacy-focused data drops. All endpoints return JSON and include rate limit headers for forward compatibility.

### Key Concepts

- **Drop ID**: Always a SHA-256 hash of the normalized drop name (never plaintext)
- **Encryption**: Client-side encryption using Web Crypto API (AES-256-GCM)
- **Authentication**: Hash-based authentication for edit/delete operations
- **Visibility**: Private drops (encrypted) vs Public drops (plaintext)
- **Tiers**: Free (10KB, 7 days) vs Deep (4MB, 90 days)

### Authentication

The API does not require authentication for read operations. Write operations (create, update, delete) use hash-based authentication:

- **Private drops**: `SHA-256(contentHash + pepper)` where pepper is server-side
- **Public drops**: `SHA-256(adminPassword + salt)` where salt is per-drop

### Rate Limiting (v1.0)

All API responses include rate limit headers for forward compatibility. In v1.0, rate limiting is not enforced - these headers prepare clients for future rate limiting without breaking changes.

**Headers:**
- `X-RateLimit-Limit`: Maximum requests per window (default: 100)
- `X-RateLimit-Remaining`: Requests remaining (v1.0: always full limit)
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `X-RateLimit-Window`: Window length in seconds (default: 3600 = 1 hour)

**v1.1+:** Rate limit values will be actively tracked and enforced.

---

## Endpoints

### Health Check

#### GET /api/health

Check API health and availability.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-18T12:00:00.000Z"
}
```

---

### Drops

#### GET /api/drops/:id

Retrieve a drop by ID.

**Parameters:**
- `id` (path, required): SHA-256 hash of normalized drop name

**Response (200 OK):**
```json
{
  "id": "7c4e8d3a9f1b6e2c8d4a7f3b9e1c5d8a2f6b4e9d3c7a1f8b5e2d9c4a6f3b7e1d",
  "tier": "free",
  "visibility": "private",
  "payload": "hex-encoded-aes-gcm-ciphertext",
  "salt": "a1b2c3d4e5f6...",
  "iv": "g7h8i9j0k1l2",
  "encryptionAlgo": "pbkdf2-aes256-gcm-v1",
  "encryptionParams": null,
  "mimeType": "text/plain",
  "hashAlgo": "sha-256",
  "expiresAt": "2026-04-25T12:00:00.000Z"
}
```

**Fields:**
- `id`: SHA-256 hash of drop name
- `tier`: Drop tier (`"free"` or `"deep"`)
- `visibility`: Drop visibility (`"private"` or `"public"`)
- `payload`: For private drops: hex-encoded AES-GCM ciphertext (opaque). For public drops: raw content string, interpreted by `mimeType`.
- `salt`: Hex-encoded salt
- `iv`: Hex-encoded IV (null for public drops)
- `encryptionAlgo`: Encryption algorithm used (null for public drops)
- `mimeType`: MIME type of the content
- `hashAlgo`: Hash algorithm for admin authentication
- `expiresAt`: ISO 8601 timestamp when drop expires

**Error Responses:**
- `404 Not Found`: Drop does not exist or has expired

---

#### POST /api/drops

Create a new drop.

**Request Body:**
```json
{
  "id": "7c4e8d3a9f1b6e2c8d4a7f3b9e1c5d8a2f6b4e9d3c7a1f8b5e2d9c4a6f3b7e1d",
  "nameLength": 14,
  "tier": "free",
  "visibility": "private",
  "payload": "hex-encoded-aes-gcm-ciphertext",
  "salt": "a1b2c3d4e5f6...",
  "iv": "g7h8i9j0k1l2",
  "encryptionAlgo": "pbkdf2-aes256-gcm-v1",
  "mimeType": "text/plain",
  "contentHash": "sha256-of-content",
  "I_agree_with_terms_and_conditions": true
}
```

**Fields:**
- `id` (required): SHA-256 hash of normalized drop name
- `nameLength` (required): Length of original drop name (used for tier validation)
- `tier` (required): `"free"` or `"deep"`
- `visibility` (required): `"private"` or `"public"`
- `payload` (required): For private drops: hex-encoded AES-GCM ciphertext. For public drops: raw content string, interpreted by `mimeType`.
- `salt` (required): Random salt for encryption/authentication
- `iv` (optional): Initialization vector (required for private drops)
- `encryptionAlgo` (optional): Must be `"pbkdf2-aes256-gcm-v1"` in v1.0 (required for private drops)
- `encryptionParams` (optional): Algorithm-specific parameters
- `mimeType` (optional): Must be `"text/plain"` in v1.0, defaults to `text/plain`
- `contentHash` (optional): SHA-256 hash of content (required for private drops)
- `adminHash` (optional): `SHA-256(adminPassword + salt)` (required for public drops)

**Response (201 Created):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request body or missing required fields
- `402 Payment Required`: Payload exceeds tier limit
- `409 Conflict`: Drop with this ID already exists

---

#### PUT /api/drops/:id

Update an existing drop.

**Parameters:**
- `id` (path, required): SHA-256 hash of normalized drop name

**Request Body:**
```json
{
  "payload": "new-hex-encoded-aes-gcm-ciphertext",
  "iv": "new-initialization-vector",
  "contentHash": "content-hash-for-auth",
  "adminPassword": "admin-password"
}
```

**Fields:**
- `payload` (required): For private drops: hex-encoded AES-GCM ciphertext. For public drops: raw content string.
- `iv` (optional): New initialization vector (for private drops)
- `contentHash` (optional): Content hash for private drop authentication
- `adminPassword` (optional): Admin password for public drop authentication

**Response (200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request or missing authentication
- `401 Unauthorized`: Invalid authentication hash
- `404 Not Found`: Drop does not exist

---

#### DELETE /api/drops/:id

Delete a drop.

**Parameters:**
- `id` (path, required): SHA-256 hash of normalized drop name

**Request Body:**
```json
{
  "contentHash": "content-hash-for-auth",
  "adminPassword": "admin-password"
}
```

**Fields:**
- `contentHash` (optional): Content hash for private drop authentication
- `adminPassword` (optional): Admin password for public drop authentication

**Response (200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request or missing authentication
- `401 Unauthorized`: Invalid authentication hash
- `404 Not Found`: Drop does not exist

---

### Drop History

#### GET /api/drops/:id/history

List all versions of a drop.

**Parameters:**
- `id` (path, required): SHA-256 hash of normalized drop name

**Response (200 OK):**
```json
{
  "id": "7c4e8d3a9f1b6e2c8d4a7f3b9e1c5d8a2f6b4e9d3c7a1f8b5e2d9c4a6f3b7e1d",
  "versions": [
    {
      "version": 1,
      "createdAt": "2026-04-18T10:00:00.000Z"
    },
    {
      "version": 2,
      "createdAt": "2026-04-18T12:00:00.000Z"
    }
  ]
}
```

---

#### GET /api/drops/:id/history/:version

Get a specific version of a drop.

**Parameters:**
- `id` (path, required): SHA-256 hash of normalized drop name
- `version` (path, required): Version number

**Response (200 OK):**
```json
{
  "id": "7c4e8d3a9f1b6e2c8d4a7f3b9e1c5d8a2f6b4e9d3c7a1f8b5e2d9c4a6f3b7e1d",
  "version": 1,
  "payload": "hex-encoded-aes-gcm-ciphertext",
  "iv": "g7h8i9j0k1l2",
  "encryptionAlgo": "pbkdf2-aes256-gcm-v1",
  "mimeType": "text/plain",
  "createdAt": "2026-04-18T10:00:00.000Z"
}
```

---

### Drop Upgrade

#### POST /api/drops/:id/upgrade

Upgrade a drop from free to deep tier.

**Parameters:**
- `id` (path, required): SHA-256 hash of normalized drop name

**Request Body:**
```json
{
  "upgradeToken": "upgrade-token-from-payment"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "tier": "deep"
}
```

---

### Utility Endpoints

#### GET /api/drops/generate-name

Generate a random drop name (UX enhancement).

**Query Parameters:**
- `length` (optional, default: 12): Length of name to generate

**Response (200 OK):**
```json
{
  "name": "random-name-generated"
}
```

---

#### GET /api/drops/check/:id

Check if a drop ID is available (UX enhancement).

**Parameters:**
- `id` (path, required): SHA-256 hash of normalized drop name

**Response (200 OK):**
```json
{
  "available": true
}
```

---

### Documentation

#### GET /api/docs

Swagger UI documentation interface.

---

#### GET /api/docs/openapi.json

OpenAPI 3.0 specification.

---

## Algorithm Specifications (v1.0)

### Encryption Algorithm

**Supported:** `pbkdf2-aes256-gcm-v1` only

This is the only encryption algorithm supported in v1.0. Future versions may add additional algorithms without breaking compatibility.

**Algorithm Details:**
- **Key Derivation:** PBKDF2 (100,000 iterations, SHA-256)
- **Encryption:** AES-256-GCM
- **IV Length:** 12 bytes (96 bits)
- **Salt Length:** 16 bytes (128 bits)

### Hash Algorithm

**Supported:** `SHA-256` only

v1.0 uses SHA-256 for all authentication hashes. Future v1.1+ may add algorithm versioning via `hashAlgo` field.

**Usage:**
- **Private drops:** `SHA-256(contentHash + pepper)` where pepper is server-side
- **Public drops:** `SHA-256(adminPassword + salt)` where salt is per-drop

### MIME Types

**Supported:** `text/plain` only

v1.0 only supports plain text content. Core edition enforces text-only. SaaS edition will add file upload support.

---

## Tier Specifications

### Free Tier

- **Max Payload:** 10 KB (10,240 bytes)
- **Max Name Length:** 12 characters
- **Expiration:** 7 days
- **Max Versions:** 5
- **Content:** Text only

### Deep Tier

- **Max Payload:** 4 MB (4,194,304 bytes)
- **Min Name Length:** 3 characters
- **Expiration:** 90 days
- **Max Versions:** 20
- **Content:** Text + files (SaaS edition only)

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `MISSING_ADMIN_HASH` | 400 | Public drop creation requires adminHash |
| `MISSING_ADMIN_PASSWORD` | 400 | Public drop edit/delete requires adminPassword |
| `PAYMENT_REQUIRED` | 402 | Payload exceeds tier limit |
| `CONFLICT` | 409 | Drop with this ID already exists |
| `UNAUTHORIZED` | 401 | Invalid authentication hash |
| `BAD_REQUEST` | 400 | Invalid request body or parameters |

---

## Client-Side Implementation Guide

### Creating a Drop

1. Generate a random salt (16 bytes)
2. Normalize the drop name (lowercase, kebab-case)
3. Hash the normalized name with SHA-256 to get the drop ID
4. For private drops:
   - Derive encryption key using PBKDF2 (password + salt, 600k iterations)
   - Encrypt payload using AES-256-GCM (key + random IV)
   - Compute content hash: `SHA-256(content)`
5. For public drops:
   - Payload is the raw content string directly (no encoding)
   - Compute admin hash: `SHA-256(adminPassword + salt)`
6. POST to `/api/drops` with all fields

### Reading a Drop

1. GET the drop by ID from `/api/drops/:id`
2. For private drops:
   - Derive encryption key using PBKDF2 (password + salt from DB)
   - Decrypt payload using AES-256-GCM (key + IV from DB)
3. For public drops:
   - Payload is the raw content string (interpreted by `mimeType`)

### Updating a Drop

1. Follow the creation process for the new content
2. Include authentication (contentHash for private, adminPassword for public)
3. PUT to `/api/drops/:id` with new payload and auth

### Deleting a Drop

1. Provide authentication (contentHash for private, adminPassword for public)
2. DELETE `/api/drops/:id`

---

## Security Considerations

1. **Client-Side Encryption:** All encryption happens client-side. Server only stores encrypted data.
2. **Server-Side Pepper:** Private drop authentication uses server-side pepper to prevent unauthorized edits.
3. **No PII in Logs:** Audit logs contain no personally identifiable information.
4. **Rate Limiting Headers:** v1.0 includes headers for forward compatibility; enforcement planned for v1.1+
5. **IV Regeneration:** Each edit generates a new IV to prevent IV reuse.

---

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:
- **JSON:** `https://api.dead-drop.xyz/api/docs/openapi.json`
- **UI:** `https://api.dead-drop.xyz/api/docs`

---

## Future Roadmap

### v1.1 (Planned)
- Active rate limiting enforcement
- Additional hash algorithms (SHA-512, Argon2)
- File upload support (SaaS edition)

### v2.0 (Future)
- Additional encryption algorithms (XChaCha20-Poly1305)
- Enhanced audit logging
- Multi-factor authentication options

---

## Support

- **Documentation:** See Swagger UI at `/api/docs`
- **Issues:** Report via GitHub Issues
- **Contact:** admin@dead-drop.xyz
