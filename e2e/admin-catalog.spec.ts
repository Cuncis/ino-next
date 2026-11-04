import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { and, eq, ilike, inArray, like, or } from "drizzle-orm";
import { attributes, auditLogs, branchStocks, categories, db, inventoryBatches, inventoryMovements, modelHasRoles, productImages, products, roles, suppliers, users } from "../src/db";
import { hashLaravelPassword } from "../src/lib/password";

process.loadEnvFile(".env.local");

/**
 * Step 7.3 of the admin: Produk (form, photos, bulk actions, CSV import and export),
 * Kategori, Atribut and Pemasok, with Laravel's messages, audit entries and permissions.
 * Every record it makes is named "ZZT<stamp> …" and removed afterwards.
 */
const stamp = Date.now() % 1_000_000;
const tag = `ZZT${stamp}`;
const password = "Zz-Catalog-Pass-1";
const people = {
  admin: { email: `zz-catalog-admin-${stamp}@example.com`, role: "Super Admin", branch: null as number | null },
  apj: { email: `zz-catalog-apj-${stamp}@example.com`, role: "APJ Cabang", branch: 1 as number | null },
  kasir: { email: `zz-catalog-kasir-${stamp}@example.com`, role: "Kasir", branch: 1 as number | null },
};
const staffIds: number[] = [];
const PHOTO = path.join(process.cwd(), "public/media/images/product/p-1.png");

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
});

test.afterAll(async () => {
  const made = await db.select({ id: products.id }).from(products).where(or(like(products.name, `${tag} %`), ilike(products.sku, `${tag}-%`)));
  const ids = made.map((product) => product.id);

  if (ids.length) {
    await db.delete(inventoryMovements).where(inArray(inventoryMovements.productId, ids));
    await db.delete(inventoryBatches).where(inArray(inventoryBatches.productId, ids));
    await db.delete(branchStocks).where(inArray(branchStocks.productId, ids));
    await db.delete(productImages).where(inArray(productImages.productId, ids));
    await db.delete(auditLogs).where(and(eq(auditLogs.auditableType, "App\\Models\\Product"), inArray(auditLogs.auditableId, ids)));
    await db.delete(products).where(inArray(products.id, ids));

    for (const id of ids) {
      rmSync(path.join(process.cwd(), "public/storage/products", String(id)), { recursive: true, force: true });
    }
  }

  await db.delete(categories).where(like(categories.name, `${tag} %`));
  await db.delete(suppliers).where(like(suppliers.name, `${tag} %`));
  await db.delete(attributes).where(like(attributes.name, `${tag} %`));
  await db.delete(auditLogs).where(inArray(auditLogs.userId, staffIds));
  await db.delete(modelHasRoles).where(and(eq(modelHasRoles.modelType, "App\\Models\\User"), inArray(modelHasRoles.modelId, staffIds)));
  await db.delete(users).where(inArray(users.id, staffIds));
  await db.$client.end();
});

