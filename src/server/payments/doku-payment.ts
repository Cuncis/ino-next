import { randomUUID } from "node:crypto";
import { asc, count, eq } from "drizzle-orm";
import { customers, db, orderItems, orders, payments } from "@/db";
import { normalizePhone } from "@/lib/phone";
import { DokuClient } from "./doku-client";

/**
 * One order's relationship with DOKU, ported from App\Support\Payments\DokuPaymentService.
 * This step brings opening a checkout session; folding notifications back into the
 * order (webhook, reconcile) comes with the payment webhooks (step 5).
 */
type Order = typeof orders.$inferSelect;
type Payment = typeof payments.$inferSelect;

/** Comma-separated in DOKU_PAYMENT_METHODS; by default virtual accounts, QRIS and e-wallets only. */
const DEFAULT_PAYMENT_METHODS =
  "VIRTUAL_ACCOUNT_BCA,VIRTUAL_ACCOUNT_BANK_MANDIRI,VIRTUAL_ACCOUNT_BRI,VIRTUAL_ACCOUNT_BNI,VIRTUAL_ACCOUNT_BANK_PERMATA,VIRTUAL_ACCOUNT_DOKU,QRIS,EMONEY_OVO,EMONEY_DANA,EMONEY_SHOPEEPAY";

export function dokuPaymentMethods(): string[] {
  return (process.env.DOKU_PAYMENT_METHODS || DEFAULT_PAYMENT_METHODS)
    .split(",")
    .map((method) => method.trim())
    .filter((method) => method !== "");
}

function orderUrl(order: Pick<Order, "number">): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/pesanan/${encodeURIComponent(order.number)}`;
}

/**
 * Opens a DOKU Checkout session for an order and records the attempt. Runs outside any
 * transaction on purpose: an outside HTTP call shouldn't hold row locks, and if DOKU
 * fails, the order the customer already has must not disappear with it.
 *
 * @throws Error on a DOKU-side failure; the order stands so the caller can offer a retry
 */
export async function createPaymentForOrder(order: Order, client = DokuClient.fromConfig()): Promise<Payment> {
  const [[customer], items, [{ attempts }]] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1),
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id)),
    db.select({ attempts: count() }).from(payments).where(eq(payments.orderId, order.id)),
  ]);

  const attempt = attempts + 1;
  const invoiceNumber = attempt === 1 ? order.number : `${order.number}-R${attempt}`;
  const requestId = randomUUID();
  const minutes = order.expiresAt ? Math.max(Math.trunc((order.expiresAt.getTime() - Date.now()) / 60_000), 5) : 1440;

  const body = {
    order: {
      amount: order.grandTotal,
      invoice_number: invoiceNumber,
      currency: "IDR",
      callback_url: orderUrl(order),
      callback_url_cancel: orderUrl(order),
      callback_url_result: orderUrl(order),
      line_items: lineItems(order, items),
    },
    payment: {
      payment_due_date: Math.min(minutes, 999999),
      payment_method_types: dokuPaymentMethods(),
    },
    customer: {
      id: customer.code,
      name: order.recipientName ?? customer.name,
      // stored numbers are local (0812...); DOKU wants digits-only international (62812...)
      phone: normalizePhone(order.recipientPhone ?? customer.phone ?? ""),
      email: customer.email,
    },
  };

  const response = await client.createPayment(body, requestId);
  const payment = ((response.response as { payment?: Record<string, unknown> } | undefined)?.payment ?? {}) as { token_id?: string; url?: string };
  const now = new Date();

  const [created] = await db
    .insert(payments)
    .values({
      orderId: order.id,
      gateway: "doku",
      invoiceNumber,
      status: "pending",
      amount: order.grandTotal,
      requestId,
      tokenId: payment.token_id ?? null,
      checkoutUrl: payment.url ?? null,
      expiresAt: order.expiresAt,
      rawResponse: response,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

/**
 * DOKU refuses a session ("AMOUNT NOT MATCH") unless the lines add up to exactly the
 * order amount. Shipping and tax become lines of their own; a discount can't be a
 * negative line, so then (or whenever the sum still disagrees) the whole order goes as
 * one line for the full amount.
 */
function lineItems(order: Order, items: (typeof orderItems.$inferSelect)[]) {
  const lines = items.map((item) => ({ id: String(item.id), name: item.productName, quantity: item.quantity, price: item.unitPrice, sku: item.sku }));

  for (const [column, name, amount] of [
    ["shipping_total", "Ongkos kirim", order.shippingTotal],
    ["tax_total", "Pajak", order.taxTotal],
  ] as const) {
    if (amount > 0) {
      lines.push({ id: column, name, quantity: 1, price: amount, sku: column });
    }
  }

  if (lines.reduce((sum, line) => sum + line.price * line.quantity, 0) === order.grandTotal) {
    return lines;
  }

  return [{ id: String(order.id), name: `Pesanan ${order.number}`, quantity: 1, price: order.grandTotal, sku: order.number }];
}
