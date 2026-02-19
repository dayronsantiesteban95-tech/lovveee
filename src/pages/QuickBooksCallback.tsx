// ═══════════════════════════════════════════════════════════
// QuickBooks OAuth Callback Page
// Route: /auth/quickbooks/callback (PUBLIC — no auth required)
// QB redirects here after user authorizes the app
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { exchangeQBCode } from '@/lib/quickbooks';

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

    const handleCallback = async () => {
      try {
        const tokens = await exchangeQBCode(code, realmId);

        if (tokens.error) {
          throw new Error(tokens.error_description ?? tokens.error);
        }

        if (!tokens.access_token) {
          throw new Error('No access token returned from QuickBooks.');
        }

        // Store tokens in Supabase quickbooks_tokens table
        // @ts-ignore — table added via migration
        const { error: upsertError } = await supabase
          .from('quickbooks_tokens')
          .upsert(
            {
              realm_id: realmId,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              access_token_expires_at: new Date(
                Date.now() + tokens.expires_in * 1000
              ).toISOString(),
              // Refresh tokens last 100 days per Intuit spec
              refresh_token_expires_at: new Date(
                Date.now() + 100 * 24 * 60 * 60 * 1000
              ).toISOString(),
              environment: 'sandbox',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'realm_id' }
          );

        if (upsertError) {
          throw new Error(`Failed to store tokens: ${upsertError.message}`);
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