async function signIn(page: Page, email: string) {
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

/** A multipart action with one file, as FiFileUpload sends it. */
async function upload(request: APIRequestContext, page: Page, url: string, field: string, file: { name: string; mimeType: string; buffer: Buffer }, data: unknown = {}) {
  const response = await request.post(url, { multipart: { data: JSON.stringify(data), [field]: file }, headers: { Accept: "application/json", Origin: new URL(page.url()).origin } });

  return { status: response.status(), body: await response.json().catch(() => null) };
}

const visible = (page: Page, selector: string) => page.locator(selector).filter({ visible: true }).first();

async function openModal(page: Page, button: ReturnType<Page["locator"]>) {
  await expect(async () => {
    await button.click();
    await expect(page.locator(".fi-modal-open .fi-modal-window")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
}

async function productNamed(name: string) {
  return (await db.select().from(products).where(eq(products.name, name)))[0];
}

let categoryId: number;
let supplierId: number;

test("categories, attributes and suppliers: forms, unique names, and the in-use guard", async ({ page }) => {
  await signIn(page, people.admin.email);

  const category = await post(page.request, page, "/admin/kategori/buat", { name: `${tag} Kat`, slug: "", status: "aktif", description: "" });

  expect(category.body.toast.title).toBe("Data berhasil dibuat");
  [{ id: categoryId }] = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, `${tag} Kat`));
  expect(category.body.redirect).toBe(`/admin/kategori/${categoryId}/edit`);
  expect((await db.select().from(categories).where(eq(categories.id, categoryId)))[0]).toMatchObject({ slug: `${tag.toLowerCase()}-kat`, description: null, status: "aktif" });

  const twice = await post(page.request, page, "/admin/kategori/buat", { name: `${tag} Kat`, slug: "Bukan Slug", status: "" });

  expect(twice.status).toBe(422);
  expect(twice.body.errors).toEqual({
    name: ["Kategori dengan nama ini sudah ada."],
    slug: ["Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung."],
    status: ["Kolom status wajib diisi."],
  });

  // an emptied slug keeps the old one
  expect((await post(page.request, page, `/admin/kategori/${categoryId}/simpan`, { name: `${tag} Kat`, slug: "", status: "nonaktif", description: "Isi" })).body.toast.title).toBe("Data berhasil disimpan");
  expect((await db.select().from(categories).where(eq(categories.id, categoryId)))[0]).toMatchObject({ slug: `${tag.toLowerCase()}-kat`, status: "nonaktif", description: "Isi" });

  const supplier = await post(page.request, page, "/admin/pemasok/buat", {
    name: `${tag} Toko`,
    contact_person: "Pemilik",
    email: `zz-${stamp}@example.com`,
    phone: "telepon",
    license_number: `SIA/${tag}`,
    kota: "Jakarta",
    status: "aktif",
  });

  expect(supplier.body.errors).toEqual({ phone: ["Nomor telepon hanya boleh berisi angka, spasi, dan tanda + - ( )."] });

  const created = await post(page.request, page, "/admin/pemasok/buat", {
    name: `${tag} Toko`,
    contact_person: "Pemilik",
    email: `zz-${stamp}@example.com`,
    phone: "+62 812 (345)",
    license_number: `SIA/${tag}`,
    kota: "Jakarta",
    status: "aktif",
  });
  const [saved] = await db.select().from(suppliers).where(eq(suppliers.name, `${tag} Toko`));

  supplierId = saved.id;
  expect(created.body.redirect).toBe(`/admin/pemasok/${supplierId}/edit`);
  expect(saved.code).toMatch(/^SEL-\d{3,}$/);
  expect(saved.addressLine).toBeNull();

  const attribute = await post(page.request, page, "/admin/atribut/buat", { name: `${tag} Bentuk`, type: "pilihan", values: [] });

  expect(attribute.body.errors).toEqual({ values: ["Kolom nilai wajib diisi."] });
  await post(page.request, page, "/admin/atribut/buat", { name: `${tag} Bentuk`, type: "pilihan", values: ["Tablet", "Kapsul"] });

  const [shape] = await db.select().from(attributes).where(eq(attributes.name, `${tag} Bentuk`));

  expect(shape).toMatchObject({ slug: `${tag.toLowerCase()}-bentuk`, values: ["Tablet", "Kapsul"] });
  // a "Teks" attribute keeps no values
  await post(page.request, page, `/admin/atribut/${shape.id}/simpan`, { name: `${tag} Bentuk`, type: "teks", values: ["Tablet"] });
  expect((await db.select().from(attributes).where(eq(attributes.id, shape.id)))[0].values).toBeNull();

  // the list and its form, in the browser
  await page.goto(`/admin/atribut?search=${tag}`);
  await expect(page.locator(".fi-ta-row")).toHaveCount(1);
  await expect(page.locator(".fi-ta-row")).toContainText("Teks");
  await page.goto("/admin/atribut/create");
  await expect(visible(page, '[id="form.values"]')).toBeVisible();
  await visible(page, '[id="form.type"]').selectOption("teks");
  await expect(page.locator('[id="form.values"]').filter({ visible: true })).toHaveCount(0);
});

let productId: number;

test("a product through its form: photo, Laravel's messages, audit trail, edit, delete and restore", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/produk/create");
  await page.waitForFunction(() => Object.keys(document.querySelector("form#form") ?? {}).some((key) => key.startsWith("__reactFiber")));

  const choose = async (field: string, text: string) => {
    const root = page.locator(".fi-select-input").filter({ has: page.locator(`[id="form.${field}"]`), visible: true }).first();

    await root.locator(".fi-select-input-btn").click();
    await root.locator(".fi-select-input-search-ctn input").fill(text);
    await root.locator(".fi-select-input-option", { hasText: text }).first().click();
  };

  await visible(page, '[id="form.name"]').fill(`${tag} Produk`);
  await choose("category_id", `${tag} Kat`);
  await choose("supplier_id", `${tag} Toko`);
  await visible(page, '[id="form.unit"]').selectOption("Strip");
  await visible(page, '[id="form.status"]').selectOption("aktif");
  await visible(page, '[id="form.drug_class"]').selectOption("bebas terbatas");
  await visible(page, '[id="form.price"]').fill("15000");
  await visible(page, '[id="form.old_price"]').fill("1000");
  await page.locator(".fi-fo-file-upload").filter({ visible: true }).first().locator("input.filepond--browser").setInputFiles(PHOTO);
  await expect(page.locator(".filepond--file-status-main").filter({ visible: true })).toHaveText("Upload complete", { timeout: 20_000 });
  await page.locator(".fi-sc-actions").filter({ visible: true }).getByRole("button", { name: "Buat", exact: true }).click();
  await expect(page.locator("[data-validation-error]").filter({ visible: true })).toHaveText(["Harga coret harus lebih besar dari harga jual."]);

  await visible(page, '[id="form.old_price"]').fill("20000");
  await page.locator(".fi-sc-actions").filter({ visible: true }).getByRole("button", { name: "Buat", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/produk\/\d+$/, { timeout: 60_000 });
  // the toast survives the move to the product's page, as Filament flashes it
  await expect(page.locator(".fi-no-notification-title").filter({ visible: true })).toHaveText("Data berhasil dibuat");

  const product = await productNamed(`${tag} Produk`);

  productId = product.id;
  expect(product).toMatchObject({ sku: expect.stringMatching(/^PRD-\d{3,}$/), slug: `${tag.toLowerCase()}-produk`, categoryId, supplierId, price: 15000, oldPrice: 20000, maxQtyPerOrder: 2, requiresPrescription: false, blurb: null });

  const [photo] = await db.select().from(productImages).where(eq(productImages.productId, productId));

  expect(photo).toMatchObject({ position: 1, isPrimary: true, path: expect.stringMatching(new RegExp(`/storage/products/${productId}/[0-9a-f-]+\\.jpg$`)) });
  const stored = path.join(process.cwd(), "public", new URL(photo.path).pathname);

  expect(existsSync(stored)).toBe(true);
  expect(existsSync(stored.replace(/\.jpg$/, "-thumb.jpg"))).toBe(true);
  await expect(page.locator(".fi-ta-image img")).toHaveCount(1);

  const [added] = await db.select().from(auditLogs).where(and(eq(auditLogs.auditableType, "App\\Models\\Product"), eq(auditLogs.auditableId, productId)));

  expect(added).toMatchObject({ action: "produk_ditambahkan", userId: staffIds[0], branchId: null, oldValues: null, newValues: { name: `${tag} Produk`, price: 15000, drug_class: "bebas terbatas", status: "aktif" } });

  const edited = await post(page.request, page, `/admin/produk/${productId}/simpan`, {
    name: `${tag} Produk`,
    category_id: String(categoryId),
    supplier_id: String(supplierId),
    unit: "Strip",
    status: "nonaktif",
    drug_class: "bebas terbatas",
    price: "16000",
    old_price: "",
    max_qty_per_order: "4",
    blurb: "",
  });

  expect(edited.body.toast.title).toBe("Data berhasil disimpan");

  const audits = await db.select().from(auditLogs).where(and(eq(auditLogs.auditableType, "App\\Models\\Product"), eq(auditLogs.auditableId, productId), eq(auditLogs.action, "produk_diubah")));

  expect(audits).toHaveLength(1);
  expect(audits[0].oldValues).toMatchObject({ price: 15000, status: "aktif", warning: null });
  expect(audits[0].newValues).toMatchObject({ price: 16000, status: "nonaktif" });
  expect((await post(page.request, page, `/admin/produk/${productId}/simpan`, { name: "" })).body.errors).toMatchObject({
    name: ["Kolom nama Produk wajib diisi."],
    category_id: ["Kolom kategori wajib diisi."],
    max_qty_per_order: ["Kolom maks. pembelian per transaksi wajib diisi."],
  });

  const deleted = await post(page.request, page, `/admin/produk/${productId}/hapus`, { back: "list" });

  expect(deleted.body).toMatchObject({ toast: { title: "Data berhasil dihapus" }, redirect: "/admin/produk" });

  const [gone] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "produk_dihapus"), eq(auditLogs.userId, staffIds[0])));

  // AuditLogger::log() with no record: filed against the staff member, name and SKU as old values
  expect(gone).toMatchObject({ auditableType: "App\\Models\\User", auditableId: staffIds[0], oldValues: { name: `${tag} Produk`, sku: product.sku }, newValues: null });
  expect((await post(page.request, page, `/admin/produk/${productId}/pulihkan`)).body.toast.title).toBe("Data berhasil dipulihkan");
  expect((await productNamed(`${tag} Produk`)).deletedAt).toBeNull();
});

