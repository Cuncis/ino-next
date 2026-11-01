import { geocodePostalCode } from "@/server/shop/postal-code-geocoder";
import type { Branch, CartLine } from "@/server/shop/cart";
import { BiteshipClient } from "./biteship-client";

/**
 * Turns a branch, a delivery address and a cart's lines into the courier options a
 * customer can pick at checkout: a live Biteship rates call from the branch's own
 * coordinates (never one central warehouse), so instant couriers quote correctly.
 * Ported from App\Support\Shipping\ShippingQuoteService.
 */
export type CourierQuote = {
  courierCompany: string;
  courierType: string;
  courierName: string;
  serviceName: string;
  price: number;
  duration: string | null;
};

/** Where an address's map point and postal code are read from (a saved or a typed address). */
export type QuotableAddress = { id?: number; latitude: string | number | null; longitude: string | number | null; postalCode: string | null };

/**
 * Shipping can't be priced because data is missing on our side, found before Biteship is
 * called: `message` is for staff and the log, `customerMessage` is safe to show a shopper.
 */
export class ShippingUnavailableError extends Error {
  constructor(
    message: string,
    readonly customerMessage: string,
  ) {
    super(message);
  }
}

/** Biteship needs a weight for every item; one with none is quoted at the configured default. */
export function shippingWeightGrams(weightGrams: number): number {
  return weightGrams > 0 ? weightGrams : Math.max(1, Math.trunc(Number(process.env.BITESHIP_DEFAULT_ITEM_WEIGHT ?? 200)) || 200);
}

export async function quoteShipping(branch: Branch, address: QuotableAddress, lines: CartLine[], client = BiteshipClient.fromConfig()): Promise<CourierQuote[]> {
  if (branch.latitude === null || branch.longitude === null) {
    throw new ShippingUnavailableError(
      `Koordinat ${branch.name} belum diisi, jadi ongkos kirim tidak bisa dihitung. Isi di admin: Cabang > Ubah.`,
      "Pengiriman dari cabang ini belum tersedia. Pilih Ambil di toko atau coba lagi nanti.",
    );
  }

  await locateByPostalCode(address);

  if (address.latitude === null || address.longitude === null) {
    throw new ShippingUnavailableError(
      `Alamat pengiriman #${address.id ?? ""} belum punya titik peta (latitude/longitude).`,
      'Alamat ini belum punya titik lokasi di peta. Perbarui alamat dengan "Gunakan lokasi saya", lalu coba lagi.',
    );
  }

  const pricing = await client.rates({
    origin_latitude: Number(branch.latitude),
    origin_longitude: Number(branch.longitude),
    destination_latitude: Number(address.latitude),
    destination_longitude: Number(address.longitude),
    items: lines.map(({ product, quantity }) => ({
      name: product.name,
      value: product.price,
      quantity,
      weight: shippingWeightGrams(product.weightGrams),
      height: product.heightCm,
      length: product.lengthCm,
      width: product.widthCm,
    })),
  });

  const text = (value: unknown) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));

  return pricing
    .map((option) => ({
      courierCompany: text(option.company),
      courierType: text(option.type),
      courierName: text(option.courier_name ?? option.company),
      serviceName: text(option.courier_service_name),
      price: Math.trunc(Number(option.price ?? 0)) || 0,
      duration: option.duration === null || option.duration === undefined ? null : text(option.duration),
    }))
    .filter((option) => option.courierCompany !== "" && option.courierType !== "")
    .map((option, index) => ({ option, index }))
    // a stable sort by price, like Laravel's sortBy()
    .sort((a, b) => a.option.price - b.option.price || a.index - b.index)
    .map(({ option }) => option);
}

/**
 * An address without a map point falls back to its postal code (approximate, but enough
 * to price a ride). The point is set on the object in memory, never saved: the order
 * snapshots it, while the shopper's saved address stays unpinned until they pin it.
 */
async function locateByPostalCode(address: QuotableAddress): Promise<void> {
  if ((address.latitude !== null && address.longitude !== null) || !address.postalCode?.trim()) {
    return;
  }

  const point = await geocodePostalCode(address.postalCode);

  if (point) {
    address.latitude = point.lat;
    address.longitude = point.lng;
  }
}
