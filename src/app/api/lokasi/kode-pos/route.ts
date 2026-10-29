import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { geocodePostalCode } from "@/server/shop/postal-code-geocoder";

/**
 * Looks a postal code up and answers with its point, for the pickup location popup.
 * Saving the point as the shopper's location is `POST /lokasi`.
 * Ported from BranchLocatorController::postalCode() (throttle:20,1).
 */
export async function GET(request: Request) {
  const limited = await throttle("kode-pos", 20, 1);

  if (limited) {
    return limited;
  }

  const result = validate<{ kode: string }>(Object.fromEntries(new URL(request.url).searchParams), { kode: ["required", "digits:5"] });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const point = await geocodePostalCode(String(result.data.kode));

  if (!point) {
    return Response.json({ message: "Kode pos tidak ditemukan." }, { status: 404 });
  }

  return Response.json(point);
}
