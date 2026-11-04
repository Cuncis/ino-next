import { and, asc, count, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { auditLogs, branches, branchStocks, categories, db, productImages, products, suppliers, type DbExecutor } from "@/db";
import { branchScope, type ScopedStaff } from "@/lib/branch-scope";
import { nextCode } from "@/lib/code-sequence";
import type { FiColor } from "@/components/admin/filament/ui";
import type { ResourcePermissions } from "@/lib/permissions";
import { uniqueSlug } from "@/lib/slug";
import { auditLog } from "@/server/audit";
import { destroyProductImage, storeProductImage } from "@/server/catalog/product-image-uploader";
import { orderBy, searchWords, trashedCondition } from "./list-query";
import type { Staff } from "./staff-auth";

/**
 * The admin's Produk resource (ProductResource): the list with its bulk actions, the
 * product page, the form, and the photos (ImagesRelationManager).
 */
export const PRODUCT_PERMISSIONS: ResourcePermissions = { viewAny: "Produk:Lihat", create: "Produk:Tambah", update: "Produk:Ubah", delete: "Produk:Hapus" };

export const PRODUCT_MODEL = "App\\Models\\Product";
const USER_MODEL = "App\\Models\\User";

/** Product::MAX_QUANTITY_PER_ORDER and OVER_LIMIT_MESSAGE. */
export const MAX_QUANTITY_PER_ORDER = 2;
export const OVER_LIMIT_MESSAGE = "Produk ini memiliki maksimum jumlah pembelian untuk pemakaian 3 hari";

/** The fields EditProduct writes to the audit trail, before and after. */
const AUDITED_FIELDS = ["name", "price", "drug_class", "nie_bpom", "composition", "dosage", "side_effects", "warning", "manufacturer", "storage", "status"] as const;

export type Product = typeof products.$inferSelect;

export function productStatusColor(status: string): FiColor {
  return status === "aktif" ? "success" : status === "arsip" ? "gray" : "danger";
}

export function stockColor(quantity: number): FiColor {
  return quantity <= 0 ? "danger" : quantity <= 20 ? "warning" : "success";
}

/** Product::purchaseLimit(): its own limit, or the default. */
export function purchaseLimit(product: Pick<Product, "maxQtyPerOrder">): number {
  return product.maxQtyPerOrder || MAX_QUANTITY_PER_ORDER;
}

export type ProductListQuery = { search?: string; categoryId?: string; status?: string; trashed?: string; page: number; perPage: number };

/** The Produk list, by id, with the category and the stock summed over the staff member's branches. */
export async function listProducts(query: ProductListQuery, staff: ScopedStaff) {
  const where = and(
    trashedCondition(products.deletedAt, query.trashed),
    searchWords(query.search, [sql`${products.sku}`, sql`${products.name}`]),
    query.categoryId ? eq(products.categoryId, Number(query.categoryId)) : undefined,
    query.status ? eq(products.status, query.status) : undefined,
  );
  const stockScope = branchScope(branchStocks.branchId, staff);
  const stockSum = sql<string | null>`(select sum(${branchStocks.quantity}) from ${branchStocks} where ${branchStocks.productId} = ${products.id}${stockScope ? sql` and ${stockScope}` : sql``})`;

  const [{ total }] = await db.select({ total: count() }).from(products).where(where);
  const rows = await db
    .select({
      product: products,
      categoryName: sql<string | null>`(select ${categories.name} from ${categories} where ${categories.id} = ${products.categoryId} and ${categories.deletedAt} is null)`,
      stock: stockSum,
    })
    .from(products)
    .where(where)
    .orderBy(...orderBy(null, {}, { column: products.id, direction: "asc" }, products.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.product, categoryName: row.categoryName, stock: Number(row.stock ?? 0) })) };
}

