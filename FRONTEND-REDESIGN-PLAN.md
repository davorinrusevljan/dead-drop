# dead-drop.xyz Frontend Redesign Plan

## Current State Analysis

### What's Working (Keep)
- **Logo**: "dead-drop.xyz" with cyan glow - distinctive and memorable
- **Ascetic aesthetic**: Dark terminal theme, monospace fonts
- **Typography**: JetBrains Mono (code) + Space Grotesk (headers) - good pairing
- **Visual effects**: Subtle noise texture, corner glow, checkmark animation

### Problems Identified
1. **No clear information hierarchy** - Users don't understand what the site does on first glance
2. **All elements bunched together** - Input, suggestions, validation, info all visible at once
3. **No progressive disclosure** - Everything shown immediately, no focus guidance
4. **Weak name selection UX** - Suggestions are tiny, no "regenerate" button
5. **Abrupt state transitions** - Jumping between states feels disconnected
6. **Missing value proposition** - The "why" is buried in tiny text at bottom

---

## Design Direction

### Aesthetic Commitment
**"Secure Terminal"** - Maintain the ascetic, dark, cryptographic terminal feel but with:
- Clear visual hierarchy
- Generous spacing
- Progressive revelation of complexity
- Smooth, purposeful animations

### Key Principles
1. **Zero friction to start** - One prominent action on landing
2. **Progressive disclosure** - Show more UI only when needed
3. **Clear path** - Obvious next step at every stage
4. **Context preservation** - Don't lose user's work or context

### Branding
- **Tagline**: "dead simple secret sharing" - plays on the "dead drop" name
- **Tone**: Minimal, confident, secure - no marketing fluff
- **Voice**: Direct, like a secure terminal

---

## Implementation Plan

### Phase 1: Component Architecture Refactor

**Goal**: Split monolithic `page.tsx` into focused components

#### New Component Structure
```
apps/core/src/app/
├── page.tsx                    # Main page with state machine
├── components/
│   ├── Logo.tsx                # Logo with glow effect
│   ├── HeroSection.tsx         # Landing explanation
│   ├── DropNameInput.tsx       # Name input with suggestions
│   ├── CreateDropForm.tsx      # Full creation form
│   ├── DropViewer.tsx          # View decrypted content
│   ├── DropEditor.tsx          # Edit existing drop
│   ├── DeleteConfirm.tsx       # Delete confirmation modal
│   ├── SuccessState.tsx        # Post-creation success
│   └── UnlockForm.tsx          # Password unlock for private drops
└── lib/
    └── drop-client.ts          # (existing) API + crypto utilities
```

#### State Machine
```
┌─────────┐     ┌──────────┐     ┌─────────┐
│ landing │────▶│ checking │────▶│ notFound│
└─────────┘     └──────────┘     └─────────┘
     │               │                │
     │               │                ▼
     │               │          ┌─────────┐
     │               └─────────▶│  view   │
     │                          └─────────┘
     │                               │
     │                               ▼
     │                          ┌─────────┐
     │                          │success  │
     │                          └─────────┘
     │
     ▼
┌─────────┐
│ unlock  │──(decrypt)──▶│ view │
└─────────┘
```

---

### Phase 2: Landing Page Redesign

#### 2.1 Hero Section (Initial View)
When user first lands (no hash fragment):

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                    dead-drop.xyz                           │
│              [cyan glow on dark background]                │
│                                                            │
│              dead simple secret sharing                    │
│                                                            │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Encrypted messages that self-destruct after 7      │  │
│   │  days. Zero-knowledge means even we can't read      │  │
│   │  them. Just pick a name and share.                  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                            │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  🎲 cranberry-velocity-mirror-sunset           [→]  │  │
│   └─────────────────────────────────────────────────────┘  │
│                     [Generate Another]                     │
│                                                            │
│              [ CREATE DROP ]                               │
│                                                            │
│         ─── or enter existing drop name below ───          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Elements:**
1. **Logo** - Prominent at top, existing style
2. **Tagline** - "dead simple secret sharing" (play on "dead drop" name)
3. **Value proposition** - 2-3 lines explaining what it does (concise, action-focused)
4. **Name input** - Pre-filled with suggestion
5. **Generate button** - Dice icon, get new suggestion
6. **Create button** - Primary CTA
7. **Alternative** - Subtle text for accessing existing drops

#### 2.2 Progressive Disclosure
When user clicks/focuses on the name input:
- Input becomes more prominent (border highlights)
- Validation feedback appears below
- Character counter shows

When user starts typing:
- "Generate Another" button fades out
- Validation status updates in real-time

When name is valid and user proceeds:
- Smooth transition to create form
- Hero section collapses/animates away
- Create form elements animate in

