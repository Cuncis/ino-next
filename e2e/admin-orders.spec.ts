import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { and, eq, inArray } from "drizzle-orm";
import { auditLogs, branches, customers, db, modelHasRoles, orderItems, orders, products, roles, shipments, users } from "../src/db";
import { hashLaravelPassword } from "../src/lib/password";

// The Pesanan and Pengambilan screens, driven as staff: a Super Admin, an APJ of one branch
// and a Staf Gudang made for this file. Orders it makes are numbered ZZ-… (or INO-… when
// created through the form) and removed afterwards with everything they wrote.
process.loadEnvFile(".env.local");

const stamp = Date.now();
const password = "Zz-Orders-Admin-1";
const people = {
  admin: { email: `zz-orders-admin-${stamp}@example.com`, role: "Super Admin", branch: null as number | null },
  apj: { email: `zz-orders-apj-${stamp}@example.com`, role: "APJ Cabang", branch: 1 as number | null },
  gudang: { email: `zz-orders-gudang-${stamp}@example.com`, role: "Staf Gudang", branch: 1 as number | null },
};
const staffIds: number[] = [];
const createdOrderIds: number[] = [];
let customerId: number;
let productId: number;
let productPrice: number;
let otherBranchId: number;

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(120_000);

test.beforeAll(async () => {
  const { redis } = await import("../src/lib/redis");

  for (const pattern of ["throttle:*", "limiter:*"]) {
    const keys = await redis.keys(pattern);

    if (keys.length) await redis.del(...keys);
  }

  redis.disconnect();

  const hash = await hashLaravelPassword(password);

  for (const person of Object.values(people)) {
    const [staff] = await db.insert(users).values({ name: `ZZ ${person.role}`, email: person.email, password: hash, branchId: person.branch, isActive: true, createdAt: new Date(), updatedAt: new Date() }).returning();
    const [role] = await db.select().from(roles).where(and(eq(roles.name, person.role), eq(roles.guardName, "web")));

    staffIds.push(staff.id);
    await db.insert(modelHasRoles).values({ roleId: role.id, modelType: "App\\Models\\User", modelId: staff.id });
  }

  const [customer] = await db
    .insert(customers)
    .values({ code: `ZZO-${stamp % 100000}`, name: "ZZ Pelanggan Admin", email: `zz-admin-order-customer-${stamp}@example.com`, password: hash, status: "aktif", createdAt: new Date(), updatedAt: new Date() })
    .returning();
  const [product] = await db.select().from(products).where(eq(products.sku, "ID109201-4"));
  const [other] = await db.select().from(branches).where(eq(branches.code, "CB-014"));

  customerId = customer.id;
  productId = product.id;
  productPrice = product.price;
  otherBranchId = other.id;
});

test.afterAll(async () => {
  const mine = await db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, customerId));
  const ids = [...new Set([...createdOrderIds, ...mine.map((order) => order.id)])];

  if (ids.length) {
    await db.delete(auditLogs).where(and(eq(auditLogs.auditableType, "App\\Models\\Order"), inArray(auditLogs.auditableId, ids)));
    await db.delete(shipments).where(inArray(shipments.orderId, ids));
    await db.delete(orderItems).where(inArray(orderItems.orderId, ids));
    await db.delete(orders).where(inArray(orders.id, ids));
  }

  await db.delete(auditLogs).where(inArray(auditLogs.userId, staffIds));
  await db.delete(modelHasRoles).where(and(eq(modelHasRoles.modelType, "App\\Models\\User"), inArray(modelHasRoles.modelId, staffIds)));
  await db.delete(users).where(inArray(users.id, staffIds));
  await db.delete(customers).where(eq(customers.id, customerId));
  await db.$client.end();
});

async function signIn(page: Page, email: string) {
  await page.goto("/admin/masuk");
  await page.waitForFunction(() => Object.keys(document.querySelector("form button[type=submit]") ?? {}).some((key) => key.startsWith("__reactFiber")));
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 60_000 });
}

/** An order for this file's customer, straight into the database. */
async function makeOrder(values: Partial<typeof orders.$inferInsert> = {}) {
  const now = new Date();
  const [order] = await db
    .insert(orders)
    .values({
      number: `ZZ-ORD-${stamp % 100000}-${createdOrderIds.length}`,
      branchId: 1,
      customerId,
      fulfilment: "ambil",
      status: "menunggu pembayaran",
      paymentMethod: "Transfer Bank",
      paymentStatus: "belum bayar",
      subtotal: productPrice,
      grandTotal: productPrice,
      createdAt: now,
      updatedAt: now,
      ...values,
    })
    .returning();

  await db.insert(orderItems).values({ orderId: order.id, productId, productName: "ZZ Produk", sku: "ID109201-4", unitPrice: productPrice, quantity: 1, lineTotal: productPrice, createdAt: now, updatedAt: now });
  createdOrderIds.push(order.id);

  return order;
}

