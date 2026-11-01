import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { and, desc, eq, ne } from "drizzle-orm";
import { branches, branchStocks, customers, db, inventoryMovements, orders, payments, products, shipments } from "../src/db";
import { dokuDigest, dokuSign } from "../src/server/payments/doku-signature";
import { removeTestCustomers } from "./support/remove-test-customers";

// Places real pickup orders in the development database, then plays DOKU and Biteship:
// signed notifications (good, forged, repeated, wrong amount) and shipment events.
// The account, its orders and the stock they took are undone afterwards.
process.loadEnvFile(".env.local");

const stamp = Date.now();
const email = `zz-orders-${stamp}@example.com`;
const phone = `0897${String(stamp).slice(-8)}`;

// in stock at Apotek Inofarma Pisangan Lama (CB-014); not the cart spec's product, as both count its stock
const SKU = "ID109201-4";
const BRANCH = "CB-014";

type Order = typeof orders.$inferSelect;

test.describe.configure({ mode: "serial" });

// one browser session for the whole file: the account the first checkout creates stays signed in
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const { redis } = await import("../src/lib/redis");

  for (const pattern of ["throttle:*", "limiter:*"]) {
    const keys = await redis.keys(pattern);

    if (keys.length) await redis.del(...keys);
  }

  redis.disconnect();
});

test.afterAll(async () => {
  await page.close();
  await removeTestCustomers("zz-orders-%@example.com");
  await db.$client.end();
});

function headersFor(page: Page) {
  return { Accept: "application/json", Origin: new URL(page.url()).origin };
}

async function stockAtBranch(): Promise<number> {
  const [row] = await db
    .select({ quantity: branchStocks.quantity })
    .from(branchStocks)
    .innerJoin(products, eq(products.id, branchStocks.productId))
    .innerJoin(branches, eq(branches.id, branchStocks.branchId))
    .where(and(eq(products.sku, SKU), eq(branches.code, BRANCH)));

  return row.quantity;
}

async function reload(order: Order): Promise<Order> {
  const [fresh] = await db.select().from(orders).where(eq(orders.id, order.id));

  return fresh;
}

/**
 * A pickup order for one unit at CB-014, as a guest the first time (which creates and
 * signs in the account) and as that customer afterwards. DOKU's sandbox is real here; a
 * payment attempt is recorded by hand when it was down, so the webhook has one to find.
 */
