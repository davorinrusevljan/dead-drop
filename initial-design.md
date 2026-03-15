# Project Design Document: dead-drop.xyz

## 1. System Context & Objective
**Objective:** Build a privacy-focused, ephemeral data-sharing service (`dead-drop.xyz`) running on Cloudflare Workers (Edge Runtime).
**Architecture:** Monorepo (Turborepo + pnpm workspaces) generating applications for two distinct environments:
1.  **Core Edition (`apps/core`):** Open-source community edition. Free tier only. Text only. D1 Database storage.
2.  **SaaS Edition (`apps/saas`):** Production service. Includes Deep Drops (File uploads), Stripe Billing, and R2 Object Storage.

---

## 2. Monorepo Architecture & Tech Stack
The system is decoupled into a UI frontend and a lightweight Edge API.

*   **Frontend:** Next.js 14.2.x (App Router). Pure UI deployed to Cloudflare Pages.
*   **API:** Hono. A lightning-fast, edge-native REST API deployed to Cloudflare Workers.
*   **Database:** Cloudflare D1 (via Drizzle ORM).
*   **Storage:** Cloudflare R2 (SaaS edition only).

### Directory Structure
```text
/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── vitest.config.ts
├── apps/
│   ├── core/             # Community Version (Next.js UI + Hono API configured for D1 only)
│   └── saas/             # Production Version (Next.js UI + Hono API configured for D1, R2, Stripe)
└── packages/
    ├── engine/           # Shared logic (Zod schemas, Drizzle DB schema, Web Crypto wrappers)
    └── ui/               # Shared React components (Terminal interface, Drop Viewer)
```

---

## 3. UX Lexicon & Terminology
*Coding agents MUST strictly use these exact terms in variables, component names, and UI copy.*

### Axis 1: Billing & Capacity (Tier)
*   **Standard Drop:** Free. Max 10 KB. Text-only. 7-Day lifespan. Phrase must be `>= 8` chars.
*   **Deep Drop:** Paid ($1). Max 4 MB. Supports text/files. 90-Day lifespan. Phrase can be `>= 3` chars (Vanity URLs).

### Axis 2: Security & Access (Visibility)
*   **Protected Drop:** Content encrypted client-side. Zero-Knowledge. Password required to *read* and *edit*.
*   **Public Drop:** Content is plaintext. Anyone with the URL can *read*. Password required only to *edit*.

### Core Terms
*   **Drop Phrase:** The URL-safe identifier (the "location").
*   **Drop Password:** The secret string used for encryption or authentication (the "key").

---

## 4. User Stories & Core Workflows

### 4.1 Access via "The Front Door" (Manual Entry)
1.  **Given** a user visits the homepage `dead-drop.xyz`.
2.  **When** they type `project-alpha` into the terminal prompt (`> Enter Drop Phrase_`) and hit Enter.
3.  **Then** the client hashes the phrase and checks the API (`GET /api/drops/:id`).
4.  **Result:**
    *   If `404 Not Found`: UI transitions to Creation state ("Drop available. Create a new drop.").
    *   If `200 OK` (Public): UI transitions to Viewer state and displays the plaintext content.
    *   If `200 OK` (Protected): UI transitions to Unlock state ("Protected Drop Found. Enter Drop Password.").

### 4.2 Access via Direct Link
1.  **Given** a user clicks a link: `dead-drop.xyz/drop/project-alpha`.
2.  **When** the Next.js page loads, it extracts `project-alpha` from the route parameters.
3.  **Then** it automatically executes the API fetch from Story 4.1 and follows the identical resolution paths.

### 4.3 Creating a Drop
1.  **Given** a user is in the Creation state for `project-alpha`.
2.  **When** they input their Drop Password, select visibility, type their content, and click "Create".
3.  **Then** the client processes the data (Encrypts if Protected, Hashes Admin Password if Public).
4.  **And** the client `POST`s the payload to the API.
5.  **Result:** User is shown a success message with the shareable URL.

