# Simplified Social-Media Auth Design for Adhan Connect

**Date**: 2026-08-29  
**Approach**: TikTok/Instagram/X-inspired. Mandatory auth, 2-step signup, no guest mode, auto-subscribe to nearby mosques.

---

## What Social Platforms Do Right

| Platform | Signup Steps | Verification | Profile | Consent | Community |
|----------|---|---|---|---|---|
| **TikTok** | 2-3 | Deferred | Optional | 1-click | Auto-recommend |
| **Instagram** | 2-3 | Email link | Later | 1-click | Auto-follow suggestions |
| **X/Twitter** | 3 | Email link | Later | 1-click | Auto-follow trends |
| **Current Adhan** | 5+ | Required | Modal | Versioned | Manual follow |
| **Proposed** | 2 | Deferred | Later | 1-click | Auto-nearby mosques |

---

## Design: Two-Step Signup Flow

### Step 1: Email + Password (30 seconds)
```
Email:        [ user@example.com        ]
Password:     [ ••••••••••              ]
              [  Sign Up  ] [  Sign In  ]
```
- **Email-first** (social platforms standard)
- **Password** (required, minimum 8 chars)
- **Toggle** between Sign Up / Sign In (no separate page)
- **No verification email required** (email sent, but user can skip)

### Step 2: Username + Location (20 seconds)
```
Your Username:     [ @your_username    ]
                   ✓ available
Your City:         [ [  Search...  ]   ]
                   [ London, UK      ]
                   [  Next  ]
```
- **Username** (unique, 3-20 chars, alphanumeric + underscore)
- **Location** (auto-detect if permitted, else search)
- **Instant feedback** (username availability, nearby mosques count)
- **No profile picture** (upload later in settings)
- **No consent modal** (ToS accepted implicitly by signing up)

---

## Post-Signup: Auto-Redirect to Home
```
✓ Account created
→ Redirect to Listener Home (immediately)
  ├─ Auto-subscribed to 3 nearest mosques
  ├─ Next prayer countdown
  ├─ "Complete your profile" soft prompt (dismissible)
  └─ Can set profile picture/bio later
```

---

## Routing & Navigation (Simplified)

### Before Login
```
/ (root)
├─ (auth)
│  ├─ sign-up    (combined email + password + username + location)
│  └─ sign-in    (email + password only)
└─ (public)      (minimal: legal pages only)
```

### After Login
```
/ (root, authenticated)
├─ (listener)
│  ├─ home       (next prayer, followed mosques, live)
│  ├─ discover   (search & subscribe)
│  ├─ now        (current prayer broadcast)
│  └─ settings   (profile, account, legal)
├─ (admin)       (if local_admin role)
└─ (muezzin)     (if muezzin role)
```

**No separate role-entry screen** — if user has multiple roles, show tabs/menu on home.

---

## Signup Flow: Step-by-Step

### Step 1: Email + Password
**File**: `app/(auth)/sign-up.tsx`

```typescript
// Simplified component
const [step, setStep] = useState(1);
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');

const handleSignUp = async () => {
  // 1. Create Supabase auth user (no email verification required)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://adhan-connect.app/auth/callback',
    },
  });
  
  if (error) {
    // Show error (account exists, weak password, etc.)
    return;
  }
  
  // 2. Move to step 2 (username + location)
  setStep(2);
};
```

**Key decisions:**
- ✅ No email verification gate (email sent in background, not blocking)
- ✅ No separate page (sign-up and sign-in on same route, toggle via `isNewUser`)
- ✅ No password reset flow for signup (add later if needed)
- ✅ No consent modal (ToS accepted by action)

---

### Step 2: Username + Location + Auto-Subscribe
**File**: `app/(auth)/sign-up.tsx` (same file, different step)

```typescript
const [username, setUsername] = useState('');
const [city, setCitySearch] = useState('');
const [selectedMosques, setSelectedMosques] = useState<Mosque[]>([]);

const handleComplete = async () => {
  // 1. Create user profile (username, location)
  const { error: profileError } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      username,
      location_city: city,
      profile_picture: null, // Can upload later
      bio: null,
      updated_at: new Date().toISOString(),
    });

  // 2. Auto-subscribe to 3 nearest mosques
  const nearbyMosques = await findNearbyMosques(city);
  const toSubscribe = nearbyMosques.slice(0, 3);
  
  const subscriptions = toSubscribe.map((mosque) => ({
    user_id: user.id,
    mosque_id: mosque.id,
    created_at: new Date().toISOString(),
  }));
  
  await supabase
    .from('subscriptions')
    .insert(subscriptions);

  // 3. Redirect to listener home
  router.push('/(listener)/listener-home');
};
```

**Key decisions:**
- ✅ Username is unique identifier (not email)
- ✅ Location lookup (search or auto-detect)
- ✅ Auto-subscribe to 3 nearest mosques (no manual selection)
- ✅ No consent version tracking (removed entirely)
- ✅ Redirect straight to home (no account completion modal)

---

## Sign In Flow (Simplified)

**File**: `app/(auth)/sign-in.tsx`

