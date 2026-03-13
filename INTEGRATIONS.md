# Third-Party Integrations Guide

Complete setup guide for all external services.

**Last Updated**: March 13, 2026

---

## Active Integrations

### 1. Supabase (Database & Backend)
**Purpose**: Primary database, authentication, realtime, storage

**Setup**:
1. Project: https://vdsknsypobnutnqcafre.supabase.co
2. Get credentials: Settings → API
3. Add to `.env.local`:
   ```bash
   VITE_SUPABASE_URL=https://vdsknsypobnutnqcafre.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
   ```

**Features Used**:
- PostgreSQL database (65 migrations)
- Auth (email/password)
- Realtime (WebSockets for 6 tables)
- Storage (POD photos bucket)
- Edge Functions (14 serverless functions)

**Costs**: ~$25/month (Pro plan)

---

### 2. Google Maps Platform
**Purpose**: Maps, routing, geocoding, ETA calculations

**Setup**:
1. Create project: https://console.cloud.google.com
2. Enable APIs:
   - Maps JavaScript API
   - Routes API v2
   - Geocoding API
   - Distance Matrix API
   - Places API
3. Create API key
4. **Restrict key** (important):
   - Application restrictions: HTTP referrers
   - Website restrictions: `dispatch.anikalogistics.com/*`

**Configuration**:
```bash
VITE_GOOGLE_MAPS_KEY=AIzaSyC_your_key_here
```

**Usage**:
- Fleet map (`FleetTracker.tsx`)
- Route optimization
- Address autocomplete
- Distance/duration calculations

**Costs**: ~$200/month (production usage)

**Billing Alert**: Set budget alert at $250/month

---

### 3. Vercel (Hosting & Deployment)
**Purpose**: Web app hosting, auto-deploy, edge network

**Setup**:
1. Connect GitHub: https://vercel.com/new
2. Import `lovveee` repository
3. Configure:
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist/`
4. Add environment variables (see ENVIRONMENT.md)
5. Add custom domain: `dispatch.anikalogistics.com`

**Features Used**:
- Auto-deploy on push to master
- Preview deployments (PRs)
- Edge network (global CDN)
- Analytics
- Web Vitals monitoring

**Costs**: $20/month (Pro plan)

---

### 4. Sentry (Error Tracking)
**Purpose**: Error monitoring, performance tracking, debugging

**Setup**:
1. Create project: https://sentry.io
2. Select platform: React
3. Get DSN: Settings → Client Keys
4. Add to environment:
   ```bash
   VITE_SENTRY_DSN=https://key@org.ingest.us.sentry.io/project
   SENTRY_AUTH_TOKEN=sntrys_token  # For source maps
   ```
5. Configure in `lib/sentry.ts`

**Features Used**:
- Error tracking (global error boundary)
- Source maps (uploaded during build)
- Performance monitoring
- Release tracking
- User feedback (future)

**Costs**: Free tier (5K events/month)

**Organization**: anika-qi  
**Project**: javascript-react

---

### 5. QuickBooks Online
**Purpose**: Automated invoicing, accounting sync

**Setup**:
1. Create app: https://developer.intuit.com
2. Get credentials:
   - Client ID (public)
   - Client Secret (secret)
3. Configure OAuth redirect URI:
   - Dev: `http://localhost:8080/auth/quickbooks/callback`
   - Prod: `https://dispatch.anikalogistics.com/auth/quickbooks/callback`
4. Add environment variables:
   ```bash
   VITE_QB_CLIENT_ID=your_client_id
   VITE_QB_REDIRECT_URI=https://dispatch.anikalogistics.com/auth/quickbooks/callback
   VITE_QB_ENVIRONMENT=production
   ```
5. **Important**: Set secret in Supabase (NOT .env):
   ```bash
   supabase secrets set QB_CLIENT_SECRET=your_secret
   ```

**OAuth Flow**:
1. User clicks "Connect QuickBooks" (Billing page)
2. Redirect to QB OAuth consent
3. User authorizes
4. Callback to `/auth/quickbooks/callback`
5. Exchange code for tokens (Edge Function)
6. Store tokens in Supabase

**API Endpoints**:
- Create invoice
- Get customer list
- Sync payment status