test("photos: upload, main photo, order and delete", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto(`/admin/produk/${productId}`);

  const png = { name: "foto.png", mimeType: "image/png", buffer: (await import("node:fs")).readFileSync(PHOTO) };

  expect((await upload(page.request, page, `/admin/produk/${productId}/gambar/unggah`, "images", png)).status).toBe(200);
  expect((await upload(page.request, page, `/admin/produk/${productId}/gambar/unggah`, "images", { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") })).body.errors).toEqual({
    images: ["Kolom gambar harus berupa gambar."],
  });

  let photos = await db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(productImages.position);

  expect(photos.map((photo) => [photo.position, photo.isPrimary])).toEqual([
    [1, true],
    [2, false],
  ]);

  // the view page's table: the second can become the main one, but nothing is deleted here
  await page.reload();
  await expect(page.locator(".fi-ta-row")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Hapus" })).toHaveCount(0);
  await page.locator(".fi-ta-row").nth(1).getByRole("button", { name: "Jadikan Utama" }).click();
  await expect.poll(async () => (await db.select().from(productImages).where(eq(productImages.id, photos[1].id)))[0].isPrimary).toBe(true);

  await post(page.request, page, `/admin/produk/${productId}/gambar/urutan`, { order: [photos[1].id, photos[0].id] });
  photos = await db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(productImages.position);
  expect(photos.map((photo) => [photo.position, photo.isPrimary])).toEqual([
    [1, true],
    [2, false],
  ]);

  // deleting the main photo hands its place to the first one left
  const removed = await post(page.request, page, `/admin/produk/${productId}/gambar/${photos[0].id}/hapus`);

  expect(removed.body.toast.title).toBe("Data berhasil dihapus");
  expect((await db.select().from(productImages).where(eq(productImages.productId, productId))).map((photo) => photo.isPrimary)).toEqual([true]);
});

test("bulk actions: status audited per change, the purchase limit, and deletions that report failures", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto(`/admin/produk?search=${tag}`);

  const now = new Date();
  const [second] = await db
    .insert(products)
    .values({ sku: `${tag}-B`, name: `${tag} Kedua`, slug: `${tag.toLowerCase()}-kedua`, categoryId, price: 1000, status: "arsip", createdAt: now, updatedAt: now })
    .returning();
  const ids = [String(productId), String(second.id)];

  expect((await post(page.request, page, "/admin/produk/massal/status", { ids, status: "" })).body.errors).toEqual({ status: ["Kolom status wajib diisi."] });
  expect((await post(page.request, page, "/admin/produk/massal/status", { ids, status: "arsip" })).body.toast.title).toBe("2 produk diperbarui.");

  const statusAudits = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "produk_diubah"), inArray(auditLogs.auditableId, [productId, second.id])));

  // only the product that changed
  expect(statusAudits.filter((audit) => audit.newValues && JSON.stringify(audit.newValues) === '{"status":"arsip"}').map((audit) => audit.auditableId)).toEqual([productId]);

  expect((await post(page.request, page, "/admin/produk/massal/maks-pembelian", { ids, max_qty_per_order: "0" })).body.errors).toEqual({
    max_qty_per_order: ["Kolom maks. pembelian per transaksi minimal bernilai 1."],
  });
  await post(page.request, page, "/admin/produk/massal/maks-pembelian", { ids, max_qty_per_order: "7" });
  expect((await db.select().from(products).where(inArray(products.id, [productId, second.id]))).map((product) => product.maxQtyPerOrder)).toEqual([7, 7]);

  // the bulk menu in the browser
  await page.reload();
  await page.locator(".fi-ta-record-checkbox").first().check();
  await page.getByRole("button", { name: "Tindakan", exact: true }).click();
  await expect(page.locator(".fi-dropdown-list-item-label")).toHaveText(["Ubah Maks. Pembelian", "Ubah Status", "Hapus yang dipilih"]);

  expect((await post(page.request, page, "/admin/produk/massal/hapus", { ids })).body.toast.title).toBe("Data berhasil dihapus");

  // a stock movement holds the first product: one of two goes, the rest is reported
  await db.insert(inventoryMovements).values({ branchId: 1, productId, type: "penyesuaian", quantity: 1, balanceAfter: 1, createdAt: now, updatedAt: now });

  const partial = await post(page.request, page, "/admin/produk/massal/hapus-permanen", { ids });

  expect(partial.body.toast).toMatchObject({ status: "warning", title: "Menghapus 1 dari 2", body: "1 tidak dapat dihapus.", persistent: true });
  expect((await post(page.request, page, "/admin/produk/massal/pulihkan", { ids })).body.toast.title).toBe("Data berhasil dipulihkan");
  await db.delete(inventoryMovements).where(eq(inventoryMovements.productId, productId));

  // a category still holding products refuses a single delete, with Laravel's words
  const guarded = await post(page.request, page, `/admin/kategori/${categoryId}/hapus`);

  expect(guarded.body.toast).toMatchObject({ status: "danger", title: `Kategori "${tag} Kat" masih dipakai 1 produk dan tidak bisa dihapus.` });
});