const reload = async (id: number) => (await db.select().from(orders).where(eq(orders.id, id)))[0];

async function post(request: APIRequestContext, page: Page, path: string, data: unknown = {}) {
  const response = await request.post(path, { data, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } });

  return { status: response.status(), body: await response.json().catch(() => null) };
}

/** Clicks until the (large, dev-mode) page is listening, then expects the modal. */
async function openModal(page: Page, button: ReturnType<Page["locator"]>) {
  await expect(async () => {
    await button.click();
    await expect(page.locator(".fi-modal-open .fi-modal-window")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
}

test("a manual pickup order: paid, ready with a code, handed over at the counter", async ({ page }) => {
  const order = await makeOrder();

  await signIn(page, people.admin.email);
  await page.goto(`/admin/pesanan/${order.id}`);
  await expect(page.locator(".fi-header-heading")).toHaveText(`Lihat ${order.number}`);

  await openModal(page, page.locator(".fi-header-actions-ctn").getByRole("button", { name: "Tandai Lunas" }));
  await expect(page.locator(".fi-modal-description")).toHaveText("Pastikan pembayaran pesanan ini sudah benar-benar diterima.");
  await page.locator(".fi-modal-window").getByRole("button", { name: "Konfirmasi" }).click();
  await expect(page.getByText(`Pesanan #${order.number} ditandai lunas.`)).toBeVisible();
  expect(await reload(order.id)).toMatchObject({ status: "pembayaran diterima", paymentStatus: "lunas" });

  const [paidAudit] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "pesanan.lunas"), eq(auditLogs.auditableId, order.id)));

  expect(paidAudit).toMatchObject({ userId: staffIds[0], branchId: 1, oldValues: { payment_status: "belum bayar" }, newValues: { payment_status: "lunas" } });

  await page.locator(".fi-header-actions-ctn").getByRole("button", { name: "Tandai Sedang Diproses" }).click();
  await expect(page.getByText(new RegExp(`Pesanan #${order.number} siap diambil\\. Kode: \\d{6}\\.`))).toBeVisible();

  const ready = await reload(order.id);

  expect(ready).toMatchObject({ status: "siap diambil" });
  expect(ready.pickupCode).toMatch(/^\d{6}$/);
  expect(ready.pickupCodeExpiresAt!.getTime() - ready.readyAt!.getTime()).toBe(48 * 3600_000);

  // the counter's queue, opened from the slip's QR: filtered to the order, code filled in
  await page.goto(`/admin/pengambilan?order=${order.number}&kode=000000`);
  await expect(page.locator(".fi-ta-row")).toHaveCount(1);
  await openModal(page, page.getByRole("button", { name: "Serahkan" }));
  await expect(page.locator(".fi-modal-window input")).toHaveValue("000000");
  await page.locator(".fi-modal-window").getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText("Kode ambil tidak cocok.")).toBeVisible();
  expect((await reload(order.id)).status).toBe("siap diambil");

  await openModal(page, page.getByRole("button", { name: "Serahkan" }));
  await page.locator(".fi-modal-window input").fill(ready.pickupCode!);
  await page.locator(".fi-modal-window").getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText(`Pesanan #${order.number} berhasil diserahkan.`)).toBeVisible();

  const done = await reload(order.id);

  expect(done).toMatchObject({ status: "selesai", handedOverBy: staffIds[0] });
  expect(done.pickedUpAt).not.toBeNull();
  expect((await db.select().from(auditLogs).where(and(eq(auditLogs.action, "pesanan.serahkan"), eq(auditLogs.auditableId, order.id)))).length).toBe(1);

  // a completed order can't be deleted; an unpaid one can
  const refused = await post(page.request, page, `/admin/pesanan/${order.id}/hapus`);

  expect(refused.body.toast).toEqual({ status: "danger", title: `Pesanan #${order.number} sudah selesai dan tidak bisa dihapus.`, body: "Batalkan pesanan bila perlu." });
  expect((await reload(order.id)).deletedAt).toBeNull();
});