async function placeOrder(page: Page, asGuest: boolean): Promise<Order> {
  const headers = headersFor(page);

  expect((await page.request.post("/keranjang", { data: { productId: SKU, branchId: BRANCH, quantity: 1 }, headers })).ok()).toBe(true);

  const placed = await page.request.post("/checkout", {
    data: {
      fulfilment: "ambil",
      paymentMethod: "online",
      pickupBranchId: BRANCH,
      ...(asGuest ? { email, name: "ZZ Orders", phone, consent: true } : {}),
    },
    headers,
    timeout: 60_000,
  });

  // DOKU's payment page (409 + location), or the order page when DOKU is down
  expect([200, 409]).toContain(placed.status());

  const [customer] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email));
  const [latest] = await db.select().from(orders).where(eq(orders.customerId, customer.id)).orderBy(desc(orders.id)).limit(1);

  const [attempt] = await db.select().from(payments).where(eq(payments.orderId, latest.id));

  if (!attempt) {
    await db.insert(payments).values({
      orderId: latest.id,
      gateway: "doku",
      invoiceNumber: latest.number,
      status: "pending",
      amount: latest.grandTotal,
      expiresAt: latest.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return latest;
}

/** A notification signed the way DOKU signs one, sent to /doku/notifikasi. */
async function notify(request: APIRequestContext, payload: unknown, options: { secret?: string } = {}) {
  const body = JSON.stringify(payload);
  const clientId = process.env.DOKU_CLIENT_ID!;
  const requestId = randomUUID();
  const timestamp = new Date().toISOString().slice(0, 19) + "Z";
  const signature = dokuSign(clientId, requestId, timestamp, "/doku/notifikasi", dokuDigest(body), options.secret ?? process.env.DOKU_SECRET_KEY!);

  return request.post("/doku/notifikasi", {
    headers: { "Content-Type": "application/json", "Client-Id": clientId, "Request-Id": requestId, "Request-Timestamp": timestamp, Signature: signature },
    data: body,
  });
}

function notification(order: Order, status: string, amount = order.grandTotal) {
  return {
    order: { invoice_number: order.number, amount },
    transaction: { status, date: new Date().toISOString() },
    channel: { id: "VIRTUAL_ACCOUNT_BCA" },
  };
}

let paidOrder: Order;

test("DOKU's signed notification pays an order once; forged, mismatched and repeated ones change nothing", async () => {
  test.setTimeout(180_000);

  await page.goto(`/product-detail?id=${SKU}`);
  paidOrder = await placeOrder(page, true);

  // forged: signed with the wrong secret
  const forged = await notify(page.request, notification(paidOrder, "SUCCESS"), { secret: "not-the-secret" });

  expect(forged.status()).toBe(401);
  expect(await forged.json()).toEqual({ message: "invalid signature" });

  // signed, but for a different amount than this attempt
  expect((await notify(page.request, notification(paidOrder, "SUCCESS", paidOrder.grandTotal + 1))).status()).toBe(200);
  expect(await reload(paidOrder)).toMatchObject({ status: "menunggu pembayaran", paymentStatus: "belum bayar" });

  // an unknown invoice is acknowledged and ignored
  const unknown = await notify(page.request, { ...notification(paidOrder, "SUCCESS"), order: { invoice_number: "INO-NOPE", amount: 1 } });

  expect(await unknown.json()).toEqual({ message: "ok" });

  // the real thing
  expect(await (await notify(page.request, notification(paidOrder, "SUCCESS"))).json()).toEqual({ message: "ok" });

  const paid = await reload(paidOrder);

  expect(paid).toMatchObject({ status: "pembayaran diterima", paymentStatus: "lunas", paymentMethod: "VIRTUAL_ACCOUNT_BCA" });
  expect(paid.paidAt).not.toBeNull();

  const [payment] = await db.select().from(payments).where(eq(payments.invoiceNumber, paidOrder.number));

  expect(payment).toMatchObject({ status: "success", channel: "VIRTUAL_ACCOUNT_BCA" });

  // DOKU sends it again: nothing moves
  expect((await notify(page.request, notification(paidOrder, "SUCCESS"))).status()).toBe(200);
  expect((await reload(paidOrder)).paidAt).toEqual(paid.paidAt);

  // the order page now shows it paid, with no Bayar or Batalkan
  await page.goto(`/pesanan/${paidOrder.number}`);
  await expect(page.getByText("Pembayaran Diterima").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Bayar|Batalkan/ })).toHaveCount(0);

  // and it can be neither paid again nor cancelled
  const headers = headersFor(page);
  const payAgain = await page.request.post(`/pesanan/${paidOrder.number}/bayar`, { headers });

  expect((await payAgain.json()).flash).toEqual({ error: "Pesanan ini sudah tidak menunggu pembayaran." });

  const cancel = await page.request.post(`/pesanan/${paidOrder.number}/batalkan`, { headers });

  expect((await cancel.json()).flash).toEqual({ error: "Pesanan ini sudah diproses dan tidak bisa dibatalkan sendiri." });
});

