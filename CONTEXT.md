# dead-drop

Ephemeral, privacy-focused data-sharing service. Content is dropped under a
name known only to the sender; anyone with the name can read it until it
expires. Runs on Cloudflare Workers/Pages with D1 storage.

## Language

**Drop**:
A single shared payload plus its version history, addressed by name.
_Avoid_: paste, note, secret, message

**Drop Name**:
The user-chosen phrase addressing a drop. Lowercase; spaces normalize to
hyphens; letters/digits/hyphens only. The drop **ID** is the SHA-256 of the
normalized name — the API never accepts raw names except at creation.
_Avoid_: URL slug, key

**Tier**:
Billing/capacity class of a drop. `free` (Standard) or `deep`.
_Avoid_: plan

**Standard Drop**:
The free tier: text only, max 10 KB, 7-day expiry, max 5 versions, name ≥ 12
chars (after hyphenation). The only tier currently implemented.
_Avoid_: basic drop

**Deep Drop**:
Future paid tier: files, max 4 MB, 90-day expiry, max 20 versions, name ≥ 3
chars (vanity names). Constants exist in code (`TIER_*` in `apps/core/src/api/db.ts`);
no upgrade path is implemented.
_Avoid_: pro drop, premium drop

**Visibility**:
Whether a drop's content is encrypted. `private` (API value) = zero-knowledge
encrypted (client-side, password never leaves the browser). `public` =
plaintext, readable by anyone, password gates edits only.
_Avoid_: protected (design-doc term, API says `private`) — and never say
"private drop" when you mean "public drop that needs a password to edit"

**Admin Password**:
Per-drop credential. For protected drops it derives the encryption key and
edit authorization; for public drops it authorizes edits/deletes only.
Stored only as salted+peppered hash, never retrievable.
_Avoid_: passphrase in API contexts

**Version History**:
Immutable sequence of a drop's contents. Updates append a version; reading
without a version param returns the latest.
_Avoid_: revisions

**Drop ID**:
SHA-256 hex digest of the normalized drop name. The canonical address in all
API paths.
_Avoid_: hash (ambiguous with content hashing)

**Whistle Drop**:
Unimplemented concept: anonymous third-party submission into someone else's
drop. See strategy repo before building.
_Avoid_: anonymous drop