test("cancel, delete and restore; delivery booking refused while the branch has no map point", async ({ page }) => {
  await signIn(page, people.admin.email);

  const toCancel = await makeOrder();
  const cancelled = await post(page.request, page, `/admin/pesanan/${toCancel.id}/aksi/cancel`);

  expect(cancelled.body.toast.title).toBe(`Pesanan #${toCancel.number} dibatalkan.`);
  expect(await reload(toCancel.id)).toMatchObject({ status: "dibatalkan" });
  // an action the order no longer offers is refused
  expect((await post(page.request, page, `/admin/pesanan/${toCancel.id}/aksi/markPaid`)).status).toBe(403);

  const toDelete = await makeOrder();

  expect((await post(page.request, page, `/admin/pesanan/${toDelete.id}/hapus`)).body.toast.title).toBe("Data berhasil dihapus");
  expect((await reload(toDelete.id)).deletedAt).not.toBeNull();

  // gone from the list, back with the "with deleted" filter, then restored in bulk
  await page.goto(`/admin/pesanan?search=${toDelete.number}`);
  await expect(page.locator(".fi-ta-empty-state-heading")).toHaveText("Tidak ada data yang ditemukan");
  await page.goto(`/admin/pesanan?search=${toDelete.number}&filter_trashed=1`);
  await expect(page.locator(".fi-ta-row")).toHaveCount(1);
  expect((await post(page.request, page, "/admin/pesanan/massal/pulihkan", { ids: [toDelete.id] })).body.toast.title).toBe("Data berhasil dipulihkan");
  expect((await reload(toDelete.id)).deletedAt).toBeNull();

  // delivery: "Tandai Terpenuhi" checks what Biteship would be sent first
  const delivery = await makeOrder({ fulfilment: "antar", status: "siap dikirim", paymentStatus: "lunas", branchId: 1 });
  const [branch] = await db.select().from(branches).where(eq(branches.id, 1));

  await db.insert(shipments).values({ orderId: delivery.id, courierCompany: "jne", courierType: "reg", price: 10000, createdAt: new Date(), updatedAt: new Date() });
  await db.update(branches).set({ latitude: null }).where(eq(branches.id, 1));

  try {
    const shipped = await post(page.request, page, `/admin/pesanan/${delivery.id}/aksi/ship`);

    expect(shipped.body.toast.status).toBe("danger");
    expect(shipped.body.toast.title).toBe("Gagal membuat resi");
    expect(shipped.body.toast.body).toContain(`Resi pesanan #${delivery.number} belum bisa dibuat: Koordinat ${branch.name} belum diisi`);
    expect(shipped.body.toast.body).toContain("alamat pelanggan tidak punya titik peta");
  } finally {
    await db.update(branches).set({ latitude: branch.latitude }).where(eq(branches.id, 1));
  }

  expect((await reload(delivery.id)).status).toBe("siap dikirim");
});

test("creating an order through the form, then editing it", async ({ page }) => {
  await signIn(page, people.admin.email);

  // refused with Laravel's messages
  const refused = await post(page.request, page, "/admin/pesanan/buat", { customer_id: "", branch_id: "", fulfilment: "", payment_method: "Cek", shipping_total: "-1", items: [{ product_id: "", quantity: "0" }] });

  expect(refused.status).toBe(422);
  expect(refused.body.errors).toMatchObject({
    customer_id: ["Kolom pelanggan wajib diisi."],
    branch_id: ["Kolom cabang wajib diisi."],
    fulfilment: ["Kolom cara Terima wajib diisi."],
    payment_method: ["Kolom metode Pembayaran yang dipilih tidak valid."],
    shipping_total: ["Kolom ongkos Kirim minimal bernilai 0."],
    "items.0.product_id": ["Kolom produk wajib diisi."],
    "items.0.quantity": ["Kolom jumlah minimal bernilai 1."],
  });

  const created = await post(page.request, page, "/admin/pesanan/buat", {
    customer_id: String(customerId),
    branch_id: "1",
    fulfilment: "antar",
    payment_method: "GoPay",
    shipping_total: "5000",
    note: "ZZ catatan",
    items: [{ product_id: String(productId), quantity: "3" }],
  });

  expect(created.body?.toast?.title, JSON.stringify(created)).toBe("Data berhasil dibuat");

  const id = Number(String(created.body.redirect).split("/").pop());

  createdOrderIds.push(id);

  const order = await reload(id);

  expect(order.number).toMatch(/^INO-\d+$/);
  expect(order).toMatchObject({ status: "menunggu pembayaran", paymentStatus: "belum bayar", subtotal: productPrice * 3, shippingTotal: 5000, grandTotal: productPrice * 3 + 5000, note: "ZZ catatan" });

  const [audit] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "pesanan_dibuat"), eq(auditLogs.auditableId, id)));

  // the observer ran before the lines existed, as in Laravel
  expect(audit).toMatchObject({ userId: staffIds[0], branchId: 1, newValues: { number: order.number, grand_total: null, fulfilment: "antar" } });

  // the page shows it, and the form saves a new shipping total
  await page.goto(`/admin/pesanan/${id}/edit`);
  await expect(page.locator(".fi-header-heading")).toHaveText(`Ubah ${order.number}`);

  const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const saved = await post(page.request, page, `/admin/pesanan/${id}/simpan`, {
    customer_id: String(customerId),
    branch_id: "1",
    fulfilment: "ambil",
    payment_method: "GoPay",
    shipping_total: "0",
    note: "",
    items: [{ id: item.id, product_id: String(productId), quantity: "2" }],
  });

  expect(saved.body.toast.title).toBe("Data berhasil disimpan");
  expect(await reload(id)).toMatchObject({ fulfilment: "ambil", shippingTotal: 0, subtotal: productPrice * 2, grandTotal: productPrice * 2, note: null });
  expect(await db.select({ quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, id))).toEqual([{ quantity: 2 }]);
});

