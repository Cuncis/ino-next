import { expect, test, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { branches, branchStocks, customers, db, orderItems, orders, products } from "../src/db";
import { removeTestCustomers } from "./support/remove-test-customers";

// Places real orders in the development database (and opens DOKU sandbox payment
// sessions); the accounts, their orders and the stock they took are undone afterwards.
process.loadEnvFile(".env.local");

const stamp = Date.now();
const email = `zz-checkout-${stamp}@example.com`;
const phone = `0898${String(stamp).slice(-8)}`;

// in stock at Apotek Inofarma Pisangan Lama (CB-014), the branch that delivers
const SKU = "ID107212-1";
const PRODUCT = "Garlic Kapsul";

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => {
    const target = [...document.querySelectorAll<HTMLElement>("main button, form button[type=submit], main")].find((element) => element.offsetParent !== null);

    return target !== undefined && Object.keys(target).some((key) => key.startsWith("__reactFiber"));
  });
}

async function stockAtCb014(): Promise<number> {
  const [row] = await db
    .select({ quantity: branchStocks.quantity })
    .from(branchStocks)
    .innerJoin(products, eq(products.id, branchStocks.productId))
    .innerJoin(branches, eq(branches.id, branchStocks.branchId))
    .where(and(eq(products.sku, SKU), eq(branches.code, "CB-014")));

  return row.quantity;
}

test.beforeAll(async () => {
  const { redis } = await import("../src/lib/redis");

  for (const pattern of ["throttle:*", "limiter:*"]) {
    const keys = await redis.keys(pattern);

    if (keys.length) await redis.del(...keys);
  }

  redis.disconnect();
});

test.afterAll(async () => {
  await removeTestCustomers("zz-checkout-%@example.com");
  await db.$client.end();
});

test.use({ viewport: { width: 1280, height: 900 } });

test("an empty cart goes to the empty-cart page, and checkout sends it back with a message", async ({ request }) => {
  const cart = await request.get("/cart", { maxRedirects: 0 });

  expect(cart.status()).toBe(302);
  expect(cart.headers().location).toBe("/cart-empty");

  const checkout = await request.get("/checkout", { maxRedirects: 0 });

  expect(checkout.status()).toBe(302);
  expect(checkout.headers().location).toBe("/cart");
  expect(checkout.headers()["set-cookie"]).toContain("Keranjang%20Anda%20masih%20kosong.");
});

test("a guest fills a cart, checks out for pickup, and gets an account and an order", async ({ page }) => {
  test.setTimeout(180_000);

  const stockBefore = await stockAtCb014();

  // never leave for DOKU's real payment page; its sandbox URL is enough to know we were sent there
  await page.route(/doku\.com/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>DOKU</h1>" }));

  await open(page, `/product-detail?id=${SKU}`);
  await page.getByRole("button", { name: "Tambahkan ke keranjang" }).click();
  await expect(page.getByRole("button", { name: "Ditambahkan ✓" })).toBeVisible();

  // a second branch's product asks before emptying the cart
  const conflict = await page.request.post("/keranjang", {
    data: { productId: SKU, branchId: "CB-013", quantity: 1 },
    headers: { Accept: "application/json", Origin: new URL(page.url()).origin },
  });

  expect(conflict.status()).toBe(422);
  expect((await conflict.json()).errors.branch[0]).toContain("Kosongkan keranjang dan pindah ke Apotek Inofarma Kayu Manis?");

  await open(page, "/cart");
  await expect(page.locator("main").getByText(PRODUCT).first()).toBeVisible();

  await open(page, "/checkout");
  await page.getByRole("tab", { name: "Ambil di toko" }).click();
  await page.locator("#email:visible").fill(email);
  await page.locator("#name:visible").fill("ZZ Checkout");
  await page.locator("#phone:visible").fill(phone);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Bayar sekarang" }).click();

  // DOKU's payment page, or, when its sandbox is down, the order page with Laravel's message
  await expect(page).toHaveURL(/doku\.com|\/pesanan\/INO-/, { timeout: 60_000 });

  const [customer] = await db.select().from(customers).where(eq(customers.email, email));

  expect(customer).toMatchObject({ name: "ZZ Checkout", phone, status: "aktif", consentVersion: "1.0" });

  const [order] = await db.select().from(orders).where(eq(orders.customerId, customer.id));

  expect(order).toMatchObject({ fulfilment: "ambil", status: "menunggu pembayaran", paymentStatus: "belum bayar", shippingTotal: 0 });

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ sku: SKU, quantity: 1, lineTotal: order.subtotal });
  // Pickup is open at every branch: stock is taken where the order is collected, and a
  // branch without it takes nothing (the company covers the gap), as in Laravel.
  const [cb014] = await db.select({ id: branches.id }).from(branches).where(eq(branches.code, "CB-014"));

  if (order.branchId === cb014.id) {
    expect(await stockAtCb014()).toBe(stockBefore - 1);
    expect(items[0].batchesConsumed).toMatchObject([{ quantity: 1 }]);
  } else {
    expect(await stockAtCb014()).toBe(stockBefore);
  }

  // the new account is signed in and its cart is empty
  const cart = await page.request.get("/keranjang/ringkas");

  expect((await cart.json()).items).toEqual([]);
});

test("checkout refuses what it can't fulfil, with Laravel's messages", async ({ page }) => {
  await open(page, `/product-detail?id=${SKU}`);

  const origin = new URL(page.url()).origin;
  const headers = { Accept: "application/json", Origin: origin };

  await page.request.post("/keranjang", { data: { productId: SKU, branchId: "CB-014", quantity: 1 }, headers });

  const refused = await page.request.post("/checkout", {
    data: { fulfilment: "antar", paymentMethod: "online", email: "not-an-email", name: "", phone: "abc", consent: false },
    headers,
  });

  expect(refused.status()).toBe(422);
  expect((await refused.json()).errors).toEqual({
    name: ["Kolom nama wajib diisi."],
    phone: ["Nomor telepon hanya boleh berisi angka, spasi, dan tanda + - ( )."],
    email: ["Kolom email harus berupa alamat email yang valid."],
    consent: ["Anda harus menyetujui Kebijakan Privasi untuk melanjutkan."],
    addressLine: ["Kolom alamat lengkap wajib diisi."],
    kota: ["Kolom kota/kabupaten wajib diisi."],
    provinsi: ["Kolom provinsi wajib diisi."],
  });

  const overLimit = await page.request.patch(`/keranjang/${SKU}`, { data: { quantity: 3 }, headers });

  expect(overLimit.ok()).toBe(true);

  const sentBack = await page.request.get("/checkout", { maxRedirects: 0 });

  expect(sentBack.headers().location).toBe("/cart");
  expect(decodeURIComponent(sentBack.headers()["set-cookie"])).toContain("Produk ini memiliki maksimum jumlah pembelian untuk pemakaian 3 hari");
});
