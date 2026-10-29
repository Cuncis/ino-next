/**
 * Order status flows, ported from the Laravel app's App\Models\Order.
 *
 * Delivery (antar) and pickup (ambil) move through different statuses; either can
 * end as dibatalkan, or kedaluwarsa when a payment or pickup deadline runs out.
 * There is no "diproses" any more. Use `statusesFor()` instead of repeating lists.
 */

export type Fulfilment = "antar" | "ambil";

export const FLOW_DELIVERY = ["menunggu pembayaran", "pembayaran diterima", "siap dikirim", "dikirim", "selesai"] as const;

export const FLOW_PICKUP = ["menunggu pembayaran", "pembayaran diterima", "siap diambil", "selesai"] as const;

/** Statuses that only exist once the customer has paid. */
export const PAID_STATUSES = ["pembayaran diterima", "siap dikirim", "siap diambil", "dikirim", "selesai"] as const;

export const END_STATUSES = ["dibatalkan", "kedaluwarsa"] as const;

export type OrderStatus = (typeof FLOW_DELIVERY)[number] | (typeof FLOW_PICKUP)[number] | (typeof END_STATUSES)[number];

export type PaymentStatus = "belum bayar" | "lunas" | "gagal" | "refund";

/** Every status an order with this fulfilment can have, in flow order. */
export function statusesFor(fulfilment: string): OrderStatus[] {
  return [...(fulfilment === "ambil" ? FLOW_PICKUP : FLOW_DELIVERY), ...END_STATUSES];
}

/**
 * The payment status that goes with a hand-set order status: any paid status is
 * lunas, a refund is never undone, a cancelled or expired order keeps its payment status.
 */
export function paymentStatusFor(status: string, current: string | null = null): string {
  if (current === "refund") {
    return "refund";
  }

  if ((PAID_STATUSES as readonly string[]).includes(status)) {
    return "lunas";
  }

  if ((END_STATUSES as readonly string[]).includes(status)) {
    return current ?? "belum bayar";
  }

  return "belum bayar";
}
