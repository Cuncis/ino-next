import { cookies } from "next/headers";

/**
 * Where a shopper is, well enough to sort branches by distance. Ported from
 * App\Support\LocationPreference.
 *
 * Two ways in: the browser's geolocation (a lat/lng pair) or the manual fallback
 * picker (provinsi → kota → kecamatan). Laravel kept it in the session; here it is a
 * cookie with the same 120-minute lifetime, renewed on every request by `src/proxy.ts`.
 */
export const LOCATION_COOKIE = "shop_location";

/** Laravel's SESSION_LIFETIME. */
export const LOCATION_MAX_AGE_SECONDS = 120 * 60;

export type StoredLocation = {
  lat?: number;
  lng?: number;
  provinsi?: string;
  kota?: string;
  kecamatan?: string;
};

type Query = Record<string, string | string[] | undefined> | URLSearchParams;

function queryValue(query: Query | undefined, key: string): string | undefined {
  if (!query) {
    return undefined;
  }

  const value = query instanceof URLSearchParams ? query.get(key) : query[key];

  return (Array.isArray(value) ? value[0] : value) ?? undefined;
}

export function readStoredLocation(cookieStore: { get(name: string): { value: string } | undefined }): StoredLocation {
  try {
    const parsed: unknown = JSON.parse(cookieStore.get(LOCATION_COOKIE)?.value ?? "{}");

    return typeof parsed === "object" && parsed !== null ? (parsed as StoredLocation) : {};
  } catch {
    return {};
  }
}

/** PHP's is_numeric() for what arrives here: a finite number, or a numeric string. */
function isNumeric(value: unknown): boolean {
  return (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
}

/**
 * The coordinates to sort branches from: the request's own query string, else the saved
 * location, else none.
 */
export async function shopperCoordinates(query?: Query): Promise<{ lat: number; lng: number } | null> {
  const stored = readStoredLocation(await cookies());
  const lat = queryValue(query, "lat") ?? stored.lat;
  const lng = queryValue(query, "lng") ?? stored.lng;

  if (!isNumeric(lat) || !isNumeric(lng)) {
    return null;
  }

  return { lat: Number(lat), lng: Number(lng) };
}

/** The manual fallback area, when no coordinates are available. */
export async function shopperArea(query?: Query): Promise<{ provinsi: string | null; kota: string | null; kecamatan: string | null } | null> {
  const stored = readStoredLocation(await cookies());
  const provinsi = queryValue(query, "provinsi") ?? stored.provinsi ?? null;
  const kota = queryValue(query, "kota") ?? stored.kota ?? null;

  if (!provinsi && !kota) {
    return null;
  }

  return { provinsi, kota, kecamatan: queryValue(query, "kecamatan") ?? stored.kecamatan ?? null };
}

export const locationCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: LOCATION_MAX_AGE_SECONDS,
};
