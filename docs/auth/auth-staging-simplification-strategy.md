# Auth Staging Simplification Strategy

**Date**: 2026-08-29  
**Target**: Simplify commit d36818c (111-file auth/GDPR refactor) into production-safe, independently-reviewable changes without breaking live broadcast or production auth.

## Expert Principles Applied

### 1. **Separation of Concerns** (Software Architecture)
- **Session persistence** (storage layer) is independent from **access control** (authorization)
- **Consent workflows** (GDPR) are orthogonal to **token verification** (authentication)
- **Route gating** is separate from **role resolution**
- Changes to any one layer should not cascade to others

### 2. **Minimal Trusted Code Path** (Security)
- Live broadcast only depends on: auth token verification → role lookup → access check
- Everything else (consent, deletion, export, WebAuthn, etc.) is gated separately
- Do NOT change token verification unless absolutely necessary

### 3. **Staged Rollout** (Systems Design)
- Deploy critical pieces first (auth session security, role isolation)
- Gate non-blocking pieces behind feature flags (consent, identity-linking)
- Keep rollback capability at each stage

### 4. **Backward Compatibility** (Deployment Safety)
- Old code and new code must coexist briefly during transition
- Session format changes must be readable by both old and new code
- Old tokens must validate against new verification logic

---

## Risk Analysis: Staging Auth Work Impact

### Direct Dependencies: Live Broadcast
The endpoint `/api/muezzin/live-broadcast+api.ts` requires:
1. `requireMuezzinContext(request)` → verifies Bearer token exists
2. `ensureMuezzinMosqueAccess()` → checks: muezzin assignment, admin role, rota assignment
3. Permission checks that query: `muezzins`, `mosque_admins`, `staff_rota`, `users.role`

**What changes in staging auth that affects this?**
- ✅ Session persistence layer (native SecureStore, web localStorage) — **not used by live broadcast**
- ✅ Consent workflows (AccountConsentFields, withdraw routes) — **gated separately, non-blocking**
- ✅ Deletion/export APIs — **gated behind feature flags**
- ⚠️ Token verification method (Supabase `auth.getUser()` remains unchanged)
- ⚠️ Role resolution in `ensureMuezzinMosqueAccess()` — **RISK POINT**
- ⚠️ Route gating logic — **RISK POINT**

---

## Risk Points & Mitigation

### Risk 1: Role Resolution Changes
**What changed**: `lib/roles.ts` has 320-line rewrite including new "workspace" concept.  
**Why it matters**: Live broadcast queries `users.role` and `mosque_admins` to determine access.  
**Mitigation**:
- **Keep** direct table queries (`muezzins`, `mosque_admins`, `staff_rota`) unchanged
- **Defer** workspace selection logic to UI/navigation layers only
- **Test**: Role-based broadcast access still works with new logic

### Risk 2: Route Gating Changes
**What changed**: Root navigation heavily refactored with new role-entry flow.  
**Why it matters**: If guest access or route protection changes, API routes become exposed/blocked.  
**Mitigation**:
- **Keep** API route auth checks independent of navigation gating
- **Use** `/api/muezzin/live-broadcast` auth from Bearer token only, not from route context
- **Test**: Direct API calls work even if route tree changes

### Risk 3: Auth Session Handling
**What changed**: Session persistence moved from simple localStorage to chunked SecureStore (native) + locked localStorage (web).  
**Why it matters**: If session token format breaks, token verification fails.  
**Mitigation**:
- **Keep** Supabase token format unchanged (still a JWT)
- **Encapsulate** storage layer changes in `lib/supabaseAuthStorage.ts` only
- **Test**: `auth.getUser(token)` still works with new session format

---

## Recommended Decomposition: 5 Staged Changes

### Stage 1: Core Auth Hardening (Low Risk, High Value)
**Commits to extract**:
- Session persistence improvements (native SecureStore, web locked storage)
- Bearer token verification in API routes (already robust)
- Timeout/error handling in auth checks

**Files touched**: `lib/supabaseAuthStorage.ts`, `lib/auth.tsx` (session cleanup only)  
**Impact on live broadcast**: Zero — token verification unchanged  
**Time to production**: 1-2 weeks  
**Rollback**: Simple

### Stage 2: Role Resolution Isolation (Medium Risk)
**Commits to extract**:
- New `lib/server/accountAccess.ts` for role lookups (careful: mirrors existing role logic)
- Keep old role queries intact as fallback
- Workspace selection only in UI, not in auth checks

**Files touched**: `lib/roles.ts` (additive only), `lib/server/accountAccess.ts` (new)  
**Impact on live broadcast**: Medium — must test role lookups return same results  
**Time to production**: 2-3 weeks  
**Rollback**: Feature-flag the new logic, fall back to old `lib/roles.ts`

### Stage 3: Consent & Audit Trail (Blocked Until Stage 1+2)
**Commits to extract**:
- Account consent tracking (`accountConsent.ts`)
- Consent-gated route protection
- Audit logging for deletions (shadow-logged, not enforced)

**Files touched**: `lib/accountConsent.ts`, `app/api/account/consent/*`  
**Impact on live broadcast**: Zero — consent doesn't gate muezzin access  
**Gate**: Feature flag `ENABLE_ACCOUNT_CONSENT`  
**Time to production**: After Stage 2 + legal review

### Stage 4: Account Management APIs (Blocked Until Stage 3)
**Commits to extract**:
- Export API (`lib/server/accountExport.ts`)
- Deletion review API (`lib/api/account/deletion-impact+api.ts`)
- Deletion request scaffolding (hard-closed by default)

