import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import { auditLogs, branchStocks, db, inventoryBatches, inventoryMovements, modelHasRoles, orders, payments, products, roles, stockTransfers, users } from "../src/db";
import { hashLaravelPassword } from "../src/lib/password";

process.loadEnvFile(".env.local");

/**
 * Step 7.4 of the admin: Inventaris (Stok, Matriks Stok, Transfer), the product page's
 * stock buttons, Faktur with its refund, and Rekonsiliasi, with Laravel's messages and
 * permissions. Its product and order are named ZZI<stamp> and removed afterwards.
 */
const stamp = Date.now() % 1_000_000;
const tag = `ZZI${stamp}`;
const password = "Zz-Inventory-Pass-1";
const people = {
  admin: { email: `zz-inv-admin-${stamp}@example.com`, role: "Super Admin", branch: null as number | null },
  apj: { email: `zz-inv-apj-${stamp}@example.com`, role: "APJ Cabang", branch: 1 as number | null },
  gudang: { email: `zz-inv-gudang-${stamp}@example.com`, role: "Staf Gudang", branch: 2 as number | null },
};
const staffIds: number[] = [];
let productId: number;
let orderId: number;

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(180_000);

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

  const now = new Date();
  const [product] = await db.insert(products).values({ sku: `${tag}-S`, name: `${tag} Stok`, slug: `${tag.toLowerCase()}-stok`, categoryId: 1, price: 1000, status: "aktif", createdAt: now, updatedAt: now }).returning();
  const [order] = await db
    .insert(orders)
    .values({ number: `${tag}-F`, customerId: 9, branchId: 1, fulfilment: "ambil", status: "selesai", paymentMethod: "Transfer Bank", paymentStatus: "lunas", subtotal: 5000, grandTotal: 5000, paidAt: now, createdAt: now, updatedAt: now })
    .returning();

  productId = product.id;
  orderId = order.id;
  await db.insert(payments).values({ orderId, gateway: "doku", invoiceNumber: `${tag}-INV`, status: "success", amount: 5000, channel: "VIRTUAL_ACCOUNT_BCA", paidAt: now, createdAt: now, updatedAt: now });
});

test.afterAll(async () => {
  await db.delete(inventoryMovements).where(eq(inventoryMovements.productId, productId));
  await db.delete(inventoryBatches).where(eq(inventoryBatches.productId, productId));
  await db.delete(branchStocks).where(eq(branchStocks.productId, productId));
  await db.delete(stockTransfers).where(eq(stockTransfers.productId, productId));
  await db.delete(products).where(eq(products.id, productId));
  await db.delete(auditLogs).where(and(eq(auditLogs.auditableType, "App\\Models\\Order"), eq(auditLogs.auditableId, orderId)));
  await db.delete(payments).where(eq(payments.orderId, orderId));
  await db.delete(orders).where(eq(orders.id, orderId));
  await db.delete(auditLogs).where(inArray(auditLogs.userId, staffIds));
  await db.delete(modelHasRoles).where(and(eq(modelHasRoles.modelType, "App\\Models\\User"), inArray(modelHasRoles.modelId, staffIds)));
  await db.delete(users).where(inArray(users.id, staffIds));
  await db.$client.end();
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/admin/masuk");
  await page.waitForFunction(() => Object.keys(document.querySelector("form") ?? {}).some((key) => key.startsWith("__reactFiber")));
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 60_000 });
}

async function post(request: APIRequestContext, page: Page, url: string, data: unknown = {}) {
  const response = await request.post(url, { data, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } });

  return { status: response.status(), body: await response.json().catch(() => null) };
}