**Token Refresh**: Automatic (via Edge Function)

**Costs**: Free (QuickBooks account required)

---

### 6. Expo (Mobile App Platform)
**Purpose**: React Native build service, OTA updates, TestFlight

**Setup**:
1. Create account: https://expo.dev
2. Install EAS CLI: `npm install -g eas-cli`
3. Login: `eas login`
4. Initialize project: `eas init` (in driver app folder)
5. Configure `eas.json` (build profiles)

**Features Used**:
- EAS Build (iOS + Android builds)
- EAS Update (OTA JS updates)
- EAS Submit (App Store / Google Play)

**Configuration**:
```json
{
  "expo": {
    "owner": "anika2025",
    "projectId": "753f4e3a-e88f-4d6b-be2f-0e2d06682e3e"
  }
}
```

**Costs**: Free tier (30 builds/month)

**Upgrade to Paid**: $29/month (unlimited builds)

---

## Planned Integrations

### 7. OneSignal (Push Notifications)
**Status**: 🔮 Planned (Phase 10)  
**Purpose**: Push notifications to driver mobile app

**Setup** (when ready):
1. Create account: https://onesignal.com
2. Create app (iOS + Android)
3. Get App ID and REST API key
4. Configure in driver app

**Use Cases**:
- BLAST notifications
- Load assignment alerts
- Status update reminders

**Costs**: Free tier (up to 10K subscribers)

---

### 8. Twilio (SMS Notifications)
**Status**: 🔮 Planned (Phase 10)  
**Purpose**: SMS fallback when push fails

**Use Cases**:
- Driver doesn't have app installed
- Push notification failed
- Customer delivery notifications

**Costs**: $0.0075/SMS (outbound)

---

## Integration Testing

### Local Development

**Test with sandbox/dev environments**:
- QuickBooks: Use sandbox company
- Google Maps: Use development API key (no restrictions)
- Sentry: Use dev project (separate from prod)

### Production Testing

**Before going live**:
- [ ] QuickBooks OAuth flow works end-to-end
- [ ] Google Maps renders correctly
- [ ] Sentry captures test errors
- [ ] Vercel deploys successfully
- [ ] Expo builds complete

---

## API Rate Limits

| Service | Rate Limit | Handling |
|---------|------------|----------|
| **Google Maps** | No hard limit (billing-based) | Budget alerts |
| **QuickBooks** | 500 req/min | Built-in throttling |
| **Supabase** | 10K req/min (Pro) | Connection pooling |
| **Expo** | 30 builds/month (free) | Upgrade if needed |
| **Sentry** | 5K events/month (free) | Error sampling |

---

## Security Best Practices

### API Keys
- ✅ Never commit to git
- ✅ Restrict Google Maps key to specific domains
- ✅ Use environment variables
- ✅ Rotate keys quarterly

### Secrets Management
- ✅ Use Supabase secrets for Edge Functions
- ✅ Use Vercel environment variables for web
- ✅ Use EAS secrets for mobile
- ❌ Never hardcode secrets in code

### OAuth Tokens
- ✅ Store in database (encrypted)
- ✅ Refresh before expiration
- ✅ Implement token revocation
- ✅ Handle edge cases (expired, invalid)

---

## Troubleshooting

### Google Maps Not Loading
1. Check API key is set
2. Verify required APIs are enabled
3. Check domain restrictions
4. Review billing account

### QuickBooks OAuth Fails
1. Verify redirect URI matches exactly
2. Check client secret is in Supabase secrets
3. Test in sandbox first
4. Review QB app status

### Sentry Errors Not Appearing
1. Verify DSN is correct
2. Check source maps uploaded
3. Review project settings
4. Wait 1-2 minutes for ingestion

---

## Cost Monitoring

**Monthly Budget**:
- Supabase Pro: $25
- Vercel Pro: $20
- Google Maps: $200 (estimated)
- Expo: $0 (free tier)
- Sentry: $0 (free tier)
- **Total**: ~$245/month

**Set Billing Alerts**:
- Google Cloud: $250/month
- Vercel: $30/month
- Supabase: $30/month

---

**Related**: See ENVIRONMENT.md for environment variables, API_REFERENCE.md for Edge Functions
