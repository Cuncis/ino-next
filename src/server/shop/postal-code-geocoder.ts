import { redis } from "@/lib/redis";

/**
 * Turns an Indonesian postal code into a point on the map, so "Kode pos" in the pickup
 * location popup can sort branches by distance. Ported from
 * App\Support\Geocoding\PostalCodeGeocoder.
 *
 * Uses Nominatim (OpenStreetMap), free and keyless; its usage policy asks for an
 * identifying User-Agent and at most one request a second, so answers are cached for a
 * month (a postal code does not move) and the route is throttled. A failed lookup isn't
 * cached, like Laravel's Cache::remember() with a null result.
 */
const CACHE_SECONDS = 30 * 24 * 60 * 60;

export type GeocodedPoint = { lat: number; lng: number; label: string };

export async function geocodePostalCode(postalCode: string): Promise<GeocodedPoint | null> {
  if (!/^\d{5}$/.test(postalCode)) {
    return null;
  }

  const key = `geocode:kodepos:${postalCode}`;
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as GeocodedPoint;
  }

  const point = await lookUp(postalCode);

  if (point) {
    await redis.set(key, JSON.stringify(point), "EX", CACHE_SECONDS);
  }

  return point;
}

async function lookUp(postalCode: string): Promise<GeocodedPoint | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");

  url.search = new URLSearchParams({ format: "json", limit: "1", postalcode: postalCode, countrycodes: "id" }).toString();

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Inofarma-Geocoder/1.0 (storefront pickup locations)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return null;
    }

    const [result] = (await response.json()) as { lat: string; lon: string; display_name?: string }[];

    return result ? { lat: Number(result.lat), lng: Number(result.lon), label: String(result.display_name ?? postalCode) } : null;
  } catch {
    return null;
  }
}
