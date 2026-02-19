// OneSignal REST API — called from Dispatcher App when blasting loads
export async function sendPushToDrivers(
  driverIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  const apiKey = import.meta.env.VITE_ONESIGNAL_API_KEY;

  if (!appId || !apiKey) {
    console.warn('OneSignal not configured — push notification skipped');
    return;
  }

  const payload = {
    app_id: appId,
    filters: driverIds.map((id, i) => [
      ...(i > 0 ? [{ operator: 'OR' }] : []),
      { field: 'tag', key: 'driver_id', relation: '=', value: id }
    ]).flat(),
    headings: { en: title },
    contents: { en: body },
    data: data ?? {},
  };

  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}