**Files touched**: `lib/server/accountExport.ts`, `lib/server/accountDeletion.ts`, `lib/server/accountRateLimit.ts`  
**Impact on live broadcast**: Zero  
**Gates**: `ENABLE_ACCOUNT_EXPORT`, `ENABLE_ACCOUNT_DELETION_REVIEW`, `ENABLE_ACCOUNT_DELETION`  
**Time to production**: After Stage 3

### Stage 5: Identity Linking & Social Auth (Blocked Until Stage 4)
**Commits to extract**:
- Apple/Google OAuth scaffolding (`lib/socialAuth.ts`)
- Manual identity linking UI
- Account linking APIs

**Files touched**: `lib/socialAuth.ts`, components, route changes  
**Impact on live broadcast**: Zero  
**Gate**: `EXPO_PUBLIC_APPLE_AUTH_ENABLED`, `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` (both false by default)  
**Time to production**: After Stage 4 + provider setup

---

## Implementation Approach: Top 0.001% Expert Practice

### Principle 1: Red/Green Deploy Pattern
1. Deploy stage N with feature flags disabled (**red**)
2. Test stage N in production without affecting users (**green**)
3. Enable feature flag for canary users (**ramp**)
4. Full rollout once monitoring shows zero regressions (**full**)

### Principle 2: Minimal Diff Review Strategy
- **Each stage is <500 LOC of actual logic changes** (rest is config/migration)
- **Each PR has exactly one risk point** (easier to review than 111-file monolith)
- **Test matrices are scoped** (test live broadcast for Stage 1, not consent flows)

### Principle 3: Backward-Compatible Tokens
- New session format reads old tokens without breaking
- Old code can verify new tokens (if token format unchanged)
- Fallback to old verification logic if new logic fails

### Principle 4: Explicit Gating
Every new feature behind **three layers** of gates:
1. Environment variable (e.g., `ENABLE_ACCOUNT_EXPORT`)
2. Database approval flag (prevents accidental rollout)
3. User-level opt-in (for gradual canary deployment)

### Principle 5: Audit Before Enablement
- Deploy all code in "shadow mode" first (logs, no enforcement)
- Monitor for 1-2 weeks before flipping enforcement gates
- Keep audit trail forever (for GDPR requests)

---

## Immediate Action: Extract Stage 1

### Files to Decompose
**From**: `lib/auth.tsx` (277 lines → 120 lines)  
**To**: Keep only core session verification, defer consent/workspace logic to `complete-account.tsx`

**From**: `app/(auth)/*` (1000+ line rewrites)  
**To**: Extract `sign-in.tsx` email-first flow (50 lines), defer consent/2FA (new code)

**From**: `lib/roles.ts` (320-line rewrite)  
**To**: Keep muezzin/admin lookups, move workspace selection to `role-entry.tsx`

### Test Matrix: Stage 1 Only
```
[ ] Muezzin can verify Bearer token (live broadcast)
[ ] Admin role queries still return correct results
[ ] Session persists across page reload
[ ] Old localStorage tokens still validate
[ ] New SecureStore tokens validate
[ ] Production auth.getUser() endpoint still works
```

### Acceptance Criteria for Production Readiness
- [ ] Zero change to live broadcast API response (before/after identical)
- [ ] Session timeout behavior unchanged
- [ ] Token refresh still works
- [ ] Logout clears all storage
- [ ] No breaking changes to `lib/roles.ts` exports
- [ ] Muezzin/admin/listener role routing unchanged

---

## Success Metrics

### Deployment Velocity
- Stage 1: 1 week (auth security hardening)
- Stages 2-3: 2 weeks (role isolation + consent)
- Stages 4-5: 3 weeks (account management + social)
- **Total**: 6 weeks vs 1 monolithic risky deployment

### Risk Reduction
- **Blast radius**: 111 files → 10-15 files per stage
- **Review time**: 2-4 hours per stage vs 8-12 hours for monolith
- **Test surface**: Live broadcast only (Stage 1) vs entire app (monolith)
- **Rollback cost**: 5 minutes per stage vs 1-2 hours for monolith

### Quality
- **Regression tests**: Each stage adds 5-10 new tests (vs 0 in monolith)
- **Code review**: ~80-100 LOC per review (focused) vs ~1000 LOC (diffuse)
- **Audit trail**: Every stage logged and monitored before next stage

---

## Next Steps

1. **Week 1**: Extract Stage 1 changes (session hardening) into new branch `feature/auth-stage-1`
2. **Week 1**: Run full test suite + live broadcast smoke test
3. **Week 2**: Code review & merge to `staging` branch
4. **Week 3**: Deploy to staging environment, monitor for 1 week
5. **Week 4**: Deploy to production with feature flag disabled
6. **Week 5**: Enable for canary users, monitor metrics
7. **Week 6**: Full rollout, then begin Stage 2

---

## Risks Deferred (Acceptable Until After Production)

- ❌ **Apple/Google OAuth**: No production need yet, keep flags off
- ❌ **Hard deletion**: Fail-closed behind database gate, non-blocking
- ❌ **Data export**: Non-critical, GDPR deadline negotiable
- ❌ **Identity linking**: Can be added later, no blocker
- ❌ **Webhook signing**: Future feature, not in scope

---

## Ownership & Approval

**This strategy requires**:
- [ ] Lead eng approval (one 30-min review of this doc)
- [ ] Product sign-off on phased rollout (6 weeks vs 2 weeks)
- [ ] Legal approval for consent audit trail (privacy-by-design)
- [ ] QA commitment to test matrix per stage
- [ ] On-call agreement to monitor each stage for 1 week

---

## References

- Staging auth commit: `d36818c`
- Live broadcast code: `app/api/muezzin/live-broadcast+api.ts`
- Release gates doc: `docs/auth/account-auth-release-gates.md`
- Related hardening commit: `9ce55ae` (password reset)
- Live stream hardening: `d96248b`
