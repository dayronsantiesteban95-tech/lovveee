// -----------------------------------------------------------
// useQuickBooks -- QB connection + invoice sync hook
// Phase 2: Billing Module Integration
//
// SECURITY: All QB API calls (token refresh, invoice creation)
// are delegated to Supabase Edge Functions. No secrets in frontend.
// -----------------------------------------------------------
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getQBAuthUrl } from '@/lib/quickbooks';

export function useQuickBooks() {
  const [connected, setConnected] = useState(false);
  const [realmId, setRealmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    try {
      // Use maybeSingle to avoid throwing on no rows
      const { data } = await supabase
        .from('quickbooks_tokens')
        .select('realm_id, access_token_expires_at, refresh_token_expires_at')
        .limit(1)
        .maybeSingle();
      // A token row exists but both tokens could be expired.
      // The access token is refreshable as long as the refresh token is valid.
      // Only mark as disconnected if the refresh token has expired.
      const tokenData = data as {
        realm_id: string;
        access_token_expires_at?: string;
        refresh_token_expires_at?: string;
      } | null;
      const isConnected = !!tokenData && (
        !tokenData.refresh_token_expires_at ||
        new Date(tokenData.refresh_token_expires_at).getTime() > Date.now()
      );
      setConnected(isConnected);
      setRealmId(tokenData?.realm_id ?? null);
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
    // Delete all token rows for this realm (or all if no realm known)
    if (realmId) {
      await supabase.from('quickbooks_tokens').delete().eq('realm_id', realmId);
    } else {
      await supabase.from('quickbooks_tokens').delete().gt('created_at', '1970-01-01');
    }
    setConnected(false);
    setRealmId(null);
  };

  const syncInvoice = async (
    invoiceId: string
  ): Promise<{ qbInvoiceId: string; qbInvoiceNumber: string }> => {
    // Delegate entirely to the server-side Edge Function.
    // It handles: token load, refresh-if-expired, QB API call, DB update.
    const response = await supabase.functions.invoke('qb-create-invoice', {
      body: { invoiceId },
    });

    if (response.error) {
      throw new Error(response.error.message ?? 'Invoice sync failed');
    }

    const data = response.data as {
      success?: boolean;
      qbInvoiceId?: string;
      qbInvoiceNumber?: string;
      error?: string;
    } | null;

    if (data?.error) {
      throw new Error(data.error);
    }

    if (!data?.success || !data.qbInvoiceId) {
      throw new Error('QB returned no invoice ID -- sync may have failed.');
    }

    return {
      qbInvoiceId: data.qbInvoiceId,
      qbInvoiceNumber: data.qbInvoiceNumber ?? '',
    };
  };

  return { connected, realmId, loading, connect, disconnect, syncInvoice, checkConnection };
}