test("a customer cancels an unpaid order and the stock goes back, once", async () => {
  test.setTimeout(180_000);

  await page.goto("/order-history");
  await expect(page.getByText(`#${paidOrder.number}`).first()).toBeVisible();

  const before = await stockAtBranch();
  const order = await placeOrder(page, false);

  expect(await stockAtBranch()).toBe(before - 1);

  await page.goto(`/pesanan/${order.number}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Batalkan Pesanan" }).first().click();
  await expect(page).toHaveURL(/\/order-history$/);
  await expect(page.getByText(`Pesanan #${order.number} dibatalkan.`)).toBeVisible();

  expect(await reload(order)).toMatchObject({ status: "dibatalkan" });
  expect(await stockAtBranch()).toBe(before);

  const returned = await db
    .select()
    .from(inventoryMovements)
    .where(and(eq(inventoryMovements.referenceId, order.id), eq(inventoryMovements.type, "retur masuk")));

  expect(returned.map((movement) => movement.quantity)).toEqual([1]);

  // a second cancel, or DOKU expiring it now, returns nothing more
  const again = await page.request.post(`/pesanan/${order.number}/batalkan`, { headers: headersFor(page) });

  expect((await again.json()).flash).toEqual({ error: "Pesanan ini sudah diproses dan tidak bisa dibatalkan sendiri." });
  await notify(page.request, notification(order, "EXPIRED"));
  expect(await reload(order)).toMatchObject({ status: "dibatalkan" });
  expect(await stockAtBranch()).toBe(before);
});

test("DOKU expiring a session expires the order and returns its stock, even when repeated", async () => {
  test.setTimeout(180_000);

  await page.goto("/order-history");

  const before = await stockAtBranch();
  const order = await placeOrder(page, false);

  await notify(page.request, notification(order, "EXPIRED"));
  await notify(page.request, notification(order, "EXPIRED"));

  expect(await reload(order)).toMatchObject({ status: "kedaluwarsa", paymentStatus: "belum bayar" });
  expect(await stockAtBranch()).toBe(before);

  await page.goto(`/track-order/${order.number}`);
  await expect(page.getByText(`#${order.number}`).first()).toBeVisible();
});

test("Biteship's events need the token, and a delivered parcel completes its order once", async ({ request }) => {
  const token = process.env.BITESHIP_WEBHOOK_TOKEN!;

  // the dashboard's empty check passes without a token; an event without one doesn't
  expect((await request.post("/biteship/notifikasi")).status()).toBe(200);

  const refused = await request.post("/biteship/notifikasi?token=wrong", { data: { order_id: "x", status: "delivered" } });

  expect(refused.status()).toBe(401);
  expect(await refused.json()).toEqual({ message: "invalid token" });

  // a booked shipment for the paid order, already on its way
  const biteshipOrderId = `zz-${stamp}`;

  await db.update(orders).set({ status: "dikirim" }).where(eq(orders.id, paidOrder.id));
  await db.insert(shipments).values({
    orderId: paidOrder.id,
    courierCompany: "jne",
    courierType: "reg",
    courierName: "JNE",
    courierServiceName: "Reguler",
    price: 0,
    biteshipOrderId,
    status: "confirmed",
    history: [{ status: "confirmed", at: "2026-11-01T10:00:00+07:00" }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const event = { event: "order.status", order_id: biteshipOrderId, status: "delivered", courier_waybill_id: "WB123", courier_tracking_id: "TR123" };

  for (let i = 0; i < 2; i++) {
    const response = await request.post(`/biteship/notifikasi?token=${encodeURIComponent(token)}`, { data: event });

    expect(await response.json()).toEqual({ message: "ok" });
  }

  const [shipment] = await db.select().from(shipments).where(eq(shipments.biteshipOrderId, biteshipOrderId));

  expect(shipment).toMatchObject({ status: "delivered", waybillId: "WB123", trackingId: "TR123" });
  expect((shipment.history as { status: string }[]).map((entry) => entry.status)).toEqual(["confirmed", "delivered"]);
  expect(shipment.rawResponse).not.toHaveProperty("token");

  const completed = await reload(paidOrder);

  expect(completed.status).toBe("selesai");
  expect(completed.completedAt).not.toBeNull();

  await page.goto(`/track-order/${paidOrder.number}`);
  await expect(page.getByText("Terkirim").first()).toBeVisible();
});

test("someone else's order, or no order at all, is a 404; signed out, it's the sign-in page", async ({ request }) => {
  const [someoneElses] = await db.select({ number: orders.number }).from(orders).where(ne(orders.customerId, paidOrder.customerId)).limit(1);

  for (const path of [`/pesanan/${someoneElses.number}`, `/track-order/${someoneElses.number}`, "/pesanan/INO-NOPE", "/pesanan/%25"]) {
    expect((await page.request.get(path, { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get(path, { maxRedirects: 0 })).headers().location).toBe("/signin");
  }

  const actions = await page.request.post("/pesanan/INO-NOPE/batalkan", { headers: headersFor(page) });

  expect(actions.status()).toBe(404);
});
