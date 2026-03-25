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
*   **Standard Drop:** Free. Max 10 KB. Text-only. 7-Day lifespan. Name must be `>= 12` chars (calculated after spaces are converted to hyphens).
*   **Deep Drop:** Paid ($1). Max 4 MB. Supports text/files. 90-Day lifespan. Name can be `>= 3` chars (Vanity URLs).

### Axis 2: Security & Access (Visibility)
*   **Private Drop:** Content encrypted client-side. Zero-Knowledge. Password required to *read* and *edit*.
*   **Public Drop:** Content is plaintext. Anyone with the URL can *read*. Password required only to *edit*.

### Core Terms
*   **Drop Name:** The multi-word, URL-safe identifier (the "location").
*   **Drop Password:** The secret string used for encryption or authentication (the "key").

---

## 4. The "Zero-Knowledge" Routing Strategy (Fragment Routing)
To ensure absolute privacy, the plaintext Drop Name must **never** touch the server logs or ISP DNS records. 

We achieve this by abandoning traditional URL paths (`/drop/my-name`) and using **URL Fragments (`#`)**. 
*   **Shareable Link:** `dead-drop.xyz/#quick-brown-fox`
*   **What the Server sees:** `GET /` (Complete privacy).

### 4.1 Client-Side Extraction (Next.js)
Because the fragment (`#`) is not sent to the Next.js server, the Drop Name must be extracted using a Client Component (`"use client"`).

```tsx
// Example Implementation (apps/core/src/app/page.tsx)
'use client';
import { useEffect, useState } from 'react';
import { normalizeDropName, hashDropName } from '@dead-drop/engine';

export default function Home() {
  const [dropName, setDropName] = useState<string | null>(null);

  useEffect(() => {
    // 1. Extract the fragment from the window object
    const hash = window.location.hash.replace('#', '');
    
    if (hash) {
      // 2. Normalize it (Auto-Kebab)
      const normalized = normalizeDropName(hash);
      setDropName(normalized);
      
      // 3. Hash it and fetch from API
      const id = hashDropName(normalized);
      fetch(`/api/drops/${id}`).then(/* ... */);
    }
  }, []);

  // ... Render UI
}
```

---

## 5. User Stories & Core Workflows

### 5.1 Access via Direct Link (`#`)
1.  **Given** a user clicks a link: `dead-drop.xyz/#project-alpha`.
2.  **When** the Next.js page loads, the Client Component extracts `project-alpha` from `window.location.hash`.
3.  **Then** the client hashes the normalized name and checks the API (`GET /api/drops/:id`).
4.  **Result:**
    *   If `404 Not Found`: UI transitions to Creation state ("Drop available.").
    *   If `200 OK` (Public): UI transitions to Viewer state.
    *   If `200 OK` (Private): UI transitions to Unlock state ("Enter Drop Password.").

### 5.2 Access via "The Front Door" (Manual Entry)
1.  **Given** a user visits `dead-drop.xyz`.
2.  **When** they type `Project Alpha` into the terminal prompt.
3.  **Then** the UI auto-normalizes the input to `project-alpha` and updates the URL fragment to `#project-alpha` without reloading the page (`window.history.pushState`).
4.  **And** the client executes the API fetch from Story 5.1.

### 5.3 Creating a Drop
1.  **Given** a user is in the Creation state for `#project-alpha`.
2.  **When** they input their Drop Password, select visibility, type their content, and click "Create".
3.  **Then** the client encrypts the data (if Private) or Hashes the Admin Password (if Public).
4.  **And** the client `POST`s the payload to the API.
5.  **Result:** User is shown a success message with the shareable URL.

### 5.4 Upgrading to a Deep Drop (SaaS Edition)
1.  **Given** a user selects a 3MB file to upload.
2.  **When** the client detects payload size `> 10KB`, it prompts for a $1 upgrade.
3.  **Then** the client requests `POST /api/payments/checkout`.
4.  **And** upon Stripe Webhook success, the client encrypts the file and `PUT`s it to the API.

---

## 6. Drop Name Normalization & Validation (Auto-Kebab)

To support multi-word phrases (e.g., `"quick brown polar bear"`) while preventing hashing mismatches and ugly URLs, the client applies an aggressive **Auto-Kebab Normalization** pipeline *before* Zod validation or hashing.

**File:** `packages/engine/src/validation.ts`