/** Choices for the Kategori filter and the form's selects: names, alphabetically, without deleted ones. */
export async function categoryOptions(): Promise<{ value: string; label: string }[]> {
  const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).where(isNull(categories.deletedAt)).orderBy(asc(categories.name));

  return rows.map((row) => ({ value: String(row.id), label: row.name }));
}

export async function supplierOptions(): Promise<{ value: string; label: string }[]> {
  const rows = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(isNull(suppliers.deletedAt)).orderBy(asc(suppliers.name));

  return rows.map((row) => ({ value: String(row.id), label: row.name }));
}

/** A product an admin may open, deleted or not. */
export async function findAdminProduct(id: number): Promise<Product | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);

  return product ?? null;
}

/** Everything the product page shows: names of its category and seller, photos, and stock per branch. */
export async function productDetail(product: Product, staff: ScopedStaff) {
  const [[category], [supplier], images, stocks] = await Promise.all([
    db
      .select({ name: categories.name })
      .from(categories)
      .where(and(eq(categories.id, product.categoryId), isNull(categories.deletedAt)))
      .limit(1),
    product.supplierId
      ? db
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(and(eq(suppliers.id, product.supplierId), isNull(suppliers.deletedAt)))
          .limit(1)
      : Promise.resolve([]),
    productPhotos(product.id),
    db
      .select({ id: branchStocks.id, branchName: branches.name, quantity: branchStocks.quantity, reserved: branchStocks.reservedQuantity })
      .from(branchStocks)
      .leftJoin(branches, and(eq(branches.id, branchStocks.branchId), isNull(branches.deletedAt)))
      .where(and(eq(branchStocks.productId, product.id), branchScope(branchStocks.branchId, staff)))
      .orderBy(asc(branchStocks.id)),
  ]);

  return {
    categoryName: category?.name ?? null,
    supplierName: supplier?.name ?? null,
    images,
    stocks: stocks.map((stock) => ({ ...stock, available: Math.max(stock.quantity - stock.reserved, 0) })),
  };
}

export async function productPhotos(productId: number) {
  return db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.position), asc(productImages.id));
}

/* ---------------- the form ---------------- */

export type ProductFormData = {
  name: string;
  category_id: number;
  supplier_id: number;
  unit: string;
  status: string;
  drug_class: string;
  price: number;
  old_price: number | null;
  max_qty_per_order: number;
  blurb: string | null;
};

function columnsFrom(data: ProductFormData) {
  return {
    name: data.name,
    categoryId: data.category_id,
    supplierId: data.supplier_id,
    unit: data.unit,
    status: data.status,
    drugClass: data.drug_class,
    price: data.price,
    oldPrice: data.old_price,
    maxQtyPerOrder: data.max_qty_per_order,
    blurb: data.blurb,
    // no prescription drugs are sold, so this is never anything but false
    requiresPrescription: false,
  };
}

/** The audited fields of a product, named as Laravel's model attributes. */
function audited(product: Product): Record<string, unknown> {
  return Object.fromEntries(AUDITED_FIELDS.map((field) => [field, product[field.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) as keyof Product]]));
}

/**
 * CreateProduct: SKU PRD-001 onwards, a free slug from the name, then the photos picked
 * on the form (the first is the main one) and the audit entry. A photo that can't be
 * processed is counted, never undoing the product.
 */
