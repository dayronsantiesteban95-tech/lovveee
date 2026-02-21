# Deployment Guide - Anika Control OS

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Development Setup](#local-development-setup)
- [Database Setup & Migrations](#database-setup--migrations)
- [Vercel Deployment](#vercel-deployment)
- [Post-Deployment Checklist](#post-deployment-checklist)
- [Health Check & Verification](#health-check--verification)
- [Rollback Procedure](#rollback-procedure)
- [Monitoring & Observability](#monitoring--observability)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Production URL:** https://lovveee.vercel.app

**Supabase Project:** vdsknsypobnutnqcafre
**Supabase URL:** https://vdsknsypobnutnqcafre.supabase.co

**Tech Stack:**
- Frontend: React 18 + Vite + TypeScript
- UI Framework: shadcn-ui + Tailwind CSS + Radix UI
- Database: Supabase (PostgreSQL)
- Hosting: Vercel
- Error Tracking: Sentry
- Maps: Google Maps API
- Integrations: QuickBooks OAuth

**Repository:** https://github.com/dayronsantiesteban95-tech/lovveee.git

---

## Prerequisites

Before deploying, ensure you have:

- **Node.js 18+** installed ([install with nvm](https://github.com/nvm-sh/nvm))
- **npm** or **yarn** package manager
- **Git** installed and configured
- **Vercel account** (free tier works)
- **Supabase account** with active project
- **Google Cloud Platform account** (for Maps API)
- **Sentry account** (for error tracking)
- **QuickBooks Developer account** (optional, for invoicing features)

---

## Environment Variables

### Required Variables

Create a `.env.local` file in the project root (for local development) or configure these in Vercel (for production):

```bash
# Sentry Error Tracking (REQUIRED)
VITE_SENTRY_DSN=your_sentry_dsn_here
SENTRY_AUTH_TOKEN=your_sentry_auth_token_here

# Supabase Database (REQUIRED)
VITE_SUPABASE_URL=https://vdsknsypobnutnqcafre.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key_here

# Google Maps (REQUIRED for live tracking, geocoding, routing)
VITE_GOOGLE_MAPS_KEY=your_google_maps_api_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# QuickBooks Integration (REQUIRED for invoicing)
VITE_QB_CLIENT_ID=your_quickbooks_client_id_here
VITE_QB_REDIRECT_URI=https://lovveee.vercel.app/auth/quickbooks/callback
VITE_QB_ENVIRONMENT=production  # or "sandbox" for testing

# OneSignal Push Notifications (OPTIONAL - Phase 10 future enhancement)
VITE_ONESIGNAL_APP_ID=your_onesignal_app_id_here
VITE_ONESIGNAL_API_KEY=your_onesignal_rest_api_key_here
```

### Environment Variable Descriptions

| Variable | Purpose | Where to Get It |
|----------|---------|-----------------|
| `VITE_SENTRY_DSN` | Error tracking endpoint | Sentry dashboard > Settings > Client Keys (DSN) |
| `SENTRY_AUTH_TOKEN` | Build-time sourcemap upload | Sentry dashboard > Settings > Auth Tokens |
| `VITE_SUPABASE_URL` | Database connection URL | Supabase dashboard > Settings > API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anonymous/public key for client | Supabase dashboard > Settings > API |
| `VITE_GOOGLE_MAPS_KEY` | Maps, geocoding, routing | Google Cloud Console > APIs & Services > Credentials |
| `VITE_QB_CLIENT_ID` | QuickBooks OAuth app ID | QuickBooks Developer Portal > My Apps |
| `VITE_QB_REDIRECT_URI` | OAuth callback URL | Must match QuickBooks app settings |
| `VITE_QB_ENVIRONMENT` | Production or sandbox mode | Set to `production` for live QB data |
| `VITE_ONESIGNAL_APP_ID` | Push notification app ID | OneSignal dashboard (optional) |
| `VITE_ONESIGNAL_API_KEY` | Push notification API key | OneSignal dashboard (optional) |

### Secrets Management

**CRITICAL:** Never commit secrets to Git. Use:
- `.env.local` for local development (gitignored)
- Vercel environment variables for production
- Supabase Vault for sensitive Edge Function secrets

**QuickBooks Client Secret:** This MUST be stored in Supabase secrets, NOT in environment variables:
```bash
supabase secrets set QB_CLIENT_SECRET=your_secret_here
```

---

## Local Development Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/dayronsantiesteban95-tech/lovveee.git
cd lovveee
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all dependencies including:
- React, React DOM, React Router
- Vite build tooling
- shadcn-ui and Radix UI components
- Supabase client library
- Sentry SDK
- Google Maps React API
- Testing libraries (Vitest)

### Step 3: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and fill in your actual credentials (see [Environment Variables](#environment-variables))

### Step 4: Start Development Server

```bash
npm run dev
```

The app will be available at: `http://localhost:8080`

**Note:** The dev server runs on port 8080 (configured in `vite.config.ts`)

### Step 5: Run Tests (Optional)

```bash
# Run tests once
npm run test

# Watch mode
npm run test:watch
```

---

## Database Setup & Migrations

### Install Supabase CLI

```bash
npm install -g supabase
```

Or use npx to run without global install:
```bash
npx supabase [command]
```

### Link to Supabase Project

```bash
supabase login
supabase link --project-ref vdsknsypobnutnqcafre
```

You'll be prompted for your database password (found in Supabase dashboard > Settings > Database).

### Apply Database Migrations

The project includes 44+ migration files in `supabase/migrations/`. Apply them in order:

```bash
supabase db push
```

This command:
1. Reads all `.sql` files in `supabase/migrations/`
2. Applies them in chronological order
3. Tracks migration state in `supabase_migrations` table

### Key Migrations Included

- **Schema setup:** loads, drivers, customers, hubs, vehicles
- **GPS tracking:** driver location history with real-time subscriptions
- **Customer portal:** public tracking links with geofencing
- **Billing:** invoices, QuickBooks tokens, AR aging
- **Fleet management:** inspections, car wash tracking
- **Time clock:** shift tracking, break times, payroll export
- **Notifications:** geofence alerts, late load warnings
- **Performance indexes:** optimized queries for real-time data
- **RPC functions:** driver suggestions, dispatch logic
- **Row-Level Security (RLS):** policies for all tables

### Verify Migrations

After applying migrations, verify the schema:

```bash
# List all tables
supabase db dump --schema public --data-only=false

# Or run a health check query in Supabase SQL Editor:
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- `loads`
- `drivers`
- `driver_gps_tracking`
- `customers`
- `hubs`
- `vehicles`
- `vehicle_inspections`
- `car_wash_tracker`
- `quickbooks_tokens`
- `invoices`
- `time_entries`
- `messages`
- `notifications`
- `rate_sheets`
- `competitor_rates`
- And more...

### Seed Data (Optional)

To populate test data for development:

```bash
supabase db reset  # WARNING: Destroys all data and re-runs migrations
```

Or manually run seed scripts:
```bash
psql $DATABASE_URL -f supabase/migrations/20260218_qa_seed_data.sql
```

---

## Vercel Deployment

### Option 1: Deploy via GitHub (Recommended)

1. **Connect GitHub Repository**
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select `dayronsantiesteban95-tech/lovveee`
   - Authorize Vercel to access the repo

2. **Configure Build Settings**
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
   - Root Directory: `./` (leave blank)

3. **Add Environment Variables**
   - Go to Project Settings > Environment Variables
   - Add all variables from [Environment Variables](#environment-variables)
   - Set scope to "Production", "Preview", or "All" as needed

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - First deploy takes 2-3 minutes

5. **Automatic Deployments**
   - Every push to `master` triggers a production deployment
   - Pull requests get preview deployments
   - Preview URLs: `https://lovveee-git-[branch].vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login**
```bash
vercel login
```

3. **Deploy**
```bash
# First time: interactive setup
vercel

# Production deployment
vercel --prod
```

### Build Configuration

The project uses custom Vite configuration (`vite.config.ts`):

- **Output:** Static HTML/JS/CSS in `dist/`
- **Sourcemaps:** Enabled for production (uploaded to Sentry)
- **Code Splitting:** Vendor chunks for React, UI, Charts, Maps, PDF
- **Chunk Size Limit:** 600kb warning threshold
- **Sentry Plugin:** Automatic sourcemap upload on build

### Deployment Configuration (vercel.json)

The project includes a `vercel.json` with:

- **SPA Routing:** All routes rewrite to `/index.html` (client-side routing)
- **Security Headers:**
  - Content Security Policy (CSP) for Maps/Supabase/QuickBooks
  - HSTS (HTTP Strict Transport Security)
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - XSS Protection
  - Referrer Policy
  - Permissions Policy (camera, geolocation)
- **Cache Control:**
  - No cache for HTML/API responses
  - 1-year cache for static assets in `/assets/`

### Custom Domain Setup

1. **Add Domain in Vercel**
   - Go to Project Settings > Domains
   - Click "Add Domain"
   - Enter your domain (e.g., `dispatch.anikalogistics.com`)

2. **Configure DNS**
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or A record pointing to Vercel's IP (provided in dashboard)

3. **Update Environment Variables**
   - Update `VITE_QB_REDIRECT_URI` to match new domain
   - Update QuickBooks app settings with new redirect URI

4. **SSL Certificate**
   - Vercel provisions SSL automatically (Let's Encrypt)
   - Certificate renews automatically

---

## Post-Deployment Checklist

After deploying, verify each of these:

### Core Infrastructure
- [ ] Deployment completed successfully (check Vercel dashboard)
- [ ] Production URL loads without errors (https://lovveee.vercel.app)
- [ ] All environment variables are set in Vercel
- [ ] Sentry is receiving events (check Sentry dashboard)

### Database & Backend
- [ ] Supabase migrations applied successfully
- [ ] Database connection works (test login)
- [ ] Real-time subscriptions active (check live map)
- [ ] RPC functions callable (test driver suggestion)
- [ ] Row-Level Security (RLS) policies enforced

### API Integrations
- [ ] Google Maps API enabled and working
  - [ ] Geocoding API enabled
  - [ ] Maps JavaScript API enabled
  - [ ] Routes API enabled (for navigation)
  - [ ] Test live map loads correctly
- [ ] QuickBooks OAuth configured
  - [ ] Client ID set in environment
  - [ ] Redirect URI matches app settings
  - [ ] Client Secret stored in Supabase secrets
  - [ ] Test OAuth flow (Settings > QuickBooks Integration)
- [ ] Sentry error tracking verified
  - [ ] DSN configured
  - [ ] Auth token set (for sourcemaps)
  - [ ] Test error capture (trigger intentional error)

### Application Features
- [ ] Login works (test user: info@anikalogistics.com)
- [ ] Dashboard loads with live data
- [ ] Command Center (live map) displays driver locations
- [ ] Dispatch Tracker shows active loads
- [ ] Real-time updates work (test GPS tracking)
- [ ] POD upload and signature capture work
- [ ] Fleet tracker displays vehicle data
- [ ] Time Clock allows clock in/out
- [ ] Billing module displays invoices

### Security & Performance
- [ ] HTTPS enabled (check for green lock icon)
- [ ] Security headers present (check Network tab > Headers)
- [ ] CSP allows required domains (Maps, Supabase, QuickBooks)
- [ ] No console errors on page load
- [ ] Lighthouse score > 90 (performance, accessibility)
- [ ] Mobile responsive (test on phone)

### Monitoring Setup
- [ ] Sentry project linked to Vercel
- [ ] Error alerts configured (email/Slack)
- [ ] Supabase monitoring enabled (check dashboard)
- [ ] Vercel analytics enabled (optional)

---

## Health Check & Verification

### Manual Health Check

1. **Frontend Health**
   - Open https://lovveee.vercel.app
   - Check browser console for errors
   - Verify all assets load (Network tab)

2. **Database Health**
   - Login with test credentials
   - Navigate to Dashboard
   - Verify KPI cards load with data
   - Check Command Center map renders

3. **Real-Time Health**
   - Open Command Center
   - Simulate driver location update (Supabase SQL Editor):
     ```sql
     INSERT INTO driver_gps_tracking (driver_id, latitude, longitude, timestamp)
     VALUES (1, 33.4484, -112.0740, NOW());
     ```
   - Verify map updates in real-time

4. **API Integration Health**
   - **Google Maps:**
     - Command Center map loads
     - Geocoding works (create new load with address)
   - **Supabase:**
     - Real-time subscriptions active
     - Data loads without delays
   - **Sentry:**
     - Trigger error: `throw new Error('Health check test')`
     - Verify in Sentry dashboard

### Automated Health Check

Create a monitoring endpoint (future enhancement):

```typescript
// src/pages/Health.tsx
export default function Health() {
  return (
    <div>
      <h1>Health Check</h1>
      <ul>
        <li>Status: OK</li>
        <li>Database: Connected</li>
        <li>Uptime: {performance.now()}ms</li>
      </ul>
    </div>
  );
}
```

Then monitor via Vercel Integrations > Checkly or UptimeRobot.

---

## Rollback Procedure

### If Deployment Fails

**Vercel automatically keeps previous deployments.** To rollback:

1. **Via Vercel Dashboard:**
   - Go to Project > Deployments
   - Find the last working deployment
   - Click "..." menu > "Promote to Production"
   - Confirm rollback

2. **Via Git:**
   ```bash
   # Revert to previous commit
   git log --oneline  # Find last good commit hash
   git revert [bad-commit-hash]
   git push origin master
   ```
   Vercel will auto-deploy the reverted code.

3. **Via Vercel CLI:**
   ```bash
   vercel rollback [deployment-url]
   ```

### If Database Migration Fails

**CRITICAL: Always backup before migrations!**

1. **Backup Current State:**
   ```bash
   supabase db dump > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Revert Migration:**
   - Find the failed migration in `supabase/migrations/`
   - Create a rollback SQL script
   - Apply manually:
     ```bash
     psql $DATABASE_URL -f rollback_migration.sql
     ```

3. **Or Reset Database (NUCLEAR OPTION):**
   ```bash
   supabase db reset  # WARNING: Destroys all data
   ```

### Communication During Rollback

1. **Notify Team:**
   - Post in team Slack/Telegram
   - Status: "Deployment rolled back due to [issue]"

2. **Update Status Page:**
   - If using status.io or similar
   - Mark as "Degraded Service" during rollback

3. **Post-Rollback:**
   - Verify health checks pass
   - Document incident in `memory/decisions/`
   - Create postmortem if critical

---

## Monitoring & Observability

### Vercel Dashboard
- **URL:** https://vercel.com/dashboard
- **Metrics:**
  - Deployment status
  - Build logs
  - Function invocations (if using serverless)
  - Bandwidth usage
  - Deployment frequency

### Sentry Error Tracking
- **URL:** https://sentry.io/organizations/anika-qi/projects/javascript-react/
- **Monitors:**
  - JavaScript errors (browser)
  - Unhandled promise rejections
  - Network errors (failed API calls)
  - Performance issues (slow transactions)
- **Alerts:**
  - Configure Slack/Email alerts for high-priority errors
  - Set up issue assignment rules

### Supabase Monitoring
- **URL:** https://supabase.com/dashboard/project/vdsknsypobnutnqcafre
- **Metrics:**
  - Database size and growth
  - Active connections
  - Query performance (slow queries)
  - API requests per second
  - Real-time connections
  - Storage usage

### Google Cloud Console (Maps API)
- **URL:** https://console.cloud.google.com
- **Metrics:**
  - Maps API usage (requests/day)
  - Geocoding API usage
  - Routes API usage
  - Cost tracking (prevent unexpected bills)
  - Set usage quotas to prevent overages

### Key Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Uptime | 99.9% | < 99% |
| Page Load Time | < 2s | > 5s |
| Error Rate | < 0.1% | > 1% |
| Database Response Time | < 100ms | > 500ms |
| Real-time Connection Count | Varies | > 1000 |
| Build Time | < 3min | > 5min |

---

## Troubleshooting

### Common Issues & Fixes

#### 1. Build Fails on Vercel

**Symptom:** Deployment fails with TypeScript errors

**Fix:**
```bash
# Run locally first
npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Fix errors, commit, push
```

**Prevention:** Git pre-push hook blocks bad commits (already configured)

---

#### 2. Environment Variables Not Working

**Symptom:** App can't connect to Supabase/Maps/Sentry

**Checklist:**
- [ ] Variable names start with `VITE_` for client-side access
- [ ] Variables set in Vercel dashboard (not just `.env.local`)
- [ ] Deployment triggered AFTER variables added
- [ ] No trailing spaces in variable values

**Fix:**
1. Go to Vercel > Project Settings > Environment Variables
2. Verify all required variables exist
3. Re-deploy (Deployments > ... > Redeploy)

---

#### 3. Google Maps Not Loading

**Symptom:** Map shows gray box or "This page can't load Google Maps correctly"

**Common Causes:**
- API key not set
- API key restrictions too strict
- Required APIs not enabled
- Billing not enabled on Google Cloud

**Fix:**
1. Verify API key in Vercel environment variables
2. Check Google Cloud Console:
   - APIs & Services > Enabled APIs
   - Enable: Maps JavaScript API, Geocoding API, Routes API
   - Credentials > API key > HTTP referrers
   - Add: `https://lovveee.vercel.app/*`
3. Enable billing (required for Maps API usage)

---

#### 4. Supabase Real-Time Not Working

**Symptom:** Live map doesn't update, data doesn't refresh

**Checklist:**
- [ ] Supabase URL/Key correct in environment
- [ ] Real-time enabled on tables (Supabase dashboard > Database > Replication)
- [ ] RLS policies allow SELECT on tables
- [ ] Network tab shows WebSocket connection

**Fix:**
1. Check `src/integrations/supabase/client.ts` for correct config
2. Verify table replication:
   ```sql
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```
   Should include: `loads`, `driver_gps_tracking`, etc.
3. Test subscription in browser console:
   ```javascript
   const { data, error } = await supabase
     .channel('test')
     .on('postgres_changes', { event: '*', schema: 'public', table: 'loads' }, (payload) => {
       console.log('Change received!', payload);
     })
     .subscribe();
   ```

---

#### 5. QuickBooks OAuth Fails

**Symptom:** OAuth redirects to error page or fails silently

**Common Causes:**
- Redirect URI mismatch
- Client ID/Secret incorrect
- Sandbox vs Production mismatch
- Scopes not requested

**Fix:**
1. Verify QuickBooks app settings:
   - Developer Portal > My Apps > [Your App]
   - Redirect URI: `https://lovveee.vercel.app/auth/quickbooks/callback`
   - Scopes: `com.intuit.quickbooks.accounting`
2. Check environment:
   - `VITE_QB_ENVIRONMENT=production` (or `sandbox`)
   - Must match app type in QuickBooks Developer Portal
3. Verify Client Secret in Supabase:
   ```bash
   supabase secrets list
   ```
   Should show: `QB_CLIENT_SECRET`

---

#### 6. Sentry Not Receiving Errors

**Symptom:** No events in Sentry dashboard

**Checklist:**
- [ ] `VITE_SENTRY_DSN` set in Vercel
- [ ] Sentry initialized in `src/main.tsx`
- [ ] Browser console shows Sentry SDK loaded
- [ ] CSP allows `https://*.sentry.io`

**Fix:**
1. Test manually:
   ```javascript
   Sentry.captureException(new Error('Test error'));
   ```
2. Check Network tab for requests to `sentry.io`
3. Verify DSN format: `https://[key]@[org].ingest.sentry.io/[project]`
4. Check Sentry project status (not paused/disabled)

---

#### 7. Performance Issues / Slow Loads

**Symptom:** App takes > 5 seconds to load

**Diagnosis:**
1. Check Vercel deployment logs for slow build
2. Check Supabase dashboard for slow queries
3. Run Lighthouse audit in Chrome DevTools
4. Check bundle size: `npm run build` output

**Optimizations:**
- Lazy load routes with `React.lazy()`
- Optimize images (use WebP, lazy load)
- Enable Vercel Edge caching
- Add database indexes (already included in migrations)
- Use React Query for caching

**Already Implemented:**
- Code splitting (vendor chunks in `vite.config.ts`)
- Performance indexes on database
- CDN caching for assets (Vercel)

---

#### 8. Mobile App Issues (React Native Driver App)

**Note:** This guide focuses on the dispatcher web app. For the driver mobile app:

- **Repo:** `C:\Users\Ilove\.openclaw\workspace\anika-driver-app\`
- **Build:** Requires EAS CLI and Expo account
- **Deployment:** See driver app README for iOS/Android build instructions

---

### Getting Help

1. **Check Logs:**
   - Vercel: Project > Deployments > [Latest] > Build Logs
   - Sentry: Issues tab
   - Supabase: Logs Explorer
   - Browser: Console + Network tab

2. **Documentation:**
   - Vite: https://vitejs.dev
   - Supabase: https://supabase.com/docs
   - Vercel: https://vercel.com/docs
   - Sentry: https://docs.sentry.io

3. **Support Channels:**
   - Internal: Dayron Santi (@Dayron1995 on Telegram)
   - Vercel: support@vercel.com
   - Supabase: Discord community

---

## Maintenance & Updates

### Dependency Updates

**Monthly:**
```bash
npm outdated  # Check for updates
npm update    # Update minor/patch versions
```

**Major Updates (review breaking changes first):**
```bash
npm install [package]@latest
```

**Security Updates:**
```bash
npm audit
npm audit fix
```

### Database Maintenance

**Vacuum (optimize storage):**
```sql
VACUUM ANALYZE;
```

**Backup:**
```bash
supabase db dump > backup_$(date +%Y%m%d).sql
```

**Monitor Size:**
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Production Credentials Quick Reference

| Service | URL | Notes |
|---------|-----|-------|
| Production App | https://lovveee.vercel.app | Main dispatcher interface |
| Supabase Dashboard | https://supabase.com/dashboard/project/vdsknsypobnutnqcafre | Database management |
| Vercel Dashboard | https://vercel.com/dashboard | Deployment & hosting |
| Sentry Dashboard | https://sentry.io/organizations/anika-qi/projects/javascript-react/ | Error tracking |
| Google Cloud Console | https://console.cloud.google.com | Maps API management |
| QuickBooks Developer | https://developer.intuit.com | OAuth app management |
| GitHub Repo | https://github.com/dayronsantiesteban95-tech/lovveee | Source code |

**Test Credentials:**
- Email: `info@anikalogistics.com`
- Password: `admin`

---

## Deployment Workflow Summary

```
1. Code changes pushed to GitHub
         ↓
2. Vercel detects commit on master branch
         ↓
3. Vercel runs build: npm run build
         ↓
4. Vite builds production bundle
         ↓
5. Sentry plugin uploads sourcemaps
         ↓
6. Build artifacts deployed to Vercel CDN
         ↓
7. DNS updated to point to new deployment
         ↓
8. Health checks run automatically
         ↓
9. Deployment marked successful or rolled back
```

**Average deployment time:** 2-3 minutes

---

## Support & Contact

**Technical Lead:** Dayron Santi
**Contact:** @Dayron1995 (Telegram)
**Timezone:** America/Phoenix (MST)

**Document Version:** 1.0
**Last Updated:** 2026-02-21
**Next Review:** 2026-03-21

---

*This deployment guide is maintained by the Anika Logistics technical team. For updates or corrections, create a pull request or contact the technical lead.*
