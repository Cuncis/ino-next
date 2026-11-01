import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { quoteShipping, ShippingUnavailableError, type QuotableAddress } from "@/server/shipping/quote";
import { CartManager, deliveryBranch } from "@/server/shop/cart";
import { makeDraftAddress } from "@/server/shop/checkout";

/**
 * GET /checkout/ongkir (throttle:30,1): live courier quotes for the checkout's delivery
 * picker. Checkout never trusts a price from here; it quotes again before writing an
 * order. Ported from Shop\ShippingController::rates().
 */
export async function GET(request: Request) {
  const limited = await throttle("checkout-ongkir", 30, 1);

  if (limited) {
    return limited;
  }

  const data = await (await CartManager.current()).current();
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const filled = (value: string | undefined) => value !== undefined && value.trim() !== "";
  let address: QuotableAddress | null = data.address;

  // A saved address wins; otherwise the address still being typed arrives as query fields.
  if (!address && (filled(query.postalCode) || filled(query.latitude))) {
    const result = validate<{ postalCode: string | null; latitude: string | null; longitude: string | null }>(query, {
      postalCode: ["nullable", "string", "max:10"],
      latitude: ["nullable", "numeric", "between:-90,90"],
      longitude: ["nullable", "numeric", "between:-180,180"],
    });

    if (result.errors) {
      return validationErrorResponse(result.errors);
    }

    address = await makeDraftAddress(result.data);
  }

  if (!data.branch || !address) {
    return Response.json({ options: [] });
  }

  const origin = await deliveryBranch(data.branch, data.lines);

  if (!origin) {
    return Response.json({ options: [] });
  }

  try {
    return Response.json({ options: await quoteShipping(origin, address, data.lines) });
  } catch (error) {
    console.error(error);

    if (error instanceof ShippingUnavailableError) {
      return Response.json({ options: [], error: error.customerMessage }, { status: 422 });
    }

    return Response.json({ options: [], error: "Gagal memuat ongkos kirim. Coba lagi." }, { status: 502 });
  }
}
