# Environment Variables Reference

Complete guide to all environment variables used across Anika Control OS platforms.

---

## 📋 Table of Contents

- [Quick Reference](#quick-reference)
- [Web Platform Variables](#web-platform-variables)
- [Mobile App Variables](#mobile-app-variables)
- [Edge Functions Variables](#edge-functions-variables)
- [Local Development Setup](#local-development-setup)
- [Production Deployment](#production-deployment)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

---

## Quick Reference

### Environment Files by Platform

| Platform | File Location | Purpose |
|----------|---------------|---------|
| **Web (Dev)** | `.env.local` | Local development overrides |
| **Web (Prod)** | Vercel Dashboard | Production secrets |
| **Web (Template)** | `.env.example` | Template for new developers |
| **Mobile** | `anika-driver-app/.env` | Expo app configuration |
| **Edge Functions** | `supabase/functions/.env` | Supabase Edge Function secrets |

### Required vs Optional

✅ **Required for core functionality**
⚠️ **Required for specific features**
🔮 **Planned for future features**

---

## Web Platform Variables

### Database & Authentication

#### `VITE_SUPABASE_URL`
- **Required**: ✅ Yes
- **Purpose**: Supabase project URL
- **Example**: `https://vdsknsypobnutnqcafre.supabase.co`
- **Where to get**: Supabase Project Settings → API → Project URL
- **Used in**: All database operations, authentication, realtime subscriptions
- **Critical**: App will not load without this

#### `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Required**: ✅ Yes
- **Purpose**: Supabase anon/public API key
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to get**: Supabase Project Settings → API → anon public key
- **Used in**: Client-side Supabase authentication
- **Security**: Safe to expose in browser (RLS protects data)
- **Critical**: Authentication will fail without this

---

### Maps & Routing

#### `VITE_GOOGLE_MAPS_KEY`
- **Required**: ✅ Yes
- **Purpose**: Google Maps JavaScript API key
- **Example**: `AIzaSyC1234567890abcdefghijklmnopqrs`
- **Where to get**: Google Cloud Console → APIs & Services → Credentials
- **Used in**:
  - Live fleet tracking map (`FleetTracker.tsx`)
  - Route optimization (`useRouteOptimizer.ts`)
  - Geocoding addresses
  - Distance/duration calculations
- **API Restrictions**:
  - Restrict to `dispatch.anikalogistics.com` in production
  - Enable APIs: Maps JavaScript API, Routes API, Geocoding API
- **Billing**: ~$200/month for production usage
- **Fallback**: Map components will show blank without this

#### `VITE_GOOGLE_MAPS_API_KEY`
- **Required**: ⚠️ Legacy alias
- **Purpose**: Duplicate of `VITE_GOOGLE_MAPS_KEY` (kept for backwards compatibility)
- **Note**: Remove in Phase 2 cleanup

---

### Error Tracking & Monitoring

#### `VITE_SENTRY_DSN`
- **Required**: ⚠️ Recommended for production
- **Purpose**: Sentry Data Source Name for error tracking
- **Example**: `https://abc123@o123456.ingest.us.sentry.io/7890123`
- **Where to get**: Sentry.io → Project Settings → Client Keys (DSN)
- **Used in**:
  - `App.tsx` - Global error boundary
  - `lib/sentry.ts` - Sentry initialization
  - Route-level error fallbacks
- **Impact**: Errors will not be reported to Sentry without this
- **Optional**: App functions without it, but no error monitoring

#### `SENTRY_AUTH_TOKEN`
- **Required**: ⚠️ Build-time only
- **Purpose**: Upload source maps to Sentry during build
- **Example**: `sntrys_abc123...`
- **Where to get**: Sentry.io → Settings → Auth Tokens → Create New Token
- **Permissions needed**: `project:write`, `org:read`
- **Used in**: `vite.config.ts` - `sentryVitePlugin`
- **Security**: **NEVER commit to git** - use `.env.local` or Vercel secrets
- **Impact**: Source maps won't upload (error stack traces less useful)

---

### QuickBooks Integration

#### `VITE_QB_CLIENT_ID`
- **Required**: ⚠️ For QuickBooks integration only
- **Purpose**: QuickBooks OAuth client identifier
- **Example**: `AB1234567890abcdefghijklmnop`
- **Where to get**: QuickBooks Developer Portal → My Apps → Keys & OAuth
- **Used in**:
  - `pages/QuickBooksCallback.tsx` - OAuth redirect handler
  - `lib/quickbooks.ts` - Token exchange
  - `pages/Billing.tsx` - Invoice sync
- **Security**: Safe to expose (public identifier)
- **Optional**: Only needed if using QuickBooks invoicing

#### `VITE_QB_REDIRECT_URI`
- **Required**: ⚠️ For QuickBooks OAuth
- **Purpose**: OAuth callback URL
- **Example**: `https://dispatch.anikalogistics.com/auth/quickbooks/callback`
- **Must match**: QuickBooks app configuration exactly
- **Dev value**: `http://localhost:8080/auth/quickbooks/callback`
- **Prod value**: `https://dispatch.anikalogistics.com/auth/quickbooks/callback`

#### `VITE_QB_ENVIRONMENT`
- **Required**: ⚠️ For QuickBooks
- **Purpose**: QuickBooks API environment
- **Values**: `sandbox` | `production`
- **Dev**: Use `sandbox`
- **Prod**: Use `production`
- **Note**: Sandbox and production use different OAuth credentials

#### `QB_CLIENT_SECRET`
- **Required**: ⚠️ For QuickBooks
- **Purpose**: QuickBooks OAuth client secret
- **Security**: **NEVER expose in browser** - **Edge Function only**
- **Where to set**: `supabase secrets set QB_CLIENT_SECRET=your_secret`
- **Used in**: `supabase/functions/qb-token-exchange/` Edge Function
- **Critical**: Exposing this compromises your QB integration

---

### Push Notifications (Future)

#### `VITE_ONESIGNAL_APP_ID`
- **Required**: 🔮 Planned (Phase 10)
- **Purpose**: OneSignal app identifier for push notifications
- **Example**: `12345678-1234-1234-1234-123456789012`
- **Where to get**: OneSignal.com → App Settings
- **Used in**: Future push notification system
- **Status**: Not yet implemented
- **Note**: Comment in `.env.example` says "icing on the cake"

#### `VITE_ONESIGNAL_API_KEY`
- **Required**: 🔮 Planned
- **Purpose**: OneSignal REST API key
- **Security**: Should be server-side only (Edge Function)
- **Status**: Not yet implemented

---

## Mobile App Variables

Location: `anika-driver-app/.env`

### Supabase Configuration

#### `EXPO_PUBLIC_SUPABASE_URL`
- **Required**: ✅ Yes
- **Purpose**: Same as web `VITE_SUPABASE_URL` but for Expo
- **Note**: Expo requires `EXPO_PUBLIC_` prefix for client-side access
- **Value**: Same as web platform Supabase URL

#### `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Required**: ✅ Yes
- **Purpose**: Same as web `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Note**: Expo prefix convention

### Maps (Mobile)

#### `EXPO_PUBLIC_GOOGLE_MAPS_KEY`
- **Required**: ✅ Yes
- **Purpose**: Google Maps for driver navigation
- **Note**: Same API key as web, but may want separate key for tracking
- **Used in**: Driver route display, turn-by-turn navigation

### Push Notifications (Mobile)

#### `EXPO_PUBLIC_ONESIGNAL_APP_ID`
- **Required**: 🔮 Planned
- **Purpose**: OneSignal for driver BLAST notifications
- **Critical for**: Real-time load assignments

---

## Edge Functions Variables

Location: `supabase/functions/.env` OR set via `supabase secrets set`

### Recommended Pattern: Use Supabase Secrets

```bash
# Set secrets (more secure than .env file)
supabase secrets set QB_CLIENT_SECRET=your_secret
supabase secrets set GOOGLE_MAPS_SERVER_KEY=your_key
supabase secrets set ONESIGNAL_REST_API_KEY=your_key
```

### Current Edge Functions Using Secrets

1. **qb-token-refresh**
   - `QB_CLIENT_ID`
   - `QB_CLIENT_SECRET`

2. **qb-token-exchange**
   - `QB_CLIENT_ID`
   - `QB_CLIENT_SECRET`

3. **qb-create-invoice**
   - `QB_CLIENT_ID` (optional, for token refresh)

4. **send-push-notification** (future)
   - `ONESIGNAL_REST_API_KEY`

5. **ai-chat** (future)
   - `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

---

## Local Development Setup

### Step-by-Step Setup

1. **Copy template**
   ```bash
   cp .env.example .env.local
   ```

2. **Get Supabase credentials**
   - Visit: https://vdsknsypobnutnqcafre.supabase.co
   - Go to Project Settings → API
   - Copy **Project URL** → `VITE_SUPABASE_URL`
   - Copy **anon public** key → `VITE_SUPABASE_PUBLISHABLE_KEY`

3. **Get Google Maps key**
   - Visit: https://console.cloud.google.com/apis/credentials
   - Create or use existing API key
   - Enable APIs:
     - Maps JavaScript API
     - Routes API
     - Geocoding API
     - Distance Matrix API
   - Copy key → `VITE_GOOGLE_MAPS_KEY`

4. **(Optional) Get Sentry DSN**
   - Visit: https://sentry.io/organizations/anika-qi/projects/
   - Copy DSN → `VITE_SENTRY_DSN`

5. **Start development**
   ```bash
   npm run dev
   ```

### Sample `.env.local` for Development

```bash
# Supabase
VITE_SUPABASE_URL=https://vdsknsypobnutnqcafre.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google Maps
VITE_GOOGLE_MAPS_KEY=AIzaSyC_your_development_key_here
VITE_GOOGLE_MAPS_API_KEY=AIzaSyC_your_development_key_here

# Sentry (optional for dev)
VITE_SENTRY_DSN=https://abc@o123.ingest.us.sentry.io/456
# SENTRY_AUTH_TOKEN=sntrys_... (not needed for dev)

# QuickBooks (use sandbox in dev)
VITE_QB_CLIENT_ID=your_sandbox_client_id
VITE_QB_REDIRECT_URI=http://localhost:8080/auth/quickbooks/callback
VITE_QB_ENVIRONMENT=sandbox

# OneSignal (not needed yet)
# VITE_ONESIGNAL_APP_ID=
# VITE_ONESIGNAL_API_KEY=
```

---

## Production Deployment

### Vercel Environment Variables

Set via Vercel Dashboard → Settings → Environment Variables

**Production values**:
```bash
VITE_SUPABASE_URL=https://vdsknsypobnutnqcafre.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ... (production anon key)
VITE_GOOGLE_MAPS_KEY=AIzaSyC... (production key with domain restrictions)
VITE_SENTRY_DSN=https://... (production Sentry project)
SENTRY_AUTH_TOKEN=sntrys_... (for source map uploads)
VITE_QB_CLIENT_ID=AB... (production QB app)
VITE_QB_REDIRECT_URI=https://dispatch.anikalogistics.com/auth/quickbooks/callback
VITE_QB_ENVIRONMENT=production
```

### Supabase Secrets (Edge Functions)

Set via Supabase CLI:

```bash
# QuickBooks
supabase secrets set QB_CLIENT_SECRET=your_production_secret

# Future integrations
supabase secrets set ONESIGNAL_REST_API_KEY=your_key
supabase secrets set OPENAI_API_KEY=your_key
```

### Expo Build Secrets (Mobile)

Set in `eas.json` or via EAS Secrets:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://...
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJ...
eas secret:create --name EXPO_PUBLIC_GOOGLE_MAPS_KEY --value AIza...
```

---

## Security Best Practices

### ✅ DO

1. **Use `.env.local` for local development** (gitignored)
2. **Set production secrets via platform dashboards** (Vercel, Supabase)
3. **Restrict Google Maps API keys** to specific domains/apps
4. **Rotate secrets** if exposed (especially QB_CLIENT_SECRET)
5. **Use different keys** for dev/staging/production
6. **Audit Sentry tokens** periodically
7. **Use Supabase RLS** as primary security layer (not API keys)

### ❌ DON'T

1. **Never commit `.env.local` or `.env.production`** to git
2. **Never expose `QB_CLIENT_SECRET`** in browser code
3. **Never share production `.env` files** via Slack/email
4. **Never hardcode secrets** in source code
5. **Never use production keys in development**
6. **Never commit `SENTRY_AUTH_TOKEN`** to repository

### Checking for Exposed Secrets

```bash
# Check if .env files are gitignored
git check-ignore .env.local .env.production

# Search for hardcoded secrets (should return nothing)
grep -r "VITE_SUPABASE_PUBLISHABLE_KEY" src/
grep -r "AIzaSy" src/

# Verify .env files not in git
git ls-files | grep "\.env"
```

---

## Troubleshooting

### "Cannot connect to Supabase"

**Cause**: Missing or incorrect `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`

**Solution**:
1. Check `.env.local` exists
2. Verify Supabase URL format: `https://[project-ref].supabase.co`
3. Restart dev server after changing .env

### "Google Maps not loading"

**Cause**: Missing `VITE_GOOGLE_MAPS_KEY` or API not enabled

**Solution**:
1. Check key exists in `.env.local`
2. Enable required APIs in Google Cloud Console:
   - Maps JavaScript API
   - Routes API
   - Geocoding API
3. Check browser console for specific Google Maps errors
4. Verify key restrictions (if any)

### "Sentry errors not appearing"

**Cause**: Missing `VITE_SENTRY_DSN` or wrong project

**Solution**:
1. Check DSN format: `https://[key]@[org].ingest.us.sentry.io/[project]`
2. Verify project exists in Sentry dashboard
3. Check Sentry project is `javascript-react` (not other SDK)
4. Errors may take 1-2 minutes to appear

### "QuickBooks OAuth fails"

**Cause**: Redirect URI mismatch or wrong environment

**Solution**:
1. Verify `VITE_QB_REDIRECT_URI` matches QuickBooks app config exactly
2. Check `VITE_QB_ENVIRONMENT` is `sandbox` for dev
3. Ensure `QB_CLIENT_SECRET` is set in Supabase secrets (not .env)
4. Check QuickBooks app is active (not in development mode)

### "Environment variables not loading in Vite"

**Cause**: Variables must be prefixed with `VITE_` for client-side access

**Solution**:
- ✅ `VITE_SUPABASE_URL` (works)
- ❌ `SUPABASE_URL` (won't work in browser code)
- Exception: Build-time variables like `SENTRY_AUTH_TOKEN` don't need prefix

### "Changes to .env not reflecting"

**Solution**:
1. Restart dev server: `Ctrl+C` then `npm run dev`
2. Clear browser cache
3. Check you're editing `.env.local` not `.env.example`

---

## Environment Variable Checklist

### For New Developers

- [ ] `.env.local` created from `.env.example`
- [ ] `VITE_SUPABASE_URL` set
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` set
- [ ] `VITE_GOOGLE_MAPS_KEY` set
- [ ] (Optional) `VITE_SENTRY_DSN` set
- [ ] Dev server starts without errors
- [ ] Can login with test credentials
- [ ] Map loads on Fleet Tracker page

### For Production Deployment

- [ ] All required variables set in Vercel
- [ ] `SENTRY_AUTH_TOKEN` set for source maps
- [ ] `QB_CLIENT_SECRET` set in Supabase secrets (not Vercel)
- [ ] Google Maps key has domain restrictions
- [ ] All URLs point to production domains
- [ ] `VITE_QB_ENVIRONMENT=production`
- [ ] Deployment successful
- [ ] Health check passes

---

## Related Documentation

- **[PROJECT_README.md](./PROJECT_README.md)** - Project overview
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment procedures
- **[INTEGRATIONS.md](./INTEGRATIONS.md)** - Third-party service setup
- **[KNOWN_ISSUES.md](./KNOWN_ISSUES.md)** - Common problems & fixes

---

**Last Updated**: March 13, 2026
**Maintained by**: Development Team
**Questions?**: Check Supabase project settings or Vercel environment variables dashboard