test("the CSV import and export: products and stock in one file, failures folded by cause", async ({ page }) => {
  await signIn(page, people.admin.email);
  await page.goto("/admin/produk/impor");

  const sku = (await productNamed(`${tag} Produk`)).sku;
  const csv = [
    "sku;name;category;unit;price;drug_class;weight_grams;branch;batch_number;expires_at;quantity;is_listed",
    `${tag}-1;${tag} Impor;${tag} Kat Baru;Botol;1000;bebas;10;CB-001;B1;2027-01-31;5;1`,
    `${tag.toLowerCase()}-1;;;;;;;CB-001;;28/02/2027;3;`,
    `${tag}-2;${tag} Salah;${tag} Kat Baru;Botol;2.500;bebas;10;;;;;`,
    `${sku};;;;17000;;;CB-002;BZ;2027-03-31;4;0`,
    `${tag}-3;${tag} Tiga;${tag} Kat Baru;Box;3000;bebas terbatas;5;Cabang Antah;;2027-01-01;1;`,
  ].join("\n");
  // Excel's byte-order mark is dropped; PHP's trim() leaves it, so a file of only a mark isn't "empty"
  const file = (content: string, bom = true) => ({ name: "produk-stok.csv", mimeType: "text/csv", buffer: Buffer.from(`${bom ? "\uFEFF" : ""}${content}`) });
  const result = await upload(page.request, page, "/admin/produk/impor/katalog", "file", file(csv));

  expect(result.body.toast.title).toBe("Import selesai: 2 produk baru, 1 diperbarui, 2 stok produk per cabang diperbarui.");
  expect(result.body.result).toMatchObject({
    kind: "produk-stok",
    created: 2,
    updated: 1,
    warnedInactive: 1,
    groups: 2,
    zeroed: 0,
    failedCount: 2,
    failures: [
      { message: 'Kolom price harus berupa bilangan bulat tanpa titik, koma, atau "Rp" (contoh: 15000).', count: 1, rows: [4], more: 0 },
      { message: 'Cabang "Cabang Antah" tidak ditemukan (isi dengan kode atau nama cabang).', count: 1, rows: [6], more: 0 },
    ],
  });

  const imported = await productNamed(`${tag} Impor`);
  const batches = await db.select().from(inventoryBatches).where(eq(inventoryBatches.productId, imported.id)).orderBy(inventoryBatches.batchNumber);

  expect(batches.map((batch) => [batch.batchNumber, batch.expiresAt, batch.quantity])).toEqual([
    ["B1", "2027-01-31", 5],
    ["EXP-20270228", "2027-02-28", 3],
  ]);
  expect((await db.select().from(branchStocks).where(eq(branchStocks.productId, imported.id)))[0]).toMatchObject({ branchId: 1, quantity: 8, isListed: true });
  expect((await db.select().from(inventoryMovements).where(eq(inventoryMovements.productId, imported.id))).map((movement) => [movement.type, movement.quantity, movement.balanceAfter, movement.note])).toEqual([
    ["penyesuaian", 5, 5, "Impor produk dan stok CSV (produk-stok.csv)"],
    ["penyesuaian", 3, 8, "Impor produk dan stok CSV (produk-stok.csv)"],
  ]);
  expect((await productNamed(`${tag} Tiga`)).status).toBe("nonaktif");
  expect((await productNamed(`${tag} Produk`)).price).toBe(17000);

  // a count without batch numbers is one batch per expiry date; the batches not in it go to zero
  const recount = await upload(page.request, page, "/admin/produk/impor/katalog", "file", file(`sku;branch;expires_at;quantity\n${tag}-1;CB-001;2027-01-31;2`));

  expect(recount.body.result).toMatchObject({ created: 0, updated: 0, groups: 1, zeroed: 2, failedCount: 0 });
  expect((await upload(page.request, page, "/admin/produk/impor/katalog", "file", file("  \n", false))).body.toast).toMatchObject({ status: "danger", title: "Import gagal", body: "File CSV kosong." });
  expect((await upload(page.request, page, "/admin/produk/impor/katalog", "file", file("  \n"))).body.toast).toMatchObject({ body: "Kolom wajib tidak ada di file: sku." });
  expect((await upload(page.request, page, "/admin/produk/impor/katalog", "file", file("nama\nx"))).body.toast).toMatchObject({ body: "Kolom wajib tidak ada di file: sku." });

  // the summary on the page, after an import in the browser
  await openModal(page, page.getByRole("button", { name: "Import Produk & Stok" }));
  await page.locator(".fi-modal-open .fi-fo-file-upload input.filepond--browser").setInputFiles({ name: "stok.csv", mimeType: "text/csv", buffer: Buffer.from(`sku;branch;expires_at;quantity\n${tag}-1;CB-001;2027-01-31;2\n;CB-001;2027-01-31;1`) });
  await expect(page.locator(".fi-modal-open .filepond--file-status-main")).toHaveText("Upload complete", { timeout: 20_000 });
  await page.locator(".fi-modal-open").getByRole("button", { name: "Kirim" }).click();
  await expect(page.locator(".fi-page-content")).toContainText("Baris yang gagal di-import");
  await expect(page.locator(".fi-page-content")).toContainText("Kolom sku wajib diisi.");

  const exported = await page.request.get("/form/admin/produk/impor/ekspor");

  expect(exported.headers()["content-disposition"]).toMatch(/^attachment; filename=produk-stok-\d{8}-\d{6}\.csv$/);

  const exportText = await exported.text();

  expect(exportText.startsWith("﻿sku,name,category,unit,price,old_price,")).toBe(true);
  expect(exportText).toContain(`${tag}-1,"${tag} Impor","${tag} Kat Baru",Botol,1000,,bebas,0,,,,,,,,,,"suhu ruang",10,2,aktif,,CB-001,EXP-20270131,2027-01-31,2,1`);

  const template = await (await page.request.get("/form/admin/produk/impor/template")).text();

  // the second sample row: only the SKU of the product, then its second batch
  expect(template.split("\n")[2]).toBe(["PRD-001", ...Array(21).fill(""), "CB-001", "", "2027-12-31", "80", ""].join(","));
});

