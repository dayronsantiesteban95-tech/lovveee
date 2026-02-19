// ═══════════════════════════════════════════════════════════
// useQuickBooks — QB connection + invoice sync hook
// Phase 2: Billing Module Integration
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getQBAuthUrl, refreshQBToken, createQBInvoice } from '@/lib/quickbooks';

interface QBTokenRow {
  id: string;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  environment: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  client_name: string;
  due_date: string;
  notes: string | null;
  quickbooks_invoice_id: string | null;
  quickbooks_synced_at: string | null;
  invoice_line_items: Array<{
    id: string;
    description: string;
    subtotal: number;
    service_date: string | null;
  }>;
}

export function useQuickBooks() {
  const [connected, setConnected] = useState(false);
  const [realmId, setRealmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    try {
      // Use maybeSingle to avoid throwing on no rows
      const { data } = await (supabase as ReturnType<typeof supabase.from>)
        // @ts-ignore — dynamic table not in generated types yet
        .from('quickbooks_tokens')
        .select('realm_id, access_token_expires_at')
        .limit(1)
        .maybeSingle();
      setConnected(!!data);
      setRealmId((data as { realm_id: string } | null)?.realm_id ?? null);
    } catch {
      setConnected(false);
      setRealmId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const connect = () => {
    window.location.href = getQBAuthUrl();
  };

  const disconnect = async () => {
    // @ts-ignore — dynamic table
    await supabase.from('quickbooks_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setConnected(false);
    setRealmId(null);
  };

  const syncInvoice = async (invoiceId: string): Promise<{ qbInvoiceId: string; qbInvoiceNumber: string }> => {
    // ── 1. Get stored tokens ──────────────────────────────
    // @ts-ignore — dynamic table
    const { data: tokenData, error: tokenError } = await supabase
      .from('quickbooks_tokens')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error('QuickBooks not connected. Please connect first.');
    }

    const token = tokenData as QBTokenRow;
    let accessToken = token.access_token;

    // ── 2. Refresh access token if expired ────────────────
    if (new Date(token.access_token_expires_at) < new Date()) {
      const refreshed = await refreshQBToken(token.refresh_token);
      if (refreshed.error) {
        throw new Error(refreshed.error_description ?? 'Token refresh failed — please reconnect QuickBooks.');
      }
      accessToken = refreshed.access_token;
      // @ts-ignore — dynamic table
      await supabase
        .from('quickbooks_tokens')
        .update({
          access_token: refreshed.access_token,
          access_token_expires_at: new Date(
            Date.now() + refreshed.expires_in * 1000
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('realm_id', token.realm_id);
    }

    // ── 3. Load invoice + line items from Supabase ────────
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found.');
    }

    const inv = invoice as unknown as InvoiceRow;

    // ── 4. Push invoice to QuickBooks ─────────────────────
    const result = await createQBInvoice(accessToken, token.realm_id, {
      invoiceNumber: inv.invoice_number,
      clientName: inv.client_name,
      lineItems: (inv.invoice_line_items ?? []).map((li) => ({
        description: li.description,
        amount: li.subtotal,
        serviceDate:
          li.service_date ?? new Date().toISOString().split('T')[0],
      })),
      dueDate: inv.due_date,
      notes: inv.notes ?? undefined,
    });

    const qbInvoiceId = result.Invoice?.Id;
    const qbInvoiceNumber = result.Invoice?.DocNumber;

    if (!qbInvoiceId) {
      throw new Error('QB returned no invoice ID — sync may have failed.');
    }

    // ── 5. Update invoice record with QB info ─────────────
    await supabase
      .from('invoices')
      .update({
        // @ts-ignore — columns added via migration, not in generated types yet
        quickbooks_invoice_id: qbInvoiceId,
        quickbooks_synced_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    // ── 6. Log the sync event ─────────────────────────────
    // @ts-ignore — dynamic table
    await supabase.from('quickbooks_sync_log').insert({
      invoice_id: invoiceId,
      qb_invoice_id: qbInvoiceId,
      qb_invoice_number: qbInvoiceNumber,
      status: 'success',
    });

    return { qbInvoiceId, qbInvoiceNumber };
  };

  return { connected, realmId, loading, connect, disconnect, syncInvoice, checkConnection };
}