### 4.4 Upgrading to a Deep Drop
1.  **Given** a user has an existing Standard drop.
2.  **When** they want to upload a larger file (> 10KB) or extend lifespan.
3.  **Then** the client calls `POST /api/drops/:id/upgrade` with the upgrade token.
4.  **Result:** Drop tier changes to `deep`, lifespan extends to 90 days, version limit increases to 20.

---

## 5. API Specification (Hono Worker)
*All API routes live under `/api`. The `:id` parameter is ALWAYS the `SHA-256` hash of the sanitized Drop Phrase, never the plaintext phrase.*

**Note:** The API is open and can be used directly without the frontend. No CORS restrictions. All endpoints are documented via OpenAPI/Swagger at `/api/docs`.

### `GET /api/health`
*   **Purpose:** Health check for monitoring.
*   **Response (200):** `{ status: 'ok', timestamp: string }`

### `GET /api/docs`
*   **Purpose:** OpenAPI/Swagger documentation.
*   **Response:** Swagger UI rendered at this endpoint.

### `GET /api/drops/:id`
*   **Purpose:** Retrieve drop data.
*   **Logic:** Fetch from D1. If `expiresAt < NOW()`, trigger async deletion of D1 row (and R2 object if applicable), and return `404`. If `r2Key` exists, fetch payload from R2. Otherwise, use D1 `data`.
*   **Response (200):** `{ id, tier, visibility, payload, salt, iv, expiresAt }`

### `POST /api/drops`
*   **Purpose:** Create a new drop.
*   **Body (Protected):** `{ id, phraseLength, tier, visibility: 'protected', payload, salt, iv, contentHash, upgradeToken? }`
*   **Body (Public):** `{ id, phraseLength, tier, visibility: 'public', payload, salt, adminHash, upgradeToken? }`
*   **Logic:**
    1. Validate `phraseLength` against `tier` minimums (if `upgradeToken` provided, use Deep rules).
    2. Calculate `payload` size in bytes. If `> 10KB` and no valid `upgradeToken`, return `402 Payment Required`.
    3. If `upgradeToken` provided and valid, set `tier = 'deep'` and calculate 90-day expiry.
    4. **Protected:** Compute `adminHash = SHA-256(contentHash + PEPPER)` using server-side pepper.
    5. Insert into D1. If `id` already exists, return `409 Conflict` (first creator wins).
    6. Create audit log entry with action `created`.
*   **Response (201):** `{ success: true, version: 1, tier }`
*   **Error (402):** `{ error: { code: 'PAYMENT_REQUIRED', message: 'Payload exceeds 10KB. Upgrade to Deep drop required.' } }`
*   **Error (409):** `{ error: { code: 'DROP_EXISTS', message: 'Drop phrase already taken' } }`

### Race Condition Handling
On `409 Conflict`, the UI must display an error and prompt the user to choose a different drop phrase. The UI should:
1. Show clear message: "This drop phrase is already taken."
2. Provide an input field to enter a new phrase.
3. Re-validate and re-submit on user action.

### `PUT /api/drops/:id`
*   **Purpose:** Update an existing drop (creates new version in history).
*   **Body (Protected):** `{ payload, iv, contentHash }` — salt remains constant per drop, client reuses salt from GET response.
*   **Body (Public):** `{ payload, adminPassword }`
*   **Logic:**
    1. Fetch drop. If `404`, return `404`.
    2. Calculate `payload` size. If `> 10KB` and `tier == 'free'`, return `402 Payment Required`.
    3. Check version count against tier limit (Standard: 5, Deep: 20). If at limit, return `403 Forbidden`.
    4. **Protected:** Compute `SHA-256(contentHash + PEPPER)`. If `!== db.adminHash`, return `401 Unauthorized`. If match, archive current version to history, insert new version, update adminHash.
    5. **Public:** Compute `SHA-256(adminPassword + db.salt)`. If `!== db.adminHash`, return `401 Unauthorized`. If match, archive current version to history, insert new version.
    6. Increment `version` counter on drop.
    7. Create audit log entry with action `edited`.