test("who may do what: Kasir has no products, APJ can't delete and imports stock only for its branch", async ({ page }) => {
  await signIn(page, people.kasir.email);
  expect((await page.request.get("/admin/produk")).status()).toBe(403);
  expect((await page.request.get("/admin/kategori")).status()).toBe(403);

  await page.context().clearCookies();
  await signIn(page, people.apj.email);
  // APJ may change products (the form and the photos) but not delete them
  expect((await page.goto(`/admin/produk/${productId}/edit`))?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Upload Gambar" })).toBeVisible();
  await expect(page.locator(".fi-sc-actions").filter({ visible: true }).getByRole("button", { name: "Hapus" })).toHaveCount(0);
  expect((await page.request.get("/admin/kategori/1")).status()).toBe(404);
  expect((await page.request.get("/admin/produk/999999999")).status()).toBe(404);
  expect((await post(page.request, page, `/admin/produk/${productId}/hapus`)).status).toBe(403);
  await page.goto(`/admin/produk?search=${tag}`);
  // no Produk:Hapus, but the two "Ubah" bulk actions still need the checkboxes
  await page.locator(".fi-ta-record-checkbox").first().check();
  await page.getByRole("button", { name: "Tindakan", exact: true }).click();
  await expect(page.locator(".fi-dropdown-list-item-label")).toHaveText(["Ubah Maks. Pembelian", "Ubah Status"]);

  const imported = await upload(page.request, page, "/admin/produk/impor/katalog", "file", { name: "stok.csv", mimeType: "text/csv", buffer: Buffer.from(`sku,branch,expires_at,quantity\n${tag}-1,CB-002,2027-01-31,2`) });

  expect(imported.body.result.failures).toEqual([{ message: 'Anda tidak punya akses ke cabang "CB-002".', count: 1, rows: [2], more: 0 }]);
});
