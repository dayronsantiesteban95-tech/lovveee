// ═══════════════════════════════════════════════════════════
// QUICKBOOKS ONLINE — OAuth + Invoice Sync Library
// Phase 2: Billing Module Integration
// ═══════════════════════════════════════════════════════════

const QB_CLIENT_ID = (import.meta.env.VITE_QB_CLIENT_ID as string)?.trim() || 'ABb6oHW55FUHeHCIQcBOGBCGX8xclESOM50VqJeJDZoWYmRODn';
const QB_CLIENT_SECRET = (import.meta.env.VITE_QB_CLIENT_SECRET as string)?.trim() || 'HItkf0Q1jQF6UbObPRmTMcpFTQRIXWE5Cqov5ohl';
const QB_REDIRECT_URI = (import.meta.env.VITE_QB_REDIRECT_URI as string)?.trim() || 'https://dispatch.anikalogistics.com/auth/quickbooks/callback';
const QB_ENV = ((import.meta.env.VITE_QB_ENVIRONMENT as string)?.trim()) || 'sandbox';
const QB_BASE_URL =
  QB_ENV === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';

// ─── Types ────────────────────────────────────────────────

export interface QBTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
  error?: string;
  error_description?: string;
}

export interface QBCustomerRef {
  value: string;
  name: string;
}

export interface QBInvoiceInput {
  invoiceNumber: string;
  clientName: string;
  lineItems: Array<{
    description: string;
    amount: number;
    serviceDate: string;
  }>;
  dueDate: string;
  notes?: string;
}

// ─── Step 1: Generate OAuth URL — redirect user to QB login ───

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

// ─── Step 2: Exchange auth code for tokens ─────────────────

export async function exchangeQBCode(
  code: string,
  _realmId: string
): Promise<QBTokenResponse> {
  const credentials = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);
  const response = await fetch(
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
  return response.json() as Promise<QBTokenResponse>;
}

// ─── Step 3: Refresh access token ─────────────────────────

export async function refreshQBToken(
  refreshToken: string
): Promise<QBTokenResponse> {
  const credentials = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);
  const response = await fetch(
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    }
  );
  return response.json() as Promise<QBTokenResponse>;
}

// ─── Step 4: Find or create QB customer by name ────────────

async function findOrCreateQBCustomer(
  accessToken: string,
  realmId: string,
  clientName: string
): Promise<QBCustomerRef> {
  // Query existing customer — escape single quotes for QB SQL
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
  const queryData = (await queryRes.json()) as {
    QueryResponse?: { Customer?: Array<{ Id: string; DisplayName: string }> };
  };

  if ((queryData?.QueryResponse?.Customer?.length ?? 0) > 0) {
    const c = queryData.QueryResponse!.Customer![0];
    return { value: c.Id, name: c.DisplayName };
  }

  // Create new customer
  const createRes = await fetch(
    `${QB_BASE_URL}/v3/company/${realmId}/customer`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ Customer: { DisplayName: clientName } }),
    }
  );
  const created = (await createRes.json()) as {
    Customer: { Id: string; DisplayName: string };
  };
  return {
    value: created.Customer.Id,
    name: created.Customer.DisplayName,
  };
}

// ─── Step 5: Create invoice in QB ─────────────────────────

export async function createQBInvoice(
  accessToken: string,
  realmId: string,
  invoice: QBInvoiceInput
): Promise<{ Invoice: { Id: string; DocNumber: string } }> {
  // First find or create customer
  const customerRef = await findOrCreateQBCustomer(
    accessToken,
    realmId,
    invoice.clientName
  );

  const qbInvoice = {
    DocNumber: invoice.invoiceNumber,
    TxnDate: new Date().toISOString().split('T')[0],
    DueDate: invoice.dueDate,
    CustomerRef: customerRef,
    Line: invoice.lineItems.map((item, i) => ({
      Id: String(i + 1),
      LineNum: i + 1,
      Amount: item.amount,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: '1', name: 'Services' },
        Qty: 1,
        UnitPrice: item.amount,
        ServiceDate: item.serviceDate,
      },
      Description: item.description,
    })),
    CustomerMemo: { value: invoice.notes ?? '' },
    SalesTermRef: { value: '3' }, // Net 30
  };

  const response = await fetch(
    `${QB_BASE_URL}/v3/company/${realmId}/invoice`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ Invoice: qbInvoice }),
    }
  );

  if (!response.ok) {
    const errorData = (await response.json()) as {
      Fault?: { Error?: Array<{ Message?: string }> };
    };
    throw new Error(
      errorData?.Fault?.Error?.[0]?.Message ?? 'QB invoice creation failed'
    );
  }

  return response.json() as Promise<{
    Invoice: { Id: string; DocNumber: string };
  }>;
}