*   **Response (200):** `{ success: true, version: <new_version> }`
*   **Error (402):** `{ error: { code: 'PAYMENT_REQUIRED', message: 'Payload exceeds 10KB. Upgrade to Deep drop required.' } }`
*   **Error (403):** `{ error: { code: 'VERSION_LIMIT', message: 'Maximum number of versions reached' } }`

### `GET /api/drops/:id/history`
*   **Purpose:** List all versions of a drop.
*   **Response (200):** `{ versions: [{ version, createdAt }], current: <number>, maxVersions: <number> }`

### `GET /api/drops/:id/history/:version`
*   **Purpose:** Retrieve a specific historical version.
*   **Response (200):** `{ version, payload, iv, createdAt }`

### `DELETE /api/drops/:id`
*   **Purpose:** Delete a drop and all its history.
*   **Body (Protected):** `{ contentHash }`
*   **Body (Public):** `{ adminPassword }`
*   **Logic:**
    1. Fetch drop. If `404`, return `404`.
    2. **Protected:** Compute `SHA-256(contentHash + PEPPER)`. If `!== db.adminHash`, return `401 Unauthorized`.
    3. **Public:** Compute `SHA-256(adminPassword + db.salt)`. If `!== db.adminHash`, return `401 Unauthorized`.
    4. Delete drop row, all dropHistory rows, and R2 object (if applicable).
    5. Create audit log entry with action `deleted`.
*   **Response (200):** `{ success: true }`

### `POST /api/drops/:id/upgrade`
*   **Purpose:** Upgrade a Standard drop to Deep drop.
*   **Body:** `{ token: string }`
*   **Logic:**
    1. Fetch drop. If `404`, return `404`.
    2. If `tier !== 'free'`, return `400 Bad Request` (already upgraded).
    3. Validate `token` against `UPGRADE_TOKEN` environment variable.
    4. If invalid, return `401 Unauthorized`.
    5. Update drop: `tier = 'deep'`, extend `expiresAt` to 90 days, update phrase length validation.
*   **Response (200):** `{ success: true, tier: 'deep', expiresAt }`
*   **Error (401):** `{ error: { code: 'INVALID_TOKEN', message: 'Invalid upgrade token' } }`

### SaaS Billing Endpoints (`apps/saas` only)
*Future implementation.* Structure in place for Stripe integration:
*   `POST /api/payments/checkout`: Creates Stripe session. Returns `{ checkoutUrl }`.
*   `POST /api/payments/webhook`: Stripe webhook handler. Calls upgrade logic on successful payment.

**Current mock:** Use `POST /api/drops/:id/upgrade` with `UPGRADE_TOKEN` from environment. Only developers with the token can create Deep drops for testing.

---

## 6. Data Structures & Storage

### 6.1 Drop Payload (Client-Side Encapsulation)
To support files while maintaining Zero-Knowledge, the client wraps all inputs in JSON *before* encryption/upload.
```typescript
// Defined in packages/engine/src/types.ts
type DropContentPayload = 
  | { type: 'text'; content: string }
  | { type: 'file'; mime: string; name: string; data: string /* Base64 */ };
```

### 6.2 Drizzle Schema (Cloudflare D1)
```typescript
// Defined in packages/engine/src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const drops = sqliteTable('drops', {
  id: text('id').primaryKey(), // SHA-256(phrase)
  version: integer('version').default(1).notNull(), // Current version number
  data: text('data'),          // Null if payload > 10KB
  r2Key: text('r2_key'),       // Null if payload <= 10KB
  visibility: text('visibility').default('protected').notNull(), // 'protected' | 'public'
  salt: text('salt').notNull(),
  iv: text('iv'),              // Null if public
  adminHash: text('admin_hash').notNull(), // SHA-256(contentHash + PEPPER) for protected, SHA-256(adminPassword + salt) for public
  tier: text('tier').default('free').notNull(),
  paymentStatus: text('payment_status').default('none').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

export const dropHistory = sqliteTable('drop_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dropId: text('drop_id').notNull().references(() => drops.id),
  version: integer('version').notNull(),
  data: text('data'),          // Null if payload > 10KB
  r2Key: text('r2_key'),       // Null if payload <= 10KB
  iv: text('iv'),              // Null if public
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

export const dropAuditLog = sqliteTable('drop_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dropId: text('drop_id').notNull(), // SHA-256 hash - non-reversible
  action: text('action').notNull(),  // 'created' | 'edited' | 'deleted'
  version: integer('version'),       // Version number (null for 'deleted')
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});
```

