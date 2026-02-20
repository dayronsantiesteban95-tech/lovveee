// -----------------------------------------------------------
// QUICKBOOKS ONLINE -- OAuth Helper (Frontend-safe)
// Phase 2: Billing Module Integration
//
// SECURITY: QB_CLIENT_SECRET has been removed from frontend code.
// Token exchange, refresh, and invoice creation are handled
// server-side in Supabase Edge Functions:
//   * qb-token-exchange  -- OAuth code -> tokens (stored in DB)
//   * qb-token-refresh   -- Refresh expired access tokens
//   * qb-create-invoice  -- Create invoice in QB from our DB
// -----------------------------------------------------------

// Client ID is safe to expose (it's like a public app identifier)
// Read from env var; fallback keeps existing deployments working.
const QB_CLIENT_ID =
  import.meta.env.VITE_QB_CLIENT_ID ??
  'ABb6oHW55FUHeHCIQcBOGBCGX8xclESOM50VqJeJDZoWYmRODn';
const QB_REDIRECT_URI =
  import.meta.env.VITE_QB_REDIRECT_URI ??
  'https://dispatch.anikalogistics.com/auth/quickbooks/callback';

const QB_SCOPE = 'com.intuit.quickbooks.accounting';
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';

// --- Step 1: Generate OAuth URL -- redirect user to QB login ---
// Only uses CLIENT_ID and REDIRECT_URI -- both are safe to be public.
// State is stored in sessionStorage so the callback can validate it (CSRF protection).

export function getQBAuthUrl(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem('qb_oauth_state', state);
  const params = new URLSearchParams({
    client_id: QB_CLIENT_ID,
    scope: QB_SCOPE,
    redirect_uri: QB_REDIRECT_URI,
    response_type: 'code',
    state,
  });
  return `${QB_AUTH_URL}?${params.toString()}`;
}
