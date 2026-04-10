## Bug: Public Drops Incorrectly Treated as Encrypted

### Summary

When creating a "public" drop via the API, the response incorrectly includes encryption-related fields (`encryptionAlgo` set to `"pbkdf2-aes256-gcm-v1"`, `iv` null`), causing the drop to be rendered with a 🔒 (encrypted) badge instead of a 👁 (public) badge. Additionally, attempting to update any drop fails because the PUT endpoint expects `adminPassword` for all drops, even for public ones.

### Steps to Reproduce

1. Create a public drop via POST /api/drops

2. View the drop in UI - it shows 🔒 (encrypted) badge

3. Attempt to update the drop via PUT /api/drops with `adminPassword` - returns 401 Unauthorized

### Expected Behavior

**Public drops should NOT have encryption-related fields in API response:**
- `encryptionAlgo`: should be `null` or omitted
- `encryptionParams`: should be `null` or omitted
- `r2Key`: should be `null` or omitted
- `iv`: should be `null` or omitted

**UI should show:**
- 👁 (public) badge for public drops (not 🔒 encrypted)

**PUT updates should work:**
- For public drops: allow updates with just `adminPassword` (no password required)
- For private drops: require `contentHash`, `r2Key`, `iv`, `encryptionAlgo`, `encryptionParams`

### Actual Behavior

1. Public drops created via API incorrectly include:
   ```json
   {
     "encryptionAlgo": "pbkdf2-aes256-gcm-v1",
     "encryptionParams": null,
     "iv": null,
     "visibility": "public"
   }
   ```

2. UI shows 🔒 (encrypted) badge for public drops

3. PUT endpoint rejects all updates (including private drops) because:
   - The `createDrop` function sets encryption fields for ALL drops
   - The PUT endpoint handler expects `adminPassword` for authentication even for public drops

### Root Cause

**File: `apps/core/src/api/db.ts`**

The `createDrop` function unconditionally sets encryption-related fields:

```typescript
encryptionAlgo: data.encryptionAlgo ?? 'pbkdf2-aes256-gcm-v1',
encryptionParams: data.encryptionParams ? JSON.stringify(data.encryptionParams) : null,
```

When `data.encryptionAlgo` is `undefined` (as for a public drop), the `??` operator incorrectly defaults to setting the encryption fields.

### Fix Required

**File: `apps/core/src/api/db.ts` - `createDrop` function**

Only set encryption-related fields when `drop.visibility === 'private'`:

```typescript
encryptionAlgo: data.visibility === 'private' ? data.encryptionAlgo ?? 'pbkdf2-aes256-gcm-v1' : null,
encryptionParams: data.visibility === 'private' ? (data.encryptionParams ? JSON.stringify(data.encryptionParams) : null) : null,
r2Key: data.visibility === 'private' ? data.r2Key : null,
iv: data.visibility === 'private' ? data.iv ?? null : null,
```

**File: `apps/core/src/api/index.ts` - PUT endpoint handler**

1. Do NOT require `adminPassword` for public drops:
   ```typescript
   if (drop.visibility !== 'private') {
     // Public drop being updated - allow with just adminPassword
     if (body.adminPassword) {
       // Check against current adminHash (optional security check)
       const providedHash = await sha256(body.adminPassword + drop.salt);
       if (providedHash !== drop.adminHash) {
         return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
       }
       newAdminHash = await computePublicAdminHash(
         body.adminPassword ?? '',
         drop.salt
       );
     }
   }
   ```

2. Use `dropData.contentHash` (current drop's hash) as verification hash for public drops:
   ```typescript
   if (drop.visibility !== 'private') {
     providedHash = dropData.contentHash; // Use current hash
   } else {
     // Encrypted drop - compute hash from password
     providedHash = await sha256((body.adminPassword ?? '') + drop.salt);
     newAdminHash = await computePublicAdminHash(
       body.newContentHash ?? body.contentHash ?? '',
       pepper
     );
   }
   // Then compare providedHash with drop.adminHash
   if (providedHash !== drop.adminHash) {
     return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
   }
   ```

3. For private drops, keep existing logic (send contentHash, r2Key, iv, encryptionAlgo, encryptionParams)

### UI Code Fix Required

**File: `apps/core/src/app/page.tsx` - `handleSaveEdit` function**

For public drop updates:
- Pass `dropData.contentHash` as `contentHash` for verification
- Pass `editPwd` value as `adminPassword`
- Do NOT send `newContentHash` or `newReqContentHash` (let API compute them)

### Environment

- **Framework**: Next.js 15.x (App Router)
- **API Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Language**: TypeScript

### Impact

1. **UI/UX**: Public drops appear to be password-protected (🔒) when they should be publicly viewable (👁)
2. **API**: PUT updates fail for all drops because of incorrect field handling
3. **Functionality**: Version UI works correctly for viewing history, but editing any drop fails due to this bug

---

### Additional Notes

- The root cause is that `createDrop` unconditionally sets encryption fields based on the request's `data.encryptionAlgo` value
- For a public drop creation request, `data.encryptionAlgo` is typically not provided, but the `??` operator defaults it to `'pbkdf2-aes256-gcm-v1'`
- This causes the database to store `encryptionAlgo: "pbkdf2-aes256-gcm-v1"` even for public drops