#### 2.3 Name Suggestion UX
```
┌─────────────────────────────────────────────────────────────┐
│  Name your drop                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  cranberry-velocity-mirror-sunset               [→]  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  💡 Suggestion: Use this name or type your own              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  🎲 Generate Another Name                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ✓ 28 characters (minimum 12 required)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 3: Improved State Flows

#### 3.1 Landing → Create Transition
**Before**: Abrupt jump to form
**After**:
1. Name input slides up to top
2. Hero text fades out
3. Form fields animate in with stagger
4. Focus moves to password field

#### 3.2 Create Form Layout
```
┌────────────────────────────────────────────────────────────┐
│  cranberry-velocity-mirror-sunset                    [×]   │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 🔒 PRIVATE      │  │ 👁 PUBLIC       │                  │
│  │ (encrypted)     │  │ (readable)      │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  Password                                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ••••••••                                              │  │
│  └───────────────────────────────────────────────────────┘  │
│  Minimum 8 characters                                       │
│                                                             │
│  Confirm Password                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ••••••••                                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Your Secret                                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  Enter your message here...                            │  │
│  │                                                        │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│  0 / 10,000 characters                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    CREATE DROP                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

#### 3.3 Success State
```
┌────────────────────────────────────────────────────────────┐
│                                                             │
│                         ✓                                   │
│                  [checkmark animation]                      │
│                                                             │
│                   DROP CREATED                              │
│                                                             │
│  Your secret is ready to share:                             │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  dead-drop.xyz/#cranberry-velocity-mirror-sunset      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  📋 COPY LINK   │  │  Create Another │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
│  ⚠ Save your password - it cannot be recovered              │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

#### 3.4 View Drop (Existing)
```
┌────────────────────────────────────────────────────────────┐
│  🔒 cranberry-velocity-mirror-sunset                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  The decrypted content appears here...                 │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Expires: March 27, 2026                                    │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Copy    │ │  Edit    │ │  Delete  │ │ View Another │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

### Phase 4: Visual Polish

#### 4.1 Maintain Existing Good Elements
- Keep: Dark theme colors (`--bg-deep: #050508`, `--accent: #00ffc8`)
- Keep: Noise texture overlay
- Keep: JetBrains Mono + Space Grotesk fonts
- Keep: Glow effects on accent elements

#### 4.2 Improvements
1. **Better spacing**: Use consistent 8px grid
2. **Clearer hierarchy**: Larger headings, muted secondary text
3. **Smoother transitions**: 200-300ms ease-out for all animations
4. **Focus states**: Clear visual feedback on all interactive elements
5. **Empty states**: Helpful guidance when fields are empty

#### 4.3 Animation Guidelines
- **Page load**: Stagger fade-in (100ms delay between elements)
- **State transitions**: Slide + fade (250ms)
- **Button hover**: Scale 1.02 + glow (150ms)
- **Input focus**: Border color transition (200ms)
- **Success checkmark**: Draw animation (existing, keep)

---

### Phase 5: Mobile Responsiveness

#### Mobile Layout Considerations
1. Stack buttons vertically on narrow screens
2. Full-width inputs and buttons
3. Slightly larger touch targets (44px minimum)
4. Simplified hero on mobile (less text)
5. Bottom-sheet style modals for edit/delete confirmations

---

## File Changes Summary

### New Files to Create
1. `apps/core/src/app/components/Logo.tsx`
2. `apps/core/src/app/components/HeroSection.tsx`
3. `apps/core/src/app/components/DropNameInput.tsx`
4. `apps/core/src/app/components/CreateDropForm.tsx`
5. `apps/core/src/app/components/DropViewer.tsx`
6. `apps/core/src/app/components/DropEditor.tsx`
7. `apps/core/src/app/components/DeleteConfirm.tsx`
8. `apps/core/src/app/components/SuccessState.tsx`
9. `apps/core/src/app/components/UnlockForm.tsx`

### Files to Modify
1. `apps/core/src/app/page.tsx` - Refactor to use new components
2. `apps/core/src/app/globals.css` - Add new utility classes
3. `packages/ui/src/components/TerminalInput.tsx` - May need updates

### Files to Remove
- None (backward compatible)

---

## Implementation Order

1. **Create component files** (empty shells)
2. **Refactor page.tsx** to use component structure
3. **Implement HeroSection** with value proposition
4. **Implement DropNameInput** with suggestions
5. **Implement CreateDropForm** with validation
6. **Implement SuccessState** with animations
7. **Implement DropViewer** and related components
8. **Add transition animations** between states
9. **Test mobile responsiveness**
10. **Final polish and edge cases**

---

## Success Criteria

1. ✅ User understands what dead-drop does within 3 seconds
2. ✅ Clear visual path from landing to drop creation
3. ✅ Name suggestion with easy regeneration
4. ✅ Smooth transitions between all states
5. ✅ Zero confusion about next action at any state
6. ✅ Works well on mobile devices
7. ✅ Maintains existing ascetic aesthetic