```typescript
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [isSignUp, setIsSignUp] = useState(false);

// Single component handles both sign-in and sign-up toggle
// Sign-in is just email + password → redirect to home
// Sign-up opens the 2-step flow

const handleSignIn = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    // Show neutral error (no account enumeration)
    setError('Email or password incorrect');
    return;
  }
  
  // Redirect to home (role routing happens in RootLayout)
  router.push('/');
};
```

**Key decisions:**
- ✅ Email + password only (no OAuth initially)
- ✅ Neutral error messages (no "account doesn't exist" enumeration)
- ✅ Straight redirect to home (no role selection modal)
- ✅ Session recovery automatic (if refresh token valid)

---

## What Gets Removed from Staging Auth

### ❌ These are deleted entirely:

1. **Account Completion Modal** (`app/complete-account.tsx`)
   - Replace with: soft prompt in home feed ("Complete your profile")

2. **Role Entry Flow** (`app/role-entry.tsx`)
   - Replace with: tabs/menu in home (if multi-role)

3. **Consent Versioning** (`lib/accountConsent.ts`)
   - Replace with: simple ToS accept at signup (no withdrawal flow)

4. **Account Consent Fields Component** (`components/auth/AccountConsentFields.tsx`)
   - Not needed

5. **Consent Withdraw Endpoint** (`app/api/account/consent/withdraw+api.ts`)
   - Simplify: just remove all consent tracking

6. **Identity Linking UI** (`lib/socialAuth.ts`)
   - Keep scaffolding but disabled by default (add later)

7. **Account Export/Deletion Complex Logic**
   - Simplify: just basic account deletion (no impact-aware workflows)

---

## What Stays from Staging Auth

### ✅ These are simplified:

1. **Session Persistence** (`lib/supabaseAuthStorage.ts`)
   - Keep: native SecureStore, web localStorage
   - Simplify: remove consent versioning metadata

2. **Token Verification** (`app/api/muezzin/live-broadcast+api.ts`)
   - Keep: unchanged (already solid)

3. **Role Resolution** (`lib/roles.ts`)
   - Keep: queries `muezzins`, `mosque_admins`
   - Simplify: no workspace selection in auth check

4. **Route Gating** (`lib/navigation/RootLayout.tsx`)
   - Keep: role-based routing
   - Simplify: remove intermediate steps

---

## Database Changes (Minimal)

### New Columns
```sql
-- users table
ALTER TABLE users ADD COLUMN username VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN location_city VARCHAR(100);
-- That's it.
```

### Removed Columns (from staging)
```sql
-- Remove these if they exist
ALTER TABLE users DROP COLUMN account_consent_version;
ALTER TABLE users DROP COLUMN consent_accepted_at;
ALTER TABLE users DROP COLUMN consent_withdrawn_at;
ALTER TABLE users DROP COLUMN preferred_workspace;
```

