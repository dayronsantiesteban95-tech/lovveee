# API Reference - Supabase Edge Functions

Documentation for all serverless Edge Functions.

**Last Updated**: March 13, 2026  
**Total Functions**: 14

---

## Edge Functions Overview

All functions are Deno-based, deployed to Supabase Edge (globally distributed).

**Location**: `supabase/functions/`

---

## Authentication Functions

### 1. invite-user
**Path**: `/functions/v1/invite-user`  
**Method**: POST  
**Purpose**: Send user invitation emails

**Request**:
```json
{
  "email": "user@example.com",
  "role": "driver",
  "temporary_password": "auto-generated"
}
```

**Response**:
```json
{
  "success": true,
  "user_id": "uuid",
  "invitation_sent": true
}
```

**Use Case**: Team Management page - invite new users

---

## QuickBooks Integration

### 2. qb-token-exchange
**Path**: `/functions/v1/qb-token-exchange`  
**Method**: POST  
**Purpose**: Exchange OAuth authorization code for access/refresh tokens

**Secrets Required**:
- `QB_CLIENT_ID`
- `QB_CLIENT_SECRET`

**Request**:
```json
{
  "code": "oauth_authorization_code",
  "realm_id": "quickbooks_company_id"
}
```

**Response**:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

---

### 3. qb-token-refresh
**Path**: `/functions/v1/qb-token-refresh`  
**Method**: POST  
**Purpose**: Refresh expired QuickBooks access token

**Request**:
```json
{
  "refresh_token": "existing_refresh_token"
}
```

**Response**:
```json
{
  "access_token": "new_access_token",
  "refresh_token": "new_refresh_token"
}
```

**Automation**: Runs automatically when tokens expire

---

### 4. qb-create-invoice
**Path**: `/functions/v1/qb-create-invoice`  
**Method**: POST  
**Purpose**: Create invoice in QuickBooks

**Request**:
```json
{
  "load_id": "uuid",
  "customer_ref": "QB_customer_id",
  "amount": 150.00,
  "description": "Delivery service"
}
```

**Response**:
```json
{
  "invoice_id": "QB_invoice_id",
  "invoice_number": "INV-1234"
}
```

---

## Maintenance & Cleanup

### 5. gps-cleanup
**Path**: `/functions/v1/gps-cleanup`  
**Method**: POST (scheduled via pg_cron)  
**Purpose**: Archive GPS locations older than 30 days

**Schedule**: Daily at 2 AM UTC

**Process**:
1. Selects `driver_locations` older than 30 days
2. Archives to cold storage (S3 / separate table)
3. Deletes from hot table

**Response**:
```json
{
  "archived_count": 12450,
  "deleted_count": 12450
}
```

---

## CRM Functions

### 6. enrich-leads
**Path**: `/functions/v1/enrich-leads`  
**Method**: POST  
**Purpose**: Enrich lead data from ZoomInfo, Clearbit

**Request**:
```json
{
  "lead_id": "uuid",
  "email": "contact@company.com"
}
```

**Response**:
```json
{
  "enriched": true,
  "data": {
    "company_size": "50-100",
    "industry": "Logistics",
    "revenue": "$5M-$10M"
  }
}
```

---

### 7. send-outreach-email
**Path**: `/functions/v1/send-outreach-email`  
**Method**: POST  
**Purpose**: Send bulk email from sequences

**Request**:
```json
{
  "sequence_id": "uuid",
  "contact_ids": ["uuid1", "uuid2"],
  "template_id": "uuid"
}
```

**Response**:
```json
{
  "sent_count": 45,
  "failed_count": 2,
  "errors": []
}
```

---

## Integration Proxies

### 8. onfleet-proxy
**Path**: `/functions/v1/onfleet-proxy`  
**Method**: GET/POST  
**Purpose**: Bridge to Onfleet API (migration phase)

**Status**: Active during 30-day transition

---

### 9. ontime360-proxy
**Path**: `/functions/v1/ontime360-proxy`  
**Method**: GET/POST  
**Purpose**: Bridge to OnTime 360 API (migration phase)

**Status**: Active during transition

---

## Notifications

### 10. send-push-notification
**Path**: `/functions/v1/send-push-notification`  
**Method**: POST  
**Purpose**: Send push to drivers (OneSignal)

**Status**: 🔮 Planned (Phase 10)

**Request**:
```json
{
  "driver_id": "uuid",
  "title": "New BLAST Available",
  "message": "Load #1234 - Miami to FLL",
  "data": {
    "blast_id": "uuid",
    "load_id": "uuid"
  }
}
```

---

## Monitoring & Alerts

### 11. sentry-alert
**Path**: `/functions/v1/sentry-alert`  
**Method**: POST (webhook)  
**Purpose**: Forward Sentry errors to Slack/email

**Trigger**: Sentry webhook on new errors

---

### 12. vercel-deploy-alert
**Path**: `/functions/v1/vercel-deploy-alert`  
**Method**: POST (webhook)  
**Purpose**: Notify on Vercel deployments

**Trigger**: Vercel deployment webhook

---

## Future Functions

### 13. sheets-sync
**Status**: 🔮 Planned  
**Purpose**: Sync data to Google Sheets for reporting

---

### 14. ai-chat
**Status**: 🔮 Planned  
**Purpose**: AI chatbot for drivers/dispatchers

---

## Deployment

**Deploy All Functions**:
```bash
npx supabase functions deploy
```

**Deploy Single Function**:
```bash
npx supabase functions deploy qb-token-refresh
```

**Set Secrets**:
```bash
supabase secrets set QB_CLIENT_SECRET=your_secret
supabase secrets set ONESIGNAL_REST_API_KEY=your_key
```

---

## Testing

**Local Testing**:
```bash
npx supabase functions serve qb-token-refresh --env-file ./supabase/.env
```

**Test Request**:
```bash
curl -X POST http://localhost:54321/functions/v1/qb-token-refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "test_token"}'
```

---

## Monitoring

**Logs**:
```bash
npx supabase functions logs qb-token-refresh
```

**Metrics** (Supabase Dashboard):
- Invocation count
- Error rate
- Execution time

---

**Related**: See INTEGRATIONS.md for third-party API details
