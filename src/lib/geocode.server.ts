/**
 * Reverse geocoding service. Uses the Google Maps connector when it is linked,
 * otherwise a public OpenStreetMap lookup, and finally falls back to the raw
 * coordinates so a report is never blocked by a geocoding outage.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

async function viaGoogle(lat: number, lng: number): Promise<string | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) return null;
  try {
    const res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?latlng=${lat},${lng}&result_type=street_address|premise|point_of_interest|neighborhood|sublocality`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
        },
      },
    );
    if (!res.ok) {
      console.error(`[geocode] Google gateway failed [${res.status}]: ${await res.text()}`);
      return null;
    }
    const body = (await res.json()) as { results?: Array<{ formatted_address?: string }> };
    return body.results?.[0]?.formatted_address ?? null;
  } catch (error) {
    console.error("[geocode] Google gateway error", error);
    return null;
  }
}

async function viaOpenStreetMap(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`,
      { headers: { "User-Agent": "NagarMitra/1.0 (municipal waste reporting)" } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { display_name?: string };
    return body.display_name ?? null;
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const name = (await viaGoogle(lat, lng)) ?? (await viaOpenStreetMap(lat, lng));
  return name?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
