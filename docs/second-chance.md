# Second Chance — Launch Plan

Reviving dead-drop.xyz with new features before a coordinated launch push.

---

## Phase 1: Blog

**Goal:** Content infrastructure before anything else. Posts serve as launch material.

- Blog index page (`/blog`)
- Blog post pages (`/blog/[slug]`)
- Author posts as `.md` files in repo
- Basic styling matching existing site
- RSS feed (optional, good for SEO)

**First posts:**
- "Introducing dead-drop" — what it is, why it exists
- Announce deep drops when ready
- Announce whistle drops when ready

---

## Phase 2: Deep Drops

**Goal:** Drops that last longer than 7 days (up to ~5 years). Differentiates from competitors. Monetization hook.

**Open questions:**
- Exact TTL options (30 days? 1 year? 5 years? user picks?)
- Free tier vs paid — start free, add limits later?
- Quota: how many deep drops per user? Rate limiting?
- Payment integration (Stripe? one-time? subscription?) — or defer monetization entirely
- Storage cost on D1/R2 for long-lived data

**Implementation:**
- API: new TTL parameter on create, server enforces allowed values
- Website: UI for selecting drop duration
- Blog post announcing the feature

**Simplest MVP:** Extended TTL options (30d, 90d, 1y) free, no payment. Iterate on monetization later.

---

## Phase 3: Whistle Drop

**Goal:** Anonymous posting to someone else's drop. Unique feature, no competitor has this.

**Needs serious design before implementation. Open questions:**
- How does a whistleblower find/know the drop name?
- Does the drop owner opt-in to receiving whistle drops?
- Is there a separate endpoint or is it a flag on the existing create flow?
- Abuse mitigation: spam, CSAM, threats, illegal content
- Rate limiting: IP-based? CAPTCHA? Time-gated?
- Legal: DMCA/Safe Harbor, content liability, jurisdiction
- Should there be a report/flag mechanism?
- Does the whistleblower need any guarantees (can't be traced by drop owner)?
- Is content encrypted the same way, or does the drop owner hold the key?

**Implementation (after design):**
- API endpoint
- Website UI
- Blog post announcing the feature

---

## Phase 4: JS Library + CLI

**Goal:** Developer tooling. Makes dead-drop a platform, not just a website. Built once against stable API.

**JS Library (`@dead-drop/sdk`):**
- npm package
- Create, read, update, delete drops
- Client-side encryption handled internally
- TypeScript, tree-shakeable

**CLI (`dead-drop` or `dd`):**
- `dd create "secret message"`
- `dd get <name>`
- `dd update <name> "new message"`
- `dd delete <name>`
- Reads from stdin, writes to stdout
- Config file for API URL, defaults

**Implementation:**
- Shared crypto + API client code
- JS lib wraps it
- CLI wraps JS lib
- npm publish both

---

## Phase 5: Launch

**Goal:** Coordinated push across all platforms. One shot.

**Prerequisites done:**
- Blog with content
- Deep drops live
- JS lib + CLI on npm
- Whistle drop (if designed and built by then)

**Launch order:**
1. Show HN — "Show HN: dead-drop — open-source encrypted ephemeral sharing with CLI and SDK"
2. Reddit — r/SideProject, r/privacy, r/webdev, r/node
3. Dev.to — cross-post or link to blog
4. Privacy Guides Forum — post showcase
5. Product Hunt — launch day
6. X/Twitter — tag @CloudflareDev
7. Hashnode — tutorial post

**Assets needed:**
- Screenshots/GIF of CLI in action
- Blog post as the canonical "what is this" link
- Demo video (optional but powerful)

---

## Summary

| Phase | Effort | Depends on |
|-------|--------|-----------|
| Blog | Small | Nothing |
| Deep Drops | Medium | Nothing |
| Whistle Drop | Large | Serious design first |
| JS Lib + CLI | Medium | Stable API (after phases 2-3) |
| Launch | Small (but one shot) | Everything above |

Blog and deep drops can run in parallel. Whistle drop design runs alongside both. JS lib + CLI comes after API is stable. Launch is the finale.
