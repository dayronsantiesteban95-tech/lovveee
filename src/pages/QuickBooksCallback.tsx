// ═══════════════════════════════════════════════════════════
// QuickBooks OAuth Callback Page
// Route: /auth/quickbooks/callback (PUBLIC — no auth required)
// QB redirects here after user authorizes the app.
//
// SECURITY: Token exchange is handled server-side via the
// qb-token-exchange Supabase Edge Function. The client secret
// never touches the browser.
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function QuickBooksCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    'processing'
  );
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');

    if (!code || !realmId) {
      setStatus('error');
      setError('Missing authorization code or realm ID from QuickBooks.');
      return;
    }

    // ── CSRF State Validation ──────────────────────────────────────────────
    // Verify the state param returned by QB matches what we stored when
    // initiating the OAuth flow. This prevents CSRF / open-redirect attacks.
    const returnedState = searchParams.get('state');
    const expectedState = sessionStorage.getItem('qb_oauth_state');
    if (!returnedState || !expectedState || returnedState !== expectedState) {
      setStatus('error');
      setError('Security validation failed. Please try connecting QuickBooks again.');
      return;
    }
    sessionStorage.removeItem('qb_oauth_state');
    // ─────────────────────────────────────────────────────────────────────

    const handleCallback = async () => {
      try {
        // Delegate token exchange to the server-side Edge Function.
        // The client secret lives in Supabase secrets — never in the bundle.
        const response = await supabase.functions.invoke('qb-token-exchange', {
          body: { code, realmId },
        });

        if (response.error) {
          throw new Error(response.error.message ?? 'Token exchange failed');
        }

        const data = response.data as { success?: boolean; error?: string } | null;

        if (data?.error) {
          throw new Error(data.error);
        }

        if (!data?.success) {
          throw new Error('Unexpected response from token exchange function.');
        }

        setStatus('success');
        // Redirect back to Billing after 2s
        setTimeout(() => navigate('/billing'), 2000);
      } catch (e: unknown) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Unknown error occurred');
      }
    };

    void handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm px-4">
        {status === 'processing' && (
          <>
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-lg font-semibold">Connecting QuickBooks…</p>
            <p className="text-muted-foreground text-sm">
              Exchanging authorization code for tokens…
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-5xl">✅</div>
            <p className="text-lg font-semibold text-green-700">
              QuickBooks Connected!
            </p>
            <p className="text-muted-foreground text-sm">
              Redirecting to Billing…
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-5xl">❌</div>
            <p className="text-lg font-semibold text-destructive">
              Connection Failed
            </p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <button
              onClick={() => navigate('/billing')}
              className="text-primary underline text-sm mt-2 block mx-auto"
            >
              ← Go back to Billing
            </button>
          </>
        )}
      </div>
    </div>
  );
}