### 6.3 Audit Log
The audit log tracks drop lifecycle events for operational visibility. It contains **no client identifiers** (no IP, user agent, etc.) and only stores the non-reversible drop ID hash.

| Action | When | Version Field |
|--------|------|---------------|
| `created` | On POST | 1 |
| `edited` | On PUT | new version number |
| `deleted` | On DELETE | null |

### 6.4 Version Limits by Tier
| Tier | Max Versions |
|------|--------------|
| Standard (free) | 5 |
| Deep (paid) | 20 |

---

## 7. Cryptography & Validation Rules

### 7.1 Drop Phrase Validation (Zod)
**File:** `packages/engine/src/validation.ts`
*   **Transform:** `.trim().toLowerCase().replace(/\s+/g, '-')`
*   **Allowed:** `/^[a-z0-9\-_\.]+$/`
*   **Forbidden:** `.startsWith('.')`, `.endsWith('.')`, `.includes('..')`.
*   **Forbidden Slugs:** `api`, `drop`, `admin`, `dashboard`, `assets`, `robots.txt`.
*   **Tiers:** Standard Drop requires `>= 8` chars. Deep Drop requires `>= 3` chars.

### 7.2 Cryptography Algorithms (Web Crypto API)
**File:** `packages/engine/src/crypto.ts` (Must use native Web Crypto API, no Node.js `crypto` module).

#### Client-Side Operations
*   **Salt & IV Generation:** Client generates random `salt` (16 bytes) and `iv` (12 bytes) at drop creation. Salt remains constant for the drop's lifetime; IV is regenerated for each edit/version.
*   **ID Hash:** `SHA-256(SanitizedPhrase)`
*   **Content Hash (Protected):** `SHA-256(contentPayloadJson)` — client sends this, never the plaintext content.
*   **Key Derivation (Protected):** `PBKDF2` (100,000 iterations, SHA-256, 16-byte random salt).
*   **Encryption (Protected):** `AES-GCM` 256-bit (12-byte random IV).
*   **Admin Hash (Public):** `SHA-256(AdminPassword + Salt)` — computed client-side.

#### Server-Side Operations
*   **Admin Hash (Protected):** `SHA-256(contentHash + PEPPER)` — server stores this. The `PEPPER` is a secret environment variable (`ADMIN_HASH_PEPPER`) not stored in the database. This protects against DB dump attacks on low-entropy content.

### 7.3 Security Notes
*   **Salt & IV are not secrets:** Both are safe to transmit and store in plaintext. Salt prevents rainbow table attacks on key derivation. IV ensures unique ciphertexts for identical plaintexts. Security comes from the key (derived from password), which never leaves the client.
*   **Zero-Knowledge for Protected Drops:** Server never sees the Drop Password, encryption key, or plaintext content. Only encrypted payload and non-secret cryptographic parameters (salt, iv, contentHash) are transmitted.

---

## 8. Environment Variables

| Variable | Description | Required By |
|----------|-------------|-------------|
| `ADMIN_HASH_PEPPER` | Secret pepper for admin hash derivation (protected drops) | API Worker |
| `UPGRADE_TOKEN` | Secret token for upgrading drops (mock payment, dev use only) | API Worker |
| `STRIPE_SECRET_KEY` | Stripe API secret key (future) | SaaS API |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (future) | SaaS API |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket name | SaaS API |
| `R2_ACCESS_KEY_ID` | R2 access key | SaaS API |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | SaaS API |