### 6.1 Normalization Pipeline
1.  **Trim:** Remove leading/trailing whitespace.
2.  **Lowercase:** `Quick Brown` → `quick brown`.
3.  **Kebab-Case (Space Replacement):** Replace any sequence of spaces with a single hyphen. `quick   brown` → `quick-brown`.
4.  **Strip Invalid Characters:** Remove anything that isn't `a-z`, `0-9`, `-`, `_`, or `.`.

### 6.2 Zod Validation Rules (Applied *after* Normalization)
*   **Allowed:** `/^[a-z0-9\-_\.]+$/`
*   **Forbidden:** `.startsWith('.')`, `.endsWith('.')`, `.includes('..')`.
*   **Forbidden Slugs:** `api`, `drop`, `admin`, `dashboard`, `assets`, `robots.txt`.
*   **Tiers & Lengths:** 
    *   **Standard Drop:** Requires `>= 12` characters.
    *   **Deep Drop:** Requires `>= 3` characters.
    *   *Constraint Note:* Length validation must occur **after** the normalization pipeline. This means original spaces (which become hyphens) *do* count towards the total length requirement. (e.g., "my secret file" becomes "my-secret-file" which is 14 characters and passes).

---

## 7. API Specification (Hono Worker)
*All API routes live under `/api`. The `:id` parameter is ALWAYS the `SHA-256` hash of the normalized Drop Name, never the plaintext name.*

### `GET /api/drops/:id`
*   **Logic:** Fetch from D1. If `expiresAt < NOW()`, trigger async deletion of D1 row (and R2 object if applicable), return `404`. If `r2Key` exists, fetch payload from R2. Otherwise, use D1 `data`.
*   **Response (200):** `{ id, tier, visibility, payload, salt, iv, encryptionAlgo, encryptionParams, expiresAt }`

### `POST /api/drops`
*   **Body:** `{ id, nameLength, tier, visibility, payload, salt, iv?, encryptionAlgo?, encryptionParams?, adminHash? }`
*   **Logic:** Validate `nameLength` against tier (e.g., `>= 12` if free). If payload `> 10KB` and `tier == 'free'`, return `402`. Validate `encryptionAlgo` against supported algorithms. Insert into D1. If `id` exists, return `409`.
*   **Response (201):** `{ success: true }`

### `PUT /api/drops/:id`
*   **Body:** `{ payload, adminPassword? }`
*   **Logic:** Fetch drop. If `404`, return `404`.
    *   **Private:** Overwrite `payload` in D1/R2. Reset `expiresAt`.
    *   **Public:** Compute `SHA-256(adminPassword + db.salt)`. If `!== db.adminHash`, return `401 Unauthorized`. If match, overwrite `payload`.
*   **Response (200):** `{ success: true }`

### SaaS Billing Endpoints (`apps/saas` only)
*   `POST /api/payments/checkout`: Accepts `{ id, nameLength }`. Creates Stripe session. Returns `{ checkoutUrl }`.
*   `POST /api/payments/webhook`: Stripe webhook handler. Sets `paymentStatus = 'paid'` and `tier = 'deep'` in D1.

---

## 8. Data Structures & Storage

### 8.1 Drop Payload (Client-Side Encapsulation)
The client wraps all inputs in JSON *before* encryption/upload.
```typescript
// Defined in packages/engine/src/types.ts
type DropContentPayload = 
  | { type: 'text'; content: string }
  | { type: 'file'; mime: string; name: string; data: string /* Base64 */ };
```

### 8.2 Drizzle Schema (Cloudflare D1)
```typescript
// Defined in packages/engine/src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const drops = sqliteTable('drops', {
  id: text('id').primaryKey(), // SHA-256(normalized_name)
  data: text('data'),          // Null if payload > 10KB
  r2Key: text('r2_key'),       // Null if payload <= 10KB
  visibility: text('visibility').default('private').notNull(),
  salt: text('salt').notNull(),
  iv: text('iv'),              // Null if public
  encryptionAlgo: text('encryption_algo').default('pbkdf2-aes256-gcm-v1').notNull(), // Algorithm identifier
  encryptionParams: text('encryption_params'), // Algorithm-specific params (JSON)
  adminHash: text('admin_hash'), // Null if private
  tier: text('tier').default('free').notNull(),
  paymentStatus: text('payment_status').default('none').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});
```

---

