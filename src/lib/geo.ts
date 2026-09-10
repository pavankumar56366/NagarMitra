/** Geographic helpers shared by report validation and worker completion checks. */

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres between two coordinates. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rough bounding box around a point, used to pre-filter database rows. */
export function boundingBox(lat: number, lng: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/** Bit difference between two hex perceptual hashes; 64 means "nothing alike". */
export function hammingDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      diff += x & 1;
      x >>= 1;
    }
  }
  return diff;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