export async function createProduct(data: ProductFormData, photos: Buffer[], staff: Staff): Promise<{ product: Product; failedPhotos: number }> {
  const now = new Date();
  const [product] = await db
    .insert(products)
    .values({
      ...columnsFrom(data),
      sku: await nextCode({ table: products, column: products.sku, prefix: "PRD-" }),
      slug: await uniqueSlug({ table: products, column: products.slug, value: data.name }),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  let failedPhotos = 0;

  for (const photo of photos) {
    try {
      await addPhoto(product.id, (await storeProductImage(photo, product.id)).path, true);
    } catch {
      failedPhotos++;
    }
  }

  await auditLog({
    action: "produk_ditambahkan",
    auditable: { type: PRODUCT_MODEL, id: product.id },
    newValues: { name: product.name, price: product.price, drug_class: product.drugClass, status: product.status },
    userId: staff.id,
    branchId: staff.branchId,
  });

  return { product, failedPhotos };
}

/** EditProduct: the form's fields, a slug that follows the name, and the audited fields before and after. */
export async function updateProduct(product: Product, data: ProductFormData, staff: Staff): Promise<Product> {
  const columns = columnsFrom(data);
  const changed = Object.entries(columns).some(([key, value]) => product[key as keyof Product] !== value) || product.slug !== (await slugFor(product, data.name));
  const [saved] = changed
    ? await db
        .update(products)
        .set({ ...columns, slug: await slugFor(product, data.name), updatedAt: new Date() })
        .where(eq(products.id, product.id))
        .returning()
    : [product];

  await auditLog({
    action: "produk_diubah",
    auditable: { type: PRODUCT_MODEL, id: product.id },
    oldValues: audited(product),
    newValues: audited(saved),
    userId: staff.id,
    branchId: staff.branchId,
  });

  return saved;
}

function slugFor(product: Product, name: string): Promise<string> {
  return uniqueSlug({ table: products, column: products.slug, value: name, idColumn: products.id, ignoreId: product.id });
}

/* ---------------- deleting ---------------- */

/**
 * DeleteAction's `produk_dihapus`: AuditLogger::log() with no record, so it is filed
 * against the staff member, and the name and SKU land in the old values.
 */
async function auditDeleted(product: Product, staff: Staff, executor: DbExecutor = db): Promise<void> {
  await auditLog({
    action: "produk_dihapus",
    auditable: { type: USER_MODEL, id: staff.id },
    oldValues: { name: product.name, sku: product.sku },
    userId: staff.id,
    branchId: staff.branchId,
    executor,
  });
}

/** The row's Hapus and EditProduct's: soft delete, audited. */
export async function deleteProduct(product: Product, staff: Staff): Promise<void> {
  await db.update(products).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(products.id, product.id));
  await auditDeleted(product, staff);
}

/** DeleteBulkAction: no audit entry, like Filament's own bulk delete. Already-deleted ones count as done. */
export async function softDeleteProduct(id: number): Promise<boolean> {
  await db
    .update(products)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(products.id, id), isNull(products.deletedAt)));

  return true;
}

export async function restoreProduct(id: number): Promise<boolean> {
  await db.update(products).set({ deletedAt: null, updatedAt: new Date() }).where(eq(products.id, id));

  return true;
}

/** Fails (false) while stock movements or transfers still point at the product. */
export async function forceDeleteProduct(id: number): Promise<boolean> {
  try {
    await db.delete(products).where(eq(products.id, id));

    return true;
  } catch {
    return false;
  }
}

/* ---------------- bulk actions ---------------- */

/** "Ubah Maks. Pembelian": the limit on every selected product, deleted ones too. */
export async function setPurchaseLimit(ids: number[], limit: number): Promise<void> {
  if (ids.length) {
    await db.update(products).set({ maxQtyPerOrder: limit, updatedAt: new Date() }).where(inArray(products.id, ids));
  }
}

/** "Ubah Status": each product that really changes gets its own `produk_diubah` entry. */
export async function setStatus(ids: number[], status: string, staff: Staff): Promise<void> {
  if (!ids.length) {
    return;
  }

  const changing = await db
    .select()
    .from(products)
    .where(and(inArray(products.id, ids), ne(products.status, status)))
    .orderBy(asc(products.id));

  for (const product of changing) {
    await db.update(products).set({ status, updatedAt: new Date() }).where(eq(products.id, product.id));
    await auditLog({
      action: "produk_diubah",
      auditable: { type: PRODUCT_MODEL, id: product.id },
      oldValues: { status: product.status },
      newValues: { status },
      userId: staff.id,
      branchId: staff.branchId,
    });
  }
}

