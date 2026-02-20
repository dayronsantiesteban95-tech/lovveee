/**
 * Supabase Edge Function: qb-create-invoice
 *
 * Creates an invoice in QuickBooks Online using stored tokens.
 * Automatically refreshes access token if expired.
 * The client secret NEVER leaves the server.
 *
 * POST /functions/v1/qb-create-invoice
 * Body: { invoiceId: string }  -- our internal Supabase invoice UUID
 * Returns: { success: true, qbInvoiceId: string, qbInvoiceNumber: string } | { error: string }
 *
 * Deploy: supabase functions deploy qb-create-invoice
 * Secrets: supabase secrets set QB_CLIENT_ID=... QB_CLIENT_SECRET=...
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const QB_CLIENT_ID = Deno.env.get('QB_CLIENT_ID')!;
const QB_CLIENT_SECRET = Deno.env.get('QB_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const QB_ENV = 'sandbox';
const QB_BASE_URL =
  QB_ENV === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';

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

// -- Internal: refresh access token if expired --------------------------------

async function ensureFreshToken(
  supabase: ReturnType<typeof createClient>,
  tokenRow: {
    realm_id: string;
    access_token: string;
    refresh_token: string;
    access_token_expires_at: string;
    refresh_token_expires_at: string;
  }
): Promise<string> {
  // Return existing token if still valid (with 60s buffer)
  if (new Date(tokenRow.access_token_expires_at).getTime() > Date.now() + 60_000) {
    return tokenRow.access_token;
  }

  // Check refresh token not expired
  if (new Date(tokenRow.refresh_token_expires_at) < new Date()) {
    throw new Error('QuickBooks refresh token has expired. Please reconnect QuickBooks.');
  }

  // Refresh via Intuit -- secret stays server-side
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
        refresh_token: tokenRow.refresh_token,
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
    throw new Error(refreshed.error_description ?? refreshed.error ?? 'Token refresh failed');
  }

  if (!refreshed.access_token) {
    throw new Error('No access token returned on refresh');
  }

  // Persist refreshed tokens
  await supabase
    .from('quickbooks_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
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
    .eq('realm_id', tokenRow.realm_id);

  return refreshed.access_token;
}

// -- Internal: find or create QB customer -------------------------------------

async function findOrCreateCustomer(
  accessToken: string,
  realmId: string,
  clientName: string
): Promise<{ value: string; name: string }> {
  const safeName = clientName.replace(/'/g, "\\'");
  const query = `SELECT * FROM Customer WHERE DisplayName = '${safeName}'`;

  const queryRes = await fetch(
    `${QB_BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  const queryData = await queryRes.json() as {
    QueryResponse?: { Customer?: Array<{ Id: string; DisplayName: string }> };
  };

  if ((queryData?.QueryResponse?.Customer?.length ?? 0) > 0) {
    const c = queryData.QueryResponse!.Customer![0];
    return { value: c.Id, name: c.DisplayName };
  }

  // Create new customer
  const createRes = await fetch(`${QB_BASE_URL}/v3/company/${realmId}/customer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ Customer: { DisplayName: clientName } }),
  });

  const created = await createRes.json() as {
    Customer: { Id: string; DisplayName: string };
  };

  return { value: created.Customer.Id, name: created.Customer.DisplayName };
}

// -- Main handler -------------------------------------------------------------

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

    const body = await req.json() as { invoiceId?: string };
    const { invoiceId } = body;

    if (!invoiceId || typeof invoiceId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing required field: invoiceId' }), {
        status: 400,
        headers,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // -- 1. Load tokens --------------------------------------------------------
    const { data: tokenData, error: tokenError } = await supabase
      .from('quickbooks_tokens')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error('QuickBooks not connected. Please connect first.');
    }

    const tokenRow = tokenData as {
      realm_id: string;
      access_token: string;
      refresh_token: string;
      access_token_expires_at: string;
      refresh_token_expires_at: string;
      environment: string;
    };

    // -- 2. Ensure fresh access token (refresh if needed) ---------------------
    const accessToken = await ensureFreshToken(supabase, tokenRow);

    // -- 3. Load invoice + line items from Supabase ----------------------------
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found.');
    }

    const inv = invoice as {
      id: string;
      invoice_number: string;
      client_name: string;
      due_date: string;
      notes: string | null;
      quickbooks_invoice_id: string | null;
      invoice_line_items: Array<{
        id: string;
        description: string;
        subtotal: number;
        service_date: string | null;
      }>;
    };

    // -- 4. Find or create QB customer -----------------------------------------
    const customerRef = await findOrCreateCustomer(
      accessToken,
      tokenRow.realm_id,
      inv.client_name
    );

    // -- 5. Build QB invoice payload -------------------------------------------
    const lineItems = (inv.invoice_line_items ?? []).map((li, i) => ({
      Id: String(i + 1),
      LineNum: i + 1,
      Amount: li.subtotal,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: '1', name: 'Services' },
        Qty: 1,
        UnitPrice: li.subtotal,
        ServiceDate: li.service_date ?? new Date().toISOString().split('T')[0],
      },
      Description: li.description,
    }));

    const qbInvoicePayload = {
      DocNumber: inv.invoice_number,
      TxnDate: new Date().toISOString().split('T')[0],
      DueDate: inv.due_date,
      CustomerRef: customerRef,
      Line: lineItems,
      CustomerMemo: { value: inv.notes ?? '' },
      SalesTermRef: { value: '3' }, // Net 30
    };

    // -- 6. Create invoice in QB -----------------------------------------------
    const qbResponse = await fetch(
      `${QB_BASE_URL}/v3/company/${tokenRow.realm_id}/invoice`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ Invoice: qbInvoicePayload }),
      }
    );

    if (!qbResponse.ok) {
      const errorData = await qbResponse.json() as {
        Fault?: { Error?: Array<{ Message?: string }> };
      };
      throw new Error(
        errorData?.Fault?.Error?.[0]?.Message ?? `QB API error: ${qbResponse.status}`
      );
    }

    const qbResult = await qbResponse.json() as {
      Invoice: { Id: string; DocNumber: string };
    };

    const qbInvoiceId = qbResult.Invoice?.Id;
    const qbInvoiceNumber = qbResult.Invoice?.DocNumber;

    if (!qbInvoiceId) {
      throw new Error('QB returned no invoice ID -- sync may have failed.');
    }

    // -- 7. Update our DB with QB invoice info ---------------------------------
    await supabase
      .from('invoices')
      .update({
        quickbooks_invoice_id: qbInvoiceId,
        quickbooks_synced_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    // -- 8. Log the sync event -------------------------------------------------
    await supabase.from('quickbooks_sync_log').insert({
      invoice_id: invoiceId,
      qb_invoice_id: qbInvoiceId,
      qb_invoice_number: qbInvoiceNumber,
      status: 'success',
    });

    return new Response(
      JSON.stringify({ success: true, qbInvoiceId, qbInvoiceNumber }),
      { status: 200, headers }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('qb-create-invoice error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers }
    );
  }
});
