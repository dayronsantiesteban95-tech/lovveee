import { supabase } from '@/integrations/supabase/client';

/**
 * Send push notification to drivers by their driver_id (UUID).
 * Looks up the OneSignal device_token from the drivers table,
 * then calls the Edge Function with the actual player IDs.
 */
export async function sendPushToDrivers(
  driverIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!driverIds.length) return;

  // Look up device tokens from the drivers table
  const { data: drivers, error: lookupError } = await supabase
    .from('drivers')
    .select('id, device_token')
    .in('id', driverIds);

  if (lookupError) {
    console.warn('[sendPushToDrivers] Driver lookup failed:', lookupError.message);
    return;
  }

  // Filter to drivers with a device token
  const playerIds = (drivers ?? [])
    .map((d) => d.device_token)
    .filter((token): token is string => !!token);

  if (!playerIds.length) {
    console.warn('[sendPushToDrivers] No device tokens found for drivers:', driverIds);
    return;
  }

  const { error } = await supabase.functions.invoke('send-push-notification', {
    body: { playerIds, title, body, data },
  });
  if (error) throw new Error(`Push notification failed: ${error.message}`);
}
