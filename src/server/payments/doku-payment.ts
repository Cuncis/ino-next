import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { customers, db, orderItems, orders, payments } from "@/db";
import { normalizePhone } from "@/lib/phone";
import { cancelOrder } from "@/server/orders/order-cancellation";
import { updateOrder } from "@/server/orders/order-updates";
import { DokuClient } from "./doku-client";

/**
 * One order's relationship with DOKU, ported from App\Support\Payments\DokuPaymentService:
 * opening a checkout session, and folding DOKU's notifications (the webhook, or a status
 * check when the shopper comes back) into the payment and the order.
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

/** The payment statuses this app stores (`payments.status`). */
export type PaymentStatus = "success" | "failed" | "expired" | "refunded" | "pending";

/** DOKU's vocabulary to this app's `payments.status`, or null for anything else. */
export function mapDokuStatus(dokuStatus: unknown): PaymentStatus | null {
  switch (dokuStatus) {
    case "SUCCESS":
      return "success";
    case "FAILED":
    case "TIMEOUT":
      return "failed";
    case "EXPIRED":
      return "expired";
    case "REFUNDED":
      return "refunded";
    case "PENDING":
    case "REDIRECT":
      return "pending";
    default:
      return null;
  }
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

/**
 * Folds a verified DOKU notification into the payment and its order, or returns null
 * when it names no known payment (or a successful payment of the wrong amount).
 *
 * Safe to repeat, which DOKU says it may do: once a payment is in the reported status,
 * a repeat only records the payload again and never touches the order a second time.
 */
export async function applyDokuNotification(payload: unknown): Promise<Payment | null> {
  const invoiceNumber = field(field(payload, "order"), "invoice_number");
  const status = mapDokuStatus(field(field(payload, "transaction"), "status"));
  const channelId = field(field(payload, "channel"), "id");
  const channel = channelId === undefined || channelId === null ? null : String(channelId);

  if (!invoiceNumber || !status || (typeof invoiceNumber !== "string" && typeof invoiceNumber !== "number")) {
    return null;
  }

  const [payment] = await db.select().from(payments).where(eq(payments.invoiceNumber, String(invoiceNumber))).limit(1);

  if (!payment) {
    return null;
  }

  // The signature proves DOKU sent it; the amount makes sure the money matches this
  // attempt before an order is ever marked paid.
  const amount = field(field(payload, "order"), "amount");

  if (status === "success" && amount !== undefined && amount !== null && Math.round(Number(amount)) !== payment.amount) {
    console.warn("Notifikasi DOKU ditolak: jumlah tidak cocok.", { invoice_number: invoiceNumber, expected: payment.amount, received: amount });

    return null;
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(payments).where(eq(payments.id, payment.id)).limit(1).for("update");
    const alreadyApplied = locked.status === status;
    const now = new Date();

    const [updated] = await tx
      .update(payments)
      .set({
        status,
        channel: channel ?? locked.channel,
        paidAt: status === "success" ? (locked.paidAt ?? now) : locked.paidAt,
        refundedAt: status === "refunded" ? (locked.refundedAt ?? now) : locked.refundedAt,
        rawNotification: payload,
        updatedAt: now,
      })
      .where(eq(payments.id, locked.id))
      .returning();

    if (!alreadyApplied) {
      const [order] = await tx.select().from(orders).where(eq(orders.id, locked.orderId)).limit(1).for("update");

      if (status === "success") {
        await updateOrder(
          order,
          {
            paymentStatus: "lunas",
            paymentMethod: channel ?? order.paymentMethod,
            paidAt: order.paidAt ?? now,
            status: order.status === "menunggu pembayaran" ? "pembayaran diterima" : order.status,
          },
          tx,
        );
      } else if (status === "expired") {
        // DOKU expired the session before the customer paid: the same as the payment
        // window running out (pesanan:kadaluwarsakan), only reported by DOKU.
        await cancelOrder(order, "kedaluwarsa", { executor: tx, allowed: (current) => current.status === "menunggu pembayaran" });
      } else if (status === "refunded") {
        // recorded, not reversed: staff decide what happens to the stock
        await updateOrder(order, { paymentStatus: "refund" }, tx);
      }
    }

    return updated;
  });
}

/**
 * Asks DOKU for its own record of one payment and folds it in exactly as the webhook
 * would: for a webhook that is late, lost, or (in development, where DOKU can't reach
 * localhost) never coming. Read-only against DOKU.
 *
 * @throws Error on a DOKU-side failure; the payment stays as it was
 */
export async function reconcilePayment(payment: Pick<Payment, "invoiceNumber">, client = DokuClient.fromConfig()): Promise<Payment | null> {
  return applyDokuNotification(await client.checkStatus(payment.invoiceNumber));
}

/** The order's latest payment attempt still waiting for DOKU. */
export async function latestPendingPayment(orderId: number): Promise<Payment | null> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "pending")))
    .orderBy(desc(payments.id))
    .limit(1);

  return payment ?? null;
}
