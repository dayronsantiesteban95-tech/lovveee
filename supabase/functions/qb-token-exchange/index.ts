/**
 * Supabase Edge Function: qb-token-exchange
 *
 * Securely exchanges a QuickBooks OAuth authorization code for access/refresh tokens.
 * The client secret NEVER leaves the server — required by Intuit for production approval.
 *
 * POST /functions/v1/qb-token-exchange
 * Body: { code: string, realmId: string }
 * Returns: { success: true, realmId: string } | { error: string }
 *
 * Deploy: supabase functions deploy qb-token-exchange
 * Secrets: supabase secrets set QB_CLIENT_ID=... QB_CLIENT_SECRET=... QB_REDIRECT_URI=...
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const QB_CLIENT_ID = Deno.env.get('QB_CLIENT_ID')!;
const QB_CLIENT_SECRET = Deno.env.get('QB_CLIENT_SECRET')!;
const QB_REDIRECT_URI = Deno.env.get('QB_REDIRECT_URI')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = [
  'https://dispatch.anikalogistics.com',
  'http://localhost:5173',
  'http://localhost:8788',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    if (!QB_CLIENT_ID || !QB_CLIENT_SECRET || !QB_REDIRECT_URI) {
      throw new Error('QB credentials not configured. Run: supabase secrets set QB_CLIENT_ID=... QB_CLIENT_SECRET=... QB_REDIRECT_URI=...');
    }

    const body = await req.json() as { code?: string; realmId?: string };
    const { code, realmId } = body;

    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: code' }), {
        status: 400,
        headers,
      });
    }
    if (!realmId || typeof realmId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: realmId' }), {
        status: 400,
        headers,
      });
    }

    // Exchange authorization code for tokens using Basic auth (secret stays server-side)
    const credentials = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);
    const tokenResponse = await fetch(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: QB_REDIRECT_URI,
        }),
      }
    );

    const tokens = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      x_refresh_token_expires_in?: number;
      token_type?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || tokens.error) {
      throw new Error(tokens.error_description ?? tokens.error ?? `Intuit token exchange failed: ${tokenResponse.status}`);
    }

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Intuit returned incomplete token response');
    }

    // Store tokens in DB using service role (bypasses RLS) — tokens never returned to client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: upsertError } = await supabase
      .from('quickbooks_tokens')
      .upsert(
        {
          realm_id: realmId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          access_token_expires_at: new Date(
            Date.now() + (tokens.expires_in ?? 3600) * 1000
          ).toISOString(),
          // Refresh tokens last 100 days per Intuit spec
          refresh_token_expires_at: new Date(
            Date.now() + (tokens.x_refresh_token_expires_in ?? 8640000) * 1000
          ).toISOString(),
          environment: 'sandbox',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'realm_id' }
      );

    if (upsertError) {
      throw new Error(`Failed to store tokens: ${upsertError.message}`);
    }

    // Return success — tokens are NEVER sent back to the frontend
    return new Response(
      JSON.stringify({ success: true, realmId }),
      { status: 200, headers }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('qb-token-exchange error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers }
    );
  }
});
