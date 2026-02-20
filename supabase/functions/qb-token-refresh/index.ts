/**
 * Supabase Edge Function: qb-token-refresh
 *
 * Refreshes an expired QuickBooks access token using the stored refresh token.
 * The client secret NEVER leaves the server.
 *
 * POST /functions/v1/qb-token-refresh
 * Body: { realmId: string }
 * Returns: { success: true } | { error: string }
 *
 * Deploy: supabase functions deploy qb-token-refresh
 * Secrets: supabase secrets set QB_CLIENT_ID=... QB_CLIENT_SECRET=...
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const QB_CLIENT_ID = Deno.env.get('QB_CLIENT_ID')!;
const QB_CLIENT_SECRET = Deno.env.get('QB_CLIENT_SECRET')!;
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
    if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
      throw new Error('QB credentials not configured');
    }

    const body = await req.json() as { realmId?: string };
    const { realmId } = body;

    if (!realmId || typeof realmId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: realmId' }), {
        status: 400,
        headers,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load current refresh token from DB
    const { data: tokenData, error: fetchError } = await supabase
      .from('quickbooks_tokens')
      .select('refresh_token, refresh_token_expires_at')
      .eq('realm_id', realmId)
      .maybeSingle();

    if (fetchError || !tokenData) {
      throw new Error('No QuickBooks tokens found for this realm. Please reconnect.');
    }

    const token = tokenData as {
      refresh_token: string;
      refresh_token_expires_at: string;
    };

    // Check if refresh token itself is expired (100 day limit from Intuit)
    if (new Date(token.refresh_token_expires_at) < new Date()) {
      throw new Error('QuickBooks refresh token has expired. Please reconnect QuickBooks.');
    }

    // Refresh using Basic auth -- secret stays server-side
    const credentials = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);
    const refreshResponse = await fetch(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token,
        }),
      }
    );

    const refreshed = await refreshResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      x_refresh_token_expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!refreshResponse.ok || refreshed.error) {
      throw new Error(refreshed.error_description ?? refreshed.error ?? `Token refresh failed: ${refreshResponse.status}`);
    }

    if (!refreshed.access_token) {
      throw new Error('Intuit returned no access token on refresh');
    }

    // Update tokens in DB -- never return to frontend
    const { error: updateError } = await supabase
      .from('quickbooks_tokens')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? token.refresh_token,
        access_token_expires_at: new Date(
          Date.now() + (refreshed.expires_in ?? 3600) * 1000
        ).toISOString(),
        ...(refreshed.x_refresh_token_expires_in
          ? {
              refresh_token_expires_at: new Date(
                Date.now() + refreshed.x_refresh_token_expires_in * 1000
              ).toISOString(),
            }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('realm_id', realmId);

    if (updateError) {
      throw new Error(`Failed to update tokens: ${updateError.message}`);
    }

    // Return success only -- tokens never leave the server
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('qb-token-refresh error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers }
    );
  }
});
