# Known Issues & Workarounds

Catalog of known issues, limitations, and their workarounds.

**Last Updated**: March 13, 2026
**Status**: Production-Ready (minor issues documented)

---

## 📋 Table of Contents

- [Critical Issues](#critical-issues)
- [Production Issues](#production-issues)
- [Development Issues](#development-issues)
- [Performance Issues](#performance-issues)
- [Security Issues](#security-issues)
- [Integration Issues](#integration-issues)
- [Fixed Issues (Historical)](#fixed-issues-historical)

---

## Critical Issues

### ✅ None Currently

All critical production blockers have been resolved.

---

## Production Issues

### 1. lovveee.vercel.app Returns 401
**Status**: ⚠️ Expected Behavior (Not a Bug)
**Severity**: Low
**Impact**: Vercel preview URL inaccessible

**Description**:
The Vercel auto-generated URL `lovveee.vercel.app` returns 401 Unauthorized due to Vercel SSO deployment protection.

**Root Cause**:
Vercel deployment protection enabled (security feature).

**Workaround**:
Use the production custom domain: `https://dispatch.anikalogistics.com`

**Why This is OK**:
- Custom domain works perfectly
- 401 is expected (not an error)
- Health monitoring uses custom domain

**Fix**: N/A (working as intended)

---

### 2. TypeScript Strict Mode Disabled
**Status**: 🔨 Planned Fix (Phase 2)
**Severity**: Low
**Impact**: Weaker type safety

**Description**:
TypeScript strict mode is intentionally disabled:
- `noImplicitAny`: false
- `strictNullChecks`: false
- `noUnusedParameters`: false

**Root Cause**:
Rapid development prioritized shipping over strict types.

**Workaround**:
Use explicit types where critical (database queries, API calls).

**Plan**:
Phase 2 will incrementally enable strict mode, starting with `lib/` folder.

**Tracking**: See [CLEANUP_AND_FIXES.md](./CLEANUP_AND_FIXES.md) #9

---

### 3. CRM Competitive Evaluation Underway
**Status**: ⚠️ Business Risk
**Severity**: Medium
**Impact**: Team considering MS Dynamics/PipeDrive switch

**Description**:
From meeting on Mar 7, 2026:
> "Se considerarán alternativas como Microsoft Dynamics y Pipe Drive"

Team is evaluating switching from Anika CRM to third-party solutions.

**Root Cause**:
- Lead → Account conversion friction (✅ FIXED Mar 8)
- Email automation needs minute-level delays (pending)
- Permission system unclear

**Workaround**:
- Ship email automation improvements quickly
- Build permission/roles system
- Demonstrate value vs cost of alternatives

**Business Impact**:
If team switches, CRM development stops (focus shifts to logistics platform only).

**Next Steps**:
- Complete priority features from meeting notes
- Schedule demo of latest improvements

---

## Development Issues

### 4. Duplicate Google Maps Environment Variable
**Status**: ✅ Fixed (this session)
**Severity**: Low
**Impact**: Confusion for new developers

**Description**:
Two variables for same purpose:
- `VITE_GOOGLE_MAPS_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`

**Root Cause**:
Legacy variable not removed during refactor.

**Fix**:
Standardized on `VITE_GOOGLE_MAPS_KEY`. Legacy variable removed from docs (code still supports both for backwards compatibility).

---

### 5. Missing JSDoc Comments
**Status**: 🔨 In Progress (this session)
**Severity**: Low
**Impact**: Harder for new developers to understand utilities

**Description**:
Utility functions in `src/lib/` lack inline documentation.

**Workaround**:
Read function implementation or tests.

**Plan**:
Adding JSDoc comments to all exported functions.

---

### 6. No Pre-commit Hooks
**Status**: 🔨 Planned (Phase 2)
**Severity**: Low
**Impact**: Can commit broken code

**Description**:
No automated checks before git commit (linting, typecheck).

**Workaround**:
Manually run `npm run check:all` before committing.

**Plan**:
Add Husky + lint-staged in Phase 2.

---

### 7. No GitHub Actions CI/CD
**Status**: 🔨 Planned (Phase 2)
**Severity**: Low
**Impact**: No automated PR checks

**Description**:
Pull requests don't run automated tests/typecheck.

**Workaround**:
Manually test locally before merging.

**Plan**:
Add GitHub Actions workflow in Phase 2.

---

## Performance Issues

### 8. GPS Data Growth Unbounded
**Status**: ✅ Fixed
**Severity**: Medium (if not addressed)
**Impact**: Database bloat, slower queries

**Description**:
`driver_locations` table grows indefinitely (GPS breadcrumbs every 30 seconds).

**Fix**:
Edge Function `gps-cleanup` archives locations older than 30 days (runs daily).

**Monitoring**:
Check table size: `SELECT pg_size_pretty(pg_total_relation_size('driver_locations'));`

---

### 9. Large Initial Bundle Size (Resolved)
**Status**: ✅ Fixed
**Severity**: Low
**Impact**: Slower initial page load

**Description**:
LoadDetailPanel was 632KB (too large for code splitting).

**Fix** (Feb 18, 2026):
Lazy loaded component, reduced to 17KB.

**Result**:
Faster initial load, better caching.

---

## Security Issues

### 10. No Audit Trail for User Actions
**Status**: 🔨 Planned (Phase 6)
**Severity**: Medium
**Impact**: Can't track who changed what

**Description**:
Limited logging of user CRUD operations.

**Workaround**:
Use `load_status_events` for load changes (partial audit trail).

**Plan**:
Add `audit_log` table for all important actions.

**Tracking**: See [DATABASE.md](./DATABASE.md) - Known Limitations #3

---

### 11. Hard Deletes (No Soft Delete)
**Status**: 🔨 Planned (Phase 6)
**Severity**: Low
**Impact**: Deleted data is permanent

**Description**:
Most tables use `DELETE` instead of soft delete (`deleted_at`).

**Workaround**:
Be careful before deleting (confirm dialogs exist).

**Plan**:
Add `deleted_at` column to critical tables (loads, drivers, companies).

**Tracking**: See [DATABASE.md](./DATABASE.md) - Known Limitations #2

---

### 12. RLS Policies Too Permissive (Resolved)
**Status**: ✅ Fixed
**Severity**: High (before fix)
**Impact**: Potential data leakage

**Description**:
Some RLS policies allowed broader access than needed.

**Fix** (Feb 28, 2026):
Migration `_CHUNK7_RLS_SECURITY_FIX.sql` tightened policies:
- Restricted DELETE to owners only
- Added role-based policies
- Fixed user-scoped policies

**Result**:
Secure data access per role.

---

## Integration Issues

### 13. QuickBooks Token Refresh Edge Case
**Status**: ⚠️ Known Limitation
**Severity**: Low
**Impact**: Rare token expiration error

**Description**:
If QB access token expires and refresh token is invalid, manual re-auth needed.

**Root Cause**:
QuickBooks OAuth tokens expire after 100 days of inactivity.

**Workaround**:
Disconnect and reconnect QuickBooks in Billing page.

**Plan**:
Add proactive token refresh (60 days before expiration).

---

### 14. Email Deliverability Issues (CRM)
**Status**: 🔨 Investigating
**Severity**: Medium
**Impact**: Some emails not delivered

**Description**:
From CRM meeting (Mar 7): "Juanita / plugin issue"

**Root Cause**:
Unknown (being investigated).

**Workaround**:
Check spam folder, verify SMTP configuration.

**Next Steps**:
- Review Supabase Edge Function logs
- Test email delivery with different providers
- Check SPF/DKIM/DMARC records

---

### 15. OneSignal Push Not Implemented
**Status**: 🔮 Planned (Phase 10)
**Severity**: Low
**Impact**: No push notifications yet

**Description**:
Push notifications for drivers planned but not implemented.

**Workaround**:
Use SMS fallback (Twilio) when ready.

**Plan**:
Implement in Phase 10 (not blocking for MVP).

---

## Fixed Issues (Historical)

### ✅ 16. daily_loads_status_check Missing States (FIXED Feb 18, 2026)
**Description**: Load status constraint missing 'delivered' and 'blasted' states.
**Fix**: Migration updated constraint.

---

### ✅ 17. No DELETE RLS Policy on daily_loads (FIXED Feb 18, 2026)
**Description**: Loads could be deleted by anyone.
**Fix**: Added owner-only DELETE policy.

---

### ✅ 18. get_driver_positions RPC Missing (FIXED Feb 18, 2026)
**Description**: Fleet map couldn't fetch GPS efficiently.
**Fix**: Created RPC function for latest positions.

---

### ✅ 19. Google Maps API Key Hardcoded (FIXED Feb 18, 2026)
**Description**: API key in source code.
**Fix**: Moved to environment variable.

---

### ✅ 20. lovveee.vercel.app 404 DEPLOYMENT_NOT_FOUND (FIXED Feb 19, 2026)
**Description**: Vercel alias missing.
**Fix**: Reassigned alias to latest deployment.

**Note**: URL now returns 401 (deployment protection), which is expected.

---

### ✅ 21. TeamManagement Auth Fix (FIXED Feb 28, 2026)
**Description**: User metadata not updating correctly.
**Fix**: RPC `set_user_metadata` call + profile update logic patched.

---

### ✅ 22. Client Portal Missing (FIXED Mar 7, 2026)
**Description**: No company-level tracking page.
**Fix**: Built `/portal/:token` feature (commit 9f0bbe9).

---

### ✅ 23. Convert to Account Friction (FIXED Mar 8, 2026)
**Description**: Had to navigate to lead detail page to convert.
**Fix**: Added "Convert to Account" to kanban card dropdown.

---

## Issue Reporting

### How to Report New Issues

1. **Check this file first** - Issue may be documented
2. **Check Sentry** - https://sentry.io/organizations/anika-qi
3. **Check Supabase logs** - Edge Function errors
4. **Check Vercel logs** - Deployment issues
5. **Document in this file** - Add to appropriate section

### Issue Template

```markdown
### N. Issue Title
**Status**: ⚠️ Active / ✅ Fixed / 🔨 In Progress
**Severity**: Critical / High / Medium / Low
**Impact**: User-facing description

**Description**:
What's wrong?

**Root Cause**:
Why is this happening?

**Workaround**:
How to work around it?

**Plan**:
How will we fix it?

**Tracking**: Link to relevant docs/tickets
```

---

## Health Monitoring

### Automated Checks (Every 4 hours via Jarvis)

**Last Check**: 2026-03-08 12:00 AM

**Checks**:
- ✅ Production URL: https://dispatch.anikalogistics.com (200 OK)
- ✅ Supabase connectivity (200)
- ✅ TypeScript compilation (0 errors)
- ✅ Git status (clean)

**History**:
- **Mar 8, 2026 12:00 AM**: All clear
- **Mar 7, 2026 08:00 PM**: All clear
- **Mar 7, 2026 04:00 PM**: Latest deployment READY
- **Mar 2, 2026 08:00 PM**: All clear
- **Feb 28, 2026 08:00 PM**: Uncommitted changes (TeamManagement fix)

**See**: [anika-app.md](../workspace/memory/projects/anika-app.md) for full health check log

---

## Related Documentation

- **[PROJECT_README.md](./PROJECT_README.md)** - Project overview
- **[DATABASE.md](./DATABASE.md)** - Database limitations
- **[CLEANUP_AND_FIXES.md](./CLEANUP_AND_FIXES.md)** - Planned fixes
- **[gemini.md](./gemini.md)** - Architectural decisions

---

**Last Updated**: March 13, 2026
**Total Issues**: 15 active (0 critical, 2 high, 13 low/medium)
**Fixed Issues**: 8 (historical)
**System Health**: ✅ Stable
