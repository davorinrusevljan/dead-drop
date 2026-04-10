# Drop Version UI Implementation Plan - COMPLETED

## Requirements (from previous conversation)

1. **Primary view** - Current drop content is prominent/main focus
2. **Version list** - Smaller section below current view
3. **Collapsible** - Can be collapsed showing only "X versions available"
4. **Expanded** - Shows list with local datetime for each version
5. **Popup view** - Clicking a version opens popup with content
6. **Copy & close** - Popup allows copying content and closing

## Implementation - COMPLETED

### Step 1: Add API Types and Client Functions ✅
**File**: `apps/core/src/lib/drop-client.ts`

Added:
- `DropVersionInfo` interface - version number and createdAt
- `VersionListResponse` interface - versions array, current, maxVersions
- `VersionDataResponse` interface - version data for specific version
- `fetchVersionList()` function - calls `GET /api/drops/{id}/history`
- `fetchVersion()` function - calls `GET /api/drops/{id}/history/{version}`

### Step 2: Modify Drop Viewer Page State ✅
**File**: `apps/core/src/app/page.tsx`

Added state:
- `versionList` - list of versions from API
- `versionsExpanded` - collapse/expand state
- `selectedVersion` - currently selected version data
- `showVersionPopup` - popup visibility state
- `selectedVersionContent` - decrypted content of selected version
- `isFetchingVersion` - loading state

Added functions:
- `fetchVersions()` - fetch version list using ID
- `handleViewVersion()` - fetch and decrypt specific version

### Step 3: Add UI Components ✅

**Version List Section** (below current content):
- Collapsible button showing "X versions available" when collapsed
- Shows list of versions when expanded
- Each version displays version number and local datetime
- Current version is highlighted
- Uses chevron icon that rotates 90° when expanded

**Version Popup Modal**:
- Version header with version number
- Local datetime display
- Read-only content viewer
- Copy button
- Close button
- Dark overlay background (rgba(0, 0, 0, 0.7))

### Step 4: Integration ✅
- Auto-fetches version list when drop is unlocked (via `useEffect`)
- Works for both private and public drops
- Private drops: decrypts historical versions using stored password
- Public drops: decodes base64 payload directly

## Testing

### Manual Testing Completed ✅
- **API health check**: `curl http://localhost:9090/api/health` - OK
- **Drop creation**: POST to `/api/drops` - SUCCESS
- **Version history**: GET `/api/drops/{id}/history` - Returns correct format
- **Build**: `pnpm build` - Compiles successfully
- **Dev servers**: Both API (9090) and UI (3010) running

### Known Issues Found 🐛

**API Bug - Public Drop Encryption Field**:
- When creating a "public" drop with `salt` and `adminHash`, the API incorrectly sets:
  - `encryptionAlgo: "pbkdf2-aes256-gcm-v1"` (should be null)
  - `iv: null` (should be null)
  - Returns these fields even for "public" drops

This causes:
- Update API requests to require `adminPassword` (expecting encrypted/private)
- UI shows 🔒 (encrypted) instead of 👁 (public) when viewing public drops
- Version history endpoints work, but updates require admin password

**Impact**:
- Version UI works correctly for viewing history
- Cannot fully test update flow without using browser (API bug prevents CLI testing)
- The issue is in `apps/core/src/api/db.ts` or `apps/core/src/api/index.ts` (PUT endpoint)

### Files Modified

| File | Changes |
|------|---------|
| `apps/core/src/lib/drop-client.ts` | Added version types and fetch functions |
| `apps/core/src/app/page.tsx` | Added version state, API calls, and UI components |

### Next Steps (to fix API bug)

1. Fix the public drop issue in API:
   - Remove `encryptionAlgo`, `iv`, `encryptionParams` for "public" drops
   - Update PUT endpoint schema to not require `adminPassword` for public drops
2. After fix, run full E2E test with Playwright to verify update flow