async function openModal(page: Page, button: ReturnType<Page["locator"]>) {
  await expect(async () => {
    await button.click();
    await expect(page.locator(".fi-modal-open .fi-modal-window")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
}

const movements = async () =>
  (await db.select().from(inventoryMovements).where(eq(inventoryMovements.productId, productId)).orderBy(asc(inventoryMovements.id))).map((movement) => [movement.branchId, movement.type, movement.quantity, movement.balanceAfter, movement.note]);

const stockAt = async (branchId: number) => (await db.select().from(branchStocks).where(and(eq(branchStocks.productId, productId), eq(branchStocks.branchId, branchId))))[0];

test("stock: the first batch, a delivery and corrections, with Laravel's messages", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/inventaris/stok");

  // "Tambah Stok Awal": the product is found by the server as it is typed
  await openModal(page, page.getByRole("button", { name: "Tambah Stok Awal" }));

  const modal = page.locator(".fi-modal-open .fi-modal-window");
  const choose = async (id: string, term: string, option: string) => {
    const root = modal.locator(".fi-select-input").filter({ has: page.locator(`[id="${id}"]`) });

    await root.locator(".fi-select-input-btn").click();
    await root.locator(".fi-select-input-search-ctn input").fill(term);
    await root.locator(".fi-select-input-option", { hasText: option }).first().click();
  };

  await choose("mountedActionSchema0.branchId", "Kapten", "Kapten Yusuf");
  await choose("mountedActionSchema0.productId", tag, `${tag}-S · ${tag} Stok`);
  await modal.locator('[id="mountedActionSchema0.batchNumber"]').fill("B1");
  await modal.locator('[id="mountedActionSchema0.expiresAt"]').fill("2020-01-01");
  await modal.locator('[id="mountedActionSchema0.quantity"]').fill("10");
  await modal.getByRole("button", { name: "Simpan Stok" }).click();
  await expect(modal.locator("[data-validation-error]")).toHaveText(["Kolom tanggal Kedaluwarsa harus berisi tanggal setelah today."]);
  await modal.locator('[id="mountedActionSchema0.expiresAt"]').fill("2027-12-31");
  await modal.getByRole("button", { name: "Simpan Stok" }).click();
  await expect(page.locator(".fi-no-notification-title").filter({ visible: true })).toHaveText(`10 "${tag} Stok" diterima di Apotek Inofarma Kapten Yusuf.`);

  const stock = await stockAt(1);

  expect(stock).toMatchObject({ quantity: 10, reservedQuantity: 0, isListed: true });

  // the row's "Terima Barang": no batch number means one batch per expiry date
  const received = await post(page.request, page, `/admin/inventaris/stok/${stock.id}/terima`, { batchNumber: "", expiresAt: "2028-01-31", quantity: "5", note: "" });

  expect(received.body.toast.title).toBe(`5 "${tag} Stok" diterima di Apotek Inofarma Kapten Yusuf.`);
  expect((await db.select().from(inventoryBatches).where(eq(inventoryBatches.productId, productId)).orderBy(inventoryBatches.batchNumber)).map((batch) => [batch.batchNumber, batch.quantity])).toEqual([
    ["B1", 10],
    ["EXP-20280131", 5],
  ]);

  // "Sesuaikan": not zero, and never below zero
  expect((await post(page.request, page, `/admin/inventaris/stok/${stock.id}/sesuaikan`, { delta: "0", reason: "rusak" })).body.errors).toEqual({ delta: ["Jumlah penyesuaian tidak boleh nol."] });
  expect((await post(page.request, page, `/admin/inventaris/stok/${stock.id}/sesuaikan`, { delta: "-100", reason: "rusak" })).body.toast).toMatchObject({ status: "danger", title: "Stok tidak cukup: diminta 100, tersedia 15." });
  expect((await post(page.request, page, `/admin/inventaris/stok/${stock.id}/sesuaikan`, { delta: "-3", reason: "rusak", note: "pecah" })).body.toast.title).toBe(`Stok "${tag} Stok" di Apotek Inofarma Kapten Yusuf disesuaikan.`);
  expect(await movements()).toEqual([
    [1, "pembelian", 10, 10, null],
    [1, "pembelian", 5, 15, null],
    [1, "rusak", -3, 12, "pecah"],
  ]);

  // the row's adjust form shows the count and what it becomes as the difference is typed
  await page.goto(`/admin/inventaris/stok?search=${tag}`);
  await openModal(page, page.locator(".fi-ta-row").getByRole("button", { name: "Sesuaikan" }));
  await expect(modal.locator(".fi-sc-text").first()).toHaveText("Stok saat ini: 12");
  await modal.locator('[id="mountedActionSchema0.delta"]').fill("-20");
  await expect(modal.locator(".fi-sc-text.fi-color-danger")).toHaveText("Stok menjadi: -8");
});

test("the product page's stock buttons ask which branch, and branch staff book only their own", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto(`/admin/produk/${productId}`);
  await openModal(page, page.getByRole("button", { name: "Sesuaikan Stok" }));

  const modal = page.locator(".fi-modal-open .fi-modal-window");

  await expect(modal.locator(".fi-sc-text").filter({ hasText: "Pilih cabang" })).toHaveText("Pilih cabang untuk melihat stok saat ini.");
  await modal.locator(".fi-select-input-btn").click();
  // only the branches that hold the product
  await expect(modal.locator(".fi-select-input-option")).toHaveText(["Apotek Inofarma Kapten Yusuf"]);
  await modal.locator(".fi-select-input-option").click();
  await expect(modal.locator(".fi-sc-text").filter({ hasText: "Stok saat ini" })).toHaveText("Stok saat ini: 12");

  expect((await post(page.request, page, `/admin/produk/${productId}/stok/sesuaikan-stok`, { branchId: "2", delta: "1", reason: "penyesuaian" })).body.errors).toEqual({ branchId: ["Kolom cabang yang dipilih tidak valid."] });
  expect((await post(page.request, page, `/admin/produk/${productId}/stok/sesuaikan-stok`, { branchId: "1", delta: "2", reason: "penyesuaian" })).body.toast.title).toBe(`Stok "${tag} Stok" di Apotek Inofarma Kapten Yusuf disesuaikan.`);

  await signIn(page, people.apj.email);
  await page.goto(`/admin/produk/${productId}`);

  const elsewhere = await post(page.request, page, `/admin/produk/${productId}/stok/terima-barang`, { branchId: "2", expiresAt: "2027-12-31", quantity: "1" });

  expect(elsewhere.body.errors).toEqual({ branchId: ["Kolom cabang yang dipilih tidak valid.", "Anda hanya bisa menambah stok di cabang Anda sendiri."] });
  expect((await stockAt(1)).quantity).toBe(14);
});

test("a transfer: requested, shipped with its batches, received, and one cancelled", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/inventaris/transfer/create");

  const refused = await post(page.request, page, "/admin/inventaris/transfer/buat", { from_branch_id: "1", to_branch_id: "1", product_id: String(productId), quantity: "999" });

  expect(refused.body.errors).toEqual({ to_branch_id: ["Cabang tujuan harus berbeda dari cabang asal."], quantity: ["Stok di cabang asal hanya tersisa 14."] });

  const created = await post(page.request, page, "/admin/inventaris/transfer/buat", { from_branch_id: "1", to_branch_id: "2", product_id: String(productId), quantity: "4", note: "ZZ kirim" });
  const [transfer] = await db.select().from(stockTransfers).where(eq(stockTransfers.productId, productId));

  expect(created.body.redirect).toBe(`/admin/inventaris/transfer/${transfer.id}`);
  expect(transfer).toMatchObject({ code: expect.stringMatching(/^TRF-\d{3,}$/), status: "diminta", requestedBy: staffIds[0], quantity: 4 });

  await page.goto(`/admin/inventaris/transfer/${transfer.id}`);
  await expect(page.locator(".fi-header-actions-ctn").getByRole("button")).toHaveText(["Kirim", "Batalkan"]);
  await page.locator(".fi-header-actions-ctn").getByRole("button", { name: "Kirim" }).click();
  await expect(page.locator(".fi-no-notification-title").filter({ visible: true })).toHaveText(`Transfer ${transfer.code} dikirim dari Apotek Inofarma Kapten Yusuf.`);
  await expect(page.locator(".fi-header-actions-ctn").getByRole("button")).toHaveText(["Terima"]);

  const shipped = (await db.select().from(stockTransfers).where(eq(stockTransfers.id, transfer.id)))[0];

  // soonest expiry first, written onto the transfer
  expect(shipped).toMatchObject({ status: "dikirim", batchesShipped: [{ batch_id: expect.any(Number), batch_number: "B1", expires_at: "2027-12-31", quantity: 4 }] });
  expect((await post(page.request, page, `/admin/inventaris/transfer/${transfer.id}/kirim`)).body.toast).toMatchObject({ status: "danger", title: `Transfer ${transfer.code} sudah diproses dan tidak bisa dikirim ulang.` });

  // the destination's staff (Staf Gudang of CB-002) receive it; the batch lands with its expiry
  await signIn(page, people.gudang.email);
  await page.goto(`/admin/inventaris/transfer/${transfer.id}`);
  expect((await post(page.request, page, `/admin/inventaris/transfer/${transfer.id}/terima`)).body.toast.title).toBe(`Transfer ${transfer.code} diterima di Apotek Inofarma Otista.`);
  expect((await db.select().from(inventoryBatches).where(and(eq(inventoryBatches.productId, productId), eq(inventoryBatches.branchId, 2))))[0]).toMatchObject({ batchNumber: "B1", expiresAt: "2027-12-31", quantity: 4 });
  expect((await movements()).slice(-2)).toEqual([
    [1, "transfer keluar", -4, 10, `Transfer ${transfer.code} ke Apotek Inofarma Otista`],
    [2, "transfer masuk", 4, 4, `Transfer ${transfer.code} dari Apotek Inofarma Kapten Yusuf`],
  ]);

  // the APJ of CB-001 sees the transfer; a second one is cancelled before it ships
  await signIn(page, people.apj.email);
  await page.goto("/admin/inventaris/transfer");
  await expect(page.locator(".fi-ta-row").filter({ hasText: transfer.code })).toHaveCount(1);
  await post(page.request, page, "/admin/inventaris/transfer/buat", { from_branch_id: "1", to_branch_id: "2", product_id: String(productId), quantity: "1" });

  const [, second] = await db.select().from(stockTransfers).where(eq(stockTransfers.productId, productId)).orderBy(asc(stockTransfers.id));

  expect((await post(page.request, page, "/admin/inventaris/transfer/buat", { from_branch_id: "2", to_branch_id: "1", product_id: String(productId), quantity: "1" })).body.errors).toMatchObject({
    from_branch_id: ["Anda hanya bisa meminta transfer dari cabang Anda sendiri."],
  });
  expect((await post(page.request, page, `/admin/inventaris/transfer/${second.id}/batalkan`)).body.toast.title).toBe(`Transfer ${second.code} dibatalkan.`);
  expect((await db.select().from(stockTransfers).where(eq(stockTransfers.id, second.id)))[0]).toMatchObject({ status: "dibatalkan", cancelledAt: expect.any(Date) });
});

