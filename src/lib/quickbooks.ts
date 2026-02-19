// ═══════════════════════════════════════════════════════════
// QUICKBOOKS ONLINE — OAuth Helper (Frontend-safe)
// Phase 2: Billing Module Integration
//
// SECURITY: QB_CLIENT_SECRET has been removed from frontend code.
// Token exchange, refresh, and invoice creation are handled
// server-side in Supabase Edge Functions:
//   • qb-token-exchange  — OAuth code → tokens (stored in DB)
//   • qb-token-refresh   — Refresh expired access tokens
//   • qb-create-invoice  — Create invoice in QB from our DB
// ═══════════════════════════════════════════════════════════

// Client ID is safe to expose (it's like a public app identifier)
const QB_CLIENT_ID = 'ABb6oHW55FUHeHCIQcBOGBCGX8xclESOM50VqJeJDZoWYmRODn';
const QB_REDIRECT_URI = 'https://dispatch.anikalogistics.com/auth/quickbooks/callback';

// ─── Step 1: Generate OAuth URL — redirect user to QB login ───
// Only uses CLIENT_ID and REDIRECT_URI — both are safe to be public.

export function getQBAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: QB_CLIENT_ID,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: QB_REDIRECT_URI,
    state: crypto.randomUUID(),
  });
  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}