## 9. Cryptography Algorithms (Web Crypto API)
**Directory:** `packages/engine/src/crypto/` (Must use native Web Crypto API, no Node.js `crypto` module).

### 9.1 Algorithm Registry Pattern
The crypto module uses a **provider registry pattern** to support multiple encryption algorithms with forward compatibility:

```typescript
// Algorithm identifiers are versioned for future upgrades
type EncryptionAlgorithm =
  | 'pbkdf2-aes256-gcm-v1'      // Current: PBKDF2 (100k iter) + AES-256-GCM
  | 'xchacha20-poly1305-v1'      // Future: XChaCha20-Poly1305
  | 'argon2id-xchacha20-v1';     // Future: Argon2id KDF + XChaCha20-Poly1305

// Provider interface for algorithm implementations
interface CryptoProvider {
  readonly algorithm: EncryptionAlgorithm;
  generateSalt(): string;
  generateIV(): string;
  deriveKey(password: string, salt: string, params?: EncryptionParams): Promise<CryptoKey>;
  encrypt(data: string, key: CryptoKey, iv: string): Promise<string>;
  decrypt(ciphertext: string, key: CryptoKey, iv: string): Promise<string>;
}

// Usage via registry
const provider = cryptoRegistry.get('pbkdf2-aes256-gcm-v1');
```

### 9.2 Current Algorithms
*   **ID Hash:** `SHA-256(NormalizedName)`
*   **Admin Hash (Public):** `SHA-256(AdminPassword + Salt)`
*   **Key Derivation (Private):** `PBKDF2` (100,000 iterations, SHA-256, 16-byte random salt).
*   **Encryption (Private):** `AES-GCM` 256-bit (12-byte random IV).

### 9.3 Module Structure
```
packages/engine/src/crypto/
├── algorithms.ts       # Algorithm identifiers and param schemas (Zod)
├── provider.ts         # CryptoProvider interface and registry
├── providers/
│   └── pbkdf2-aes256-gcm.ts  # Current algorithm implementation
├── legacy.ts           # Backward-compatible exports
└── index.ts            # Barrel file
```

### 9.4 Backward Compatibility
Legacy functions (`generateSalt`, `deriveKey`, `encrypt`, `decrypt`) are maintained in `legacy.ts` for backward compatibility. They use the default algorithm (`pbkdf2-aes256-gcm-v1`).

---

## 10. Quality Assurance & Standards
1.  **Strict Code Coverage (100%):** The project enforces 100% coverage across Statements, Branches, Functions, and Lines using `vitest` (v8 provider).
    *   *Exceptions:* Allowed only via explicit `coverage.exclude` in `vitest.config.ts`.
2.  **Pre-Commit Hooks:** `husky` and `lint-staged` must run:
    *   `eslint --max-warnings=0`
    *   `prettier --check`
    *   `tsc --noEmit`
    *   `vitest run --passWithNoTests`
3.  **CI/CD:** GitHub Actions must execute the above checks. PRs failing 100% coverage must be rejected automatically.

---

## 11. Agent Implementation Roadmap
**Step 1: Workspace & QA Foundation**
*   Initialize Turborepo, `apps/core`, `apps/saas`, `packages/engine`, and `packages/ui`.
*   Install and configure Vitest, ESLint, Prettier, Husky. Establish 100% coverage thresholds.

**Step 2: Engine Logic (`packages/engine`)**
*   Implement `normalizeDropName` and Zod `validation.ts`.
*   Implement Web Crypto wrappers in `crypto.ts`.
*   Implement Drizzle `schema.ts`.
*   *Requirement:* Write unit tests achieving 100% coverage.

**Step 3: Core API & UI (`apps/core` & `packages/ui`)**
*   Build the Hono worker logic (`GET`, `POST`, `PUT` routes for `/api/drops`).
*   Build the Next.js Client Component to extract the `#` fragment on load.
*   Build `TerminalInput` component (auto-formats names, handles API checks).
*   Implement Client-side encryption/decryption flow.
*   *Requirement:* Integration tests mocking D1 database.

**Step 4: SaaS Features & E2E Verification (`apps/saas`)**
*   Implement Hybrid Storage routing (D1 vs R2 abstraction based on size).
*   Implement Stripe Checkout and Webhook routes in Hono API.
*   Write Playwright tests (Privacy interception, Integrity rejection, Vanity validation for names < 12 chars).