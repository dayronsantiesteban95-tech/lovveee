import { supabase } from '@/integrations/supabase/client';

export async function sendPushToDrivers(
  playerIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!playerIds.length) return;
  const { error } = await supabase.functions.invoke('send-push-notification', {
    body: { playerIds, title, body, data },
  });
  if (error) throw new Error(`Push notification failed: ${error.message}`);
}