/** The selected rows that exist (the list shows deleted ones only under the filter, but any id may be posted). */
export async function existingProductIds(ids: number[]): Promise<number[]> {
  if (!ids.length) {
    return [];
  }

  const rows = await db.select({ id: products.id }).from(products).where(inArray(products.id, ids)).orderBy(asc(products.id));

  return rows.map((row) => row.id);
}

/* ---------------- photos (ImagesRelationManager) ---------------- */

/** A photo goes at the end; it is the main one when the product has none yet (and `primaryIfNone`). */
export async function addPhoto(productId: number, path: string, primaryIfNone: boolean): Promise<void> {
  const [[{ highest }], [{ primaries }]] = await Promise.all([
    db.select({ highest: max(productImages.position) }).from(productImages).where(eq(productImages.productId, productId)),
    db
      .select({ primaries: count() })
      .from(productImages)
      .where(and(eq(productImages.productId, productId), eq(productImages.isPrimary, true))),
  ]);
  const now = new Date();

  await db.insert(productImages).values({
    productId,
    path,
    position: Number(highest ?? 0) + 1,
    isPrimary: primaryIfNone && primaries === 0,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * The Upload Gambar action: the files are stored first (one that can't be read fails the
 * whole upload, as Filament's FileUpload does), then added in order; the first is the
 * main photo when there was none.
 */
export async function uploadPhotos(productId: number, files: Buffer[]): Promise<void> {
  const paths: string[] = [];

  for (const file of files) {
    paths.push((await storeProductImage(file, productId)).path);
  }

  const [[{ highest }], [{ primaries }]] = await Promise.all([
    db.select({ highest: max(productImages.position) }).from(productImages).where(eq(productImages.productId, productId)),
    db
      .select({ primaries: count() })
      .from(productImages)
      .where(and(eq(productImages.productId, productId), eq(productImages.isPrimary, true))),
  ]);
  let position = Number(highest ?? 0) + 1;

  for (const [index, path] of paths.entries()) {
    const now = new Date();

    await db.insert(productImages).values({ productId, path, position: position++, isPrimary: primaries === 0 && index === 0, createdAt: now, updatedAt: now });
  }
}

export async function findPhoto(productId: number, imageId: number) {
  const [image] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .limit(1);

  return image ?? null;
}

export async function makePrimaryPhoto(productId: number, imageId: number): Promise<void> {
  await db.update(productImages).set({ isPrimary: false, updatedAt: new Date() }).where(eq(productImages.productId, productId));
  await db.update(productImages).set({ isPrimary: true, updatedAt: new Date() }).where(eq(productImages.id, imageId));
}

/**
 * Deletes a photo and its files (shipped `/media/...` art has none on the disk). When it
 * was the main photo, the first remaining one takes over.
 */
export async function deletePhoto(productId: number, image: typeof productImages.$inferSelect): Promise<void> {
  if (!image.path.startsWith("/media/")) {
    await destroyProductImage(image.path);
  }

  await db.delete(productImages).where(eq(productImages.id, image.id));

  if (image.isPrimary) {
    const [first] = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.position)).limit(1);

    if (first) {
      await db.update(productImages).set({ isPrimary: true, updatedAt: new Date() }).where(eq(productImages.id, first.id));
    }
  }
}

/** Filament's reorderable table: the ids in their new order get positions 1, 2, 3… */
export async function reorderPhotos(productId: number, orderedIds: number[]): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    await db
      .update(productImages)
      .set({ position: index + 1, updatedAt: new Date() })
      .where(and(eq(productImages.id, id), eq(productImages.productId, productId)));
  }
}

/** The audit rows a product's form wrote, for tests. */
export async function productAudits(productId: number) {
  return db.select().from(auditLogs).where(and(eq(auditLogs.auditableType, PRODUCT_MODEL), eq(auditLogs.auditableId, productId))).orderBy(asc(auditLogs.id));
}