test("the list: search, filters and paging, and the global search", async ({ page }) => {
  await signIn(page, people.admin.email);

  const paid = await makeOrder({ paymentStatus: "lunas", status: "pembayaran diterima" });

  await page.goto(`/admin/pesanan?search=${paid.number}`);
  await expect(page.locator(".fi-ta-row")).toHaveCount(1);
  await expect(page.locator(".fi-ta-row .fi-badge").first()).toHaveText("Lunas");

  await page.goto("/admin/pesanan?filter_payment_status=refund");
  const refundRows = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.paymentStatus, "refund")));

  await expect(page.locator(".fi-ta-row")).toHaveCount(Math.min(refundRows.length, 10));
  await expect(page.locator(".fi-icon-btn-badge-ctn .fi-badge")).toHaveText("1");

  await page.goto("/admin/pesanan?perPage=5&page=2");
  await expect(page.locator(".fi-pagination-overview")).toContainText("Menampilkan 6 sampai");

  const groups = (await (await page.request.get(`/form/admin/cari?q=${paid.number}`)).json()).groups;

  // every resource titled by the order number, in Filament's order (Invoices, Orders, Pickups)
  expect(groups.map((group: { label: string }) => group.label)).toEqual(["Faktur", "Pesanan", "Pengambilan"]);
  expect(groups[0].results[0]).toMatchObject({ title: paid.number, url: `/admin/faktur/${paid.id}` });
  expect(groups[1].results[0]).toMatchObject({ title: paid.number, url: `/admin/pesanan/${paid.id}` });
});

test("who may do what: branch staff see their branch, other roles are refused", async ({ page, browser }) => {
  const inOtherBranch = await makeOrder({ branchId: otherBranchId });
  const inBranch = await makeOrder();

  await signIn(page, people.apj.email);
  expect((await page.request.get(`/admin/pesanan/${inOtherBranch.id}`, { maxRedirects: 0 })).status()).toBe(404);
  expect((await page.request.get(`/admin/pesanan/${inBranch.id}`, { maxRedirects: 0 })).status()).toBe(200);
  expect((await page.request.get("/admin/pesanan/create", { maxRedirects: 0 })).status()).toBe(200);
  // only Super Admin deletes
  expect((await post(page.request, page, `/admin/pesanan/${inBranch.id}/hapus`)).status).toBe(403);
  await page.goto(`/admin/pesanan?search=${inBranch.number}`);
  await expect(page.locator(".fi-ta-row")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Hapus" })).toHaveCount(0);
  await expect(page.locator(".fi-ta-page-checkbox")).toHaveCount(0);

  const gudang = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await signIn(gudang, people.gudang.email);
  expect((await gudang.request.get("/admin/pesanan", { maxRedirects: 0 })).status()).toBe(403);
  expect((await gudang.request.get("/admin/pengambilan", { maxRedirects: 0 })).status()).toBe(403);
  expect((await post(gudang.request, gudang, `/admin/pesanan/${inBranch.id}/aksi/markPaid`)).status).toBe(403);
  await gudang.close();

});
