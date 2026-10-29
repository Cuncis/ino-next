import { cookies } from "next/headers";
import { csrfMismatchResponse, isSameOrigin, jsonBody } from "@/lib/http";
import { validate, validationErrorResponse } from "@/lib/validation";
import { LOCATION_COOKIE, locationCookieOptions } from "@/server/shop/location";

/**
 * Remembers where a shopper is (or which area they picked), so the branch picker
 * doesn't ask again on every visit. Ported from Shop\LocationController.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const result = validate<Record<string, string | number | null>>(await jsonBody(request), {
    lat: ["nullable", "numeric", "between:-90,90", "required_with:lng"],
    lng: ["nullable", "numeric", "between:-180,180", "required_with:lat"],
    provinsi: ["nullable", "string", "max:80"],
    kota: ["nullable", "string", "max:80", "required_with:provinsi"],
    kecamatan: ["nullable", "string", "max:80"],
  });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const location = Object.fromEntries(
    ["lat", "lng", "provinsi", "kota", "kecamatan"]
      .filter((field) => result.data[field] !== null && result.data[field] !== undefined)
      .map((field) => [field, result.data[field]]),
  );

  (await cookies()).set(LOCATION_COOKIE, JSON.stringify(location), locationCookieOptions);

  return respond(request);
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  (await cookies()).delete(LOCATION_COOKIE);

  return respond(request);
}

/** JSON for the storefront's fetch calls, else back to the page that sent the form. */
function respond(request: Request): Response {
  if (request.headers.get("accept")?.includes("application/json")) {
    return Response.json({ ok: true });
  }

  return Response.redirect(request.headers.get("referer") ?? new URL("/", request.url).toString(), 302);
}