test("stock by CSV: imported per product and branch, exported, and the matrix", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/inventaris/stok");

  const csv = `sku,branch,batch_number,expires_at,quantity\n${tag}-S,CB-001,B1,2027-12-31,6\nNOPE,CB-001,,2027-01-01,1\n`;
  const response = await page.request.post("/admin/inventaris/stok/impor", {
    multipart: { data: "{}", file: { name: "stok.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } },
    headers: { Accept: "application/json", Origin: new URL(page.url()).origin },
  });

  expect((await response.json()).toast).toMatchObject({
    status: "warning",
    title: "Import stok selesai: 1 produk per cabang diperbarui.",
    body: 'Produk dengan SKU "NOPE" tidak ditemukan. Import produk lebih dulu. (1 baris: Baris 3)',
    persistent: true,
  });
  // the other batch at CB-001 is counted to zero
  expect((await stockAt(1)).quantity).toBe(6);

  const exported = await page.request.get("/form/admin/inventaris/stok/ekspor");

  expect(exported.headers()["content-disposition"]).toMatch(/^attachment; filename=stok-\d{8}-\d{6}\.csv$/);
  expect(await exported.text()).toContain(`${tag}-S,CB-001,B1,2027-12-31,6,1\n`);
  expect(await (await page.request.get("/form/admin/inventaris/stok/template")).text()).toBe("﻿sku,branch_code,batch_number,expires_at,quantity,is_listed\nPRD-001,CB-001,BN2401A,2027-06-30,120,1\nPRD-001,CB-001,,2027-12-31,80,\n");

  // the matrix: one row per product, a column per active branch
  await page.goto("/admin/inventaris/matriks");

  const row = page.locator(".fi-ta-row").filter({ hasText: `${tag} Stok` });

  await expect(row.locator(".fi-ta-cell-branch2 .fi-badge").first()).toHaveText("4");
});

test("Faktur and Rekonsiliasi: a refund recorded and audited, the payment log, and who may see them", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto(`/admin/faktur/${orderId}`);
  await openModal(page, page.getByRole("button", { name: "Catat Refund" }));
  // the note is required in the browser too
  await expect(page.locator('.fi-modal-open textarea[required]')).toHaveCount(1);

  const refunded = await post(page.request, page, `/admin/faktur/${orderId}/refund`, { note: "uang kembali" });

  expect(refunded.body.toast.title).toBe(`Refund untuk #${tag}-F dicatat.`);
  expect((await db.select().from(orders).where(eq(orders.id, orderId)))[0].paymentStatus).toBe("refund");
  expect((await db.select().from(payments).where(eq(payments.orderId, orderId)))[0]).toMatchObject({ status: "refunded", refundNote: "uang kembali", refundedAt: expect.any(Date) });
  expect((await db.select().from(auditLogs).where(and(eq(auditLogs.action, "faktur.refund"), eq(auditLogs.auditableId, orderId))))[0]).toMatchObject({
    userId: staffIds[0],
    branchId: 1,
    oldValues: { payment_status: "lunas" },
    newValues: { payment_status: "refund", note: "uang kembali" },
  });
  // only a paid invoice can be refunded
  expect((await post(page.request, page, `/admin/faktur/${orderId}/refund`, { note: "lagi" })).status).toBe(403);

  await page.goto(`/admin/faktur?search=${tag}`);
  await expect(page.locator(".fi-ta-row .fi-badge")).toHaveText(["Refund"]);
  await page.goto(`/admin/rekonsiliasi?search=${tag}`);
  await expect(page.locator(".fi-ta-row").filter({ hasText: `${tag}-F` }).locator(".fi-badge")).toHaveText("Refunded");

  // global search finds the invoice by its number
  const found = await page.request.get(`/form/admin/cari?q=${tag}-F`);

  expect(JSON.stringify(await found.json())).toContain(`/admin/faktur/${orderId}`);

  // Staf Gudang has no Pesanan:Lihat; another branch's invoice is a 404
  // (opened as pages: the dev server can reset a bare request to a page it is still compiling)
  await signIn(page, people.gudang.email);
  expect((await page.goto("/admin/faktur"))?.status()).toBe(403);
  await signIn(page, people.apj.email);
  expect((await page.goto(`/admin/faktur/${orderId}`))?.status()).toBe(200);
  expect((await page.goto("/admin/faktur/9"))?.status()).toBe(404);
  expect((await post(page.request, page, `/admin/faktur/${orderId}/refund`, { note: "x" })).status).toBe(403);
  await expect.poll(async () => (await db.select().from(stockTransfers).where(like(stockTransfers.code, "TRF-%"))).length).toBeGreaterThan(0);
});
