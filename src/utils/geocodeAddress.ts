const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_KEY || !address) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };
    if (data.status === "OK" && data.results[0]) {
      return data.results[0].geometry.location;
    }
  } catch {
    return null;
  }
  return null;
}