---

## 9. Development Environment

### 9.1 Dev Container
The project uses a VS Code Dev Container for consistent development environment across all machines.

**Container includes:**
*   Node.js 22.x (LTS)
*   pnpm 9.x
*   wrangler (Cloudflare Workers CLI)
*   Turborepo CLI

**Directory:** `.devcontainer/`

**To start developing:**
1. Open project in VS Code
2. Click "Reopen in Container" when prompted
3. Run `pnpm install`
4. Start local development servers

### 9.2 Database Migrations
Using Drizzle Kit for schema management with Cloudflare D1:

*   **Generate migration:** `pnpm drizzle-kit generate`
*   **Apply locally:** `pnpm wrangler d1 migrations apply dead-drop --local`
*   **Apply to production:** `pnpm wrangler d1 migrations apply dead-drop --remote`

Migration files are stored in `packages/engine/drizzle/` and versioned in git.

---

## 10. API Documentation

All API endpoints are documented using OpenAPI 3.0 specification.

*   **Library:** `@hono/zod-openapi` for schema-driven API definitions
*   **UI:** Swagger UI available at `GET /api/docs`
*   **Spec:** OpenAPI JSON available at `GET /api/docs/openapi.json`

Each route must include:
*   Request/response schemas (Zod)
*   Authentication requirements
*   Error response schemas

---

## 11. Quality Assurance & Standards

1.  **Strict Code Coverage (100%):** The project enforces 100% coverage across Statements, Branches, Functions, and Lines using `vitest` (v8 provider).
    *   *Exceptions:* Allowed only via explicit `coverage.exclude` in `vitest.config.ts`.
2.  **Pre-Commit Hooks:** `husky` and `lint-staged` must run:
    *   `eslint --max-warnings=0`
    *   `prettier --check`
    *   `tsc --noEmit`
    *   `vitest run --passWithNoTests`
3.  **CI/CD:** GitHub Actions must execute the above checks. PRs failing 100% coverage must be rejected automatically.

---

## 12. Agent Implementation Roadmap

**Step 0: Dev Container Setup**
*   Create `.devcontainer/devcontainer.json` with Node.js 20, pnpm, wrangler.
*   Create `.devcontainer/Dockerfile` if custom image needed.
*   Test container builds and all tools are available.

**Step 1: Workspace & QA Foundation**
*   Initialize Turborepo, `apps/core`, `apps/saas`, `packages/engine`, and `packages/ui`.
*   Install and configure Vitest, ESLint, Prettier, Husky.
*   Establish 100% coverage thresholds. Configure CI workflow.

**Step 2: Engine Logic (`packages/engine`)**
*   Implement Zod `validation.ts`.
*   Implement Web Crypto wrappers in `crypto.ts`.
*   Implement Drizzle `schema.ts`.
*   *Requirement:* Write unit tests achieving 100% coverage.

**Step 3: Core API & UI (`apps/core` & `packages/ui`)**
*   Build the Hono worker logic with OpenAPI integration.
*   Implement all routes: `GET /api/health`, `GET /api/docs`, `GET/POST/PUT/DELETE /api/drops`, history endpoints, upgrade endpoint.
*   Build the Next.js App Router structure (`/`, `/drop/[phrase]`).
*   Build `TerminalInput` component (auto-formats phrases, handles API checks).
*   Implement Client-side encryption/decryption flow using `engine`.
*   *Requirement:* Integration tests mocking D1 database.

**Step 4: SaaS Features & E2E Verification (`apps/saas`)**
*   Implement Hybrid Storage routing (D1 vs R2 abstraction based on size).
*   Implement Stripe Checkout and Webhook routes in Hono API (future).
*   Write Playwright tests:
    *   *Privacy:* Intercept network request; assert payload does not contain plaintext password/data.
    *   *Integrity:* Attempt 4MB payload on Standard Tier; assert rejection.
    *   *Vanity:* Attempt 3-char phrase on Standard Tier; assert validation error.