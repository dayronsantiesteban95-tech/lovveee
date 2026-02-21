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

// Generate a secure random UUID for CSRF protection
// Fallback to manual UUID generation for older browsers or when crypto is undefined
function generateSecureUUID() {
  // Modern browsers support crypto.randomUUID()
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (err) {
      console.warn('[QB Auth] crypto.randomUUID() failed, using fallback:', err);
    }
  }

  // Fallback: Generate UUID v4 manually (RFC 4122 compliant)
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // The '4' indicates UUID version 4 (random)
  // The 'y' is one of [8, 9, a, b] to set the variant bits correctly
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getQBAuthUrl() {
  const state = generateSecureUUID();

  // Store state in sessionStorage for CSRF validation in callback
  try {
    sessionStorage.setItem('qb_oauth_state', state);
  } catch (err) {
    console.error('[QB Auth] Failed to save state to sessionStorage:', err);
    throw new Error('Unable to initialize QuickBooks connection. Please enable cookies and try again.');
  }

  const params = new URLSearchParams({
    client_id: QB_CLIENT_ID,
    scope: QB_SCOPE,
    redirect_uri: QB_REDIRECT_URI,
    response_type: 'code',
    state: state,
  });

  return QB_AUTH_URL + '?' + params.toString();
}
