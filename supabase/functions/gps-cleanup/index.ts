// GPS Cleanup Edge Function
// Deletes driver_locations rows older than 2 hours
// Intended to be called every 30 minutes via OpenClaw cron or Supabase cron
// Backup to pg_cron in case it's not available

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST or GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Use service role to bypass RLS -- this is an admin cleanup task
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

    const { error, count } = await supabase
      .from('driver_locations')
      .delete({ count: 'exact' })
      .lt('recorded_at', cutoff);

    if (error) {
      console.error('[gps-cleanup] Delete error:', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = {
      success: true,
      deleted: count ?? 0,
      cutoff,
      timestamp: new Date().toISOString(),
    };

    console.log('[gps-cleanup] Cleaned up GPS pings:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gps-cleanup] Unexpected error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