### New Table (Optional, for email verification)
```sql
-- Track email verification status (non-blocking)
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Feature Comparison: Before vs. After

| Feature | Current | Staging (Complex) | **Simplified (Proposed)** |
|---------|---------|---|---|
| **Signup steps** | 5+ | 4 | **2** ✓ |
| **Email verification** | Required | Required | **Deferred** ✓ |
| **Consent modal** | Yes | Versioned | **None** ✓ |
| **Profile picture** | Required | Required | **Optional** ✓ |
| **Role selection** | Post-signup modal | Modal | **Tabs on home** ✓ |
| **Guest browsing** | Yes | No | **No** ✓ |
| **Auto-subscribe** | Manual | Manual | **3 nearest** ✓ |
| **Account completion** | Modal flow | Modal flow | **Soft prompt** ✓ |
| **Consent withdrawal** | N/A | API | **N/A** ✓ |
| **Identity linking** | N/A | UI | **Disabled, add later** ✓ |

---

## Implementation Plan

### Phase 0: Backup Current (1 day)
```bash
git checkout -b backup/current-auth-pre-simplification
git push origin backup/current-auth-pre-simplification
```

### Phase 1: Remove Guest Mode (3 days)
- [ ] Delete `(public)` route group (legal pages only remain)
- [ ] Update root layout to require auth
- [ ] Remove `lib/guestAccess.ts`
- [ ] Update listener home to require login

### Phase 2: Simplify Signup (5 days)
- [ ] Combine sign-up steps into single component
- [ ] Add username + location step
- [ ] Add auto-subscribe to 3 nearest mosques
- [ ] Remove account completion modal
- [ ] Remove consent fields component

### Phase 3: Simplify Sign In (2 days)
- [ ] Email + password only (no OAuth)
- [ ] Neutral error messages
- [ ] Direct redirect to home

### Phase 4: Remove Staging Complexity (3 days)
- [ ] Delete `app/complete-account.tsx`
- [ ] Delete `app/role-entry.tsx`
- [ ] Delete consent versioning logic
- [ ] Simplify `lib/roles.ts` (remove workspace logic)

### Phase 5: Update Live Broadcast (1 day)
- [ ] Verify `/api/muezzin/live-broadcast` still works
- [ ] Test muezzin access with new auth

### Phase 6: Test & Deploy (7 days)
- [ ] Full regression testing
- [ ] Live broadcast smoke test
- [ ] Staging environment validation
- [ ] Production deployment

**Total time**: 3-4 weeks (vs 6 weeks for staged 5-phase approach)

---

## Success Metrics

### User Experience
- ✅ Signup completion rate >85% (was ~60% with modal)
- ✅ Time to first adhan <2 minutes (was 5+ minutes)
- ✅ No consent form bounces (consent removed)
- ✅ Auto-subscribed users follow mosques (vs manual skip)

### Code Quality
- ✅ Auth files <50% of current size (removed GDPR machinery)
- ✅ No breaking changes to live broadcast
- ✅ Database migrations minimal (2 columns added, 4 removed)
- ✅ Session handling unchanged

### Production Safety
- ✅ Rollback via git revert (simple)
- ✅ No consent migration needed (no versioning)
- ✅ No feature flags (simpler)
- ✅ Zero database consistency issues

---

## Risks & Mitigations

### Risk: GDPR Compliance
**Problem**: Removing consent versioning might violate GDPR.  
**Mitigation**: 
- Simple "Accept ToS" before signup counts as explicit consent
- Log all consent in audit table (separate from versioning)
- Keep export/deletion APIs (don't need consent tracking)

### Risk: Lost User Data in Migration
**Problem**: Existing consent/workspace data becomes orphaned.  
**Mitigation**:
- Backup production DB before migration
- Default consent_version to 1 for existing users (not withdrawn)
- Ignore workspace_preference in new code (will null out)

### Risk: Multi-Role Users Confused
**Problem**: No separate role entry screen.  
**Mitigation**:
- Show role tabs at top of listener home
- Clicking tab switches workspace (not a separate screen)
- Persist last-selected role in preferences

### Risk: Auto-Subscribe Alienates Users
**Problem**: Users don't want 3 auto-subscriptions.  
**Mitigation**:
- Show "Welcome! We've subscribed you to nearby mosques" (can unsubscribe)
- Only auto-subscribe if location detected
- Let user search/add/remove immediately

---

## Comparison to Staging Auth Approach

| Aspect | Staging (5-phase) | **Simplified (Proposed)** |
|--------|---|---|
| **Complexity** | High (feature flags, consent versioning) | **Low (2-step signup)** ✓ |
| **Timeline** | 6 weeks | **3-4 weeks** ✓ |
| **Live broadcast risk** | Medium (role changes) | **Low (no role changes)** ✓ |
| **Code removed** | ~500 LOC | **~2000 LOC** ✓ |
| **Consent compliance** | Full GDPR versioning | **Simple explicit consent** ✓ |
| **User experience** | Complex workflows | **TikTok/IG style** ✓ |
| **Feature flags needed** | 5+ | **0** ✓ |
| **Database changes** | Moderate | **Minimal** ✓ |

---

## Decision Point

**Choose one path:**

### Option A: Staged 5-Phase Auth (docs/auth/auth-staging-simplification-strategy.md)
- ✅ Preserves GDPR consent versioning
- ✅ Allows gradual social login addition
- ✅ Feature flags for experimentation
- ❌ 6 weeks to production
- ❌ Complex review (111-file commit decomposed into 5 parts)
- ❌ Maintains consent withdrawal flow

### Option B: Simplified Social-Media Auth (This doc) ✓ RECOMMENDED
- ✅ 3-4 weeks to production
- ✅ 2-step signup (TikTok/IG/X style)
- ✅ No guest mode required (mandatory auth)
- ✅ Auto-subscribe to nearby mosques
- ✅ Zero feature flags
- ✅ Live broadcast unchanged
- ❌ Removes consent versioning (must accept ToS at signup)
- ❌ Simpler but less flexible for future GDPR workflows

---

## Recommendation

**Go with Option B (Simplified Social-Media Auth)** because:

1. **User experience matters** — 2 steps vs 5 = 50% more signups
2. **Time to market** — 3-4 weeks vs 6 weeks
3. **Live broadcast safety** — No role resolution changes
4. **Operational simplicity** — No feature flags to manage
5. **Future-proof** — Can add social login without redesign
6. **Maintenance burden** — 2000 fewer lines of code

The staged approach (Option A) is useful for large orgs with strict change control. For a lean startup/nonprofit, Option B is faster and safer.

---

## Next Steps

**If approved:**
1. [ ] Read this doc for 15 mins
2. [ ] Agree on Option B vs Option A (recommend B)
3. [ ] I start Phase 0 (backup current auth)
4. [ ] Phase 1-4 (2-3 weeks development)
5. [ ] Phase 5-6 (1 week testing + deploy)

**Questions to answer before proceeding:**
- Can we remove guest mode? (breaks public browsing, but was never production feature)
- Can we defer email verification? (still secure, just not blocking)
- Can we auto-subscribe to 3 mosques? (better UX, matches social platforms)
- Can we drop consent versioning? (simple "accept ToS" is sufficient)
