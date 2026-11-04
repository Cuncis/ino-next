import { and, asc, count, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { branches, branchStocks, categories, db, products } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { ADJUSTMENT_REASONS } from "@/lib/admin-options";
import { branchScope, type ScopedStaff } from "@/lib/branch-scope";
import { addError, validate, type ValidationErrors } from "@/lib/validation";
import { adjustStock } from "@/server/inventory/stock-adjuster";
import { InsufficientStockError, receiveStock } from "@/server/inventory/stock-allocator";
import { orderBy, searchWords } from "./list-query";
import type { Staff } from "./staff-auth";

/**
 * Inventaris > Stok (BranchStockResource): each branch's stock of each product, with
 * "Sesuaikan" (a counted difference) and "Terima Barang" (a new batch). The same two
 * forms sit on the product's page, asking which branch. Branch staff see and book only
 * their own branch.
 */
const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export type StockListQuery = { search?: string; branchId?: string; page: number; perPage: number };

/** The list: least stock first, products that still exist only. */
export async function listBranchStocks(query: StockListQuery, staff: ScopedStaff) {
  const branchName = sql`(select ${branches.name} from ${branches} where ${branches.id} = ${branchStocks.branchId} and ${branches.deletedAt} is null)`;
  const where = and(
    isNull(products.deletedAt),
    branchScope(branchStocks.branchId, staff),
    query.branchId ? eq(branchStocks.branchId, Number(query.branchId)) : undefined,
    searchWords(query.search, [branchName, sql`${products.sku}`, sql`${products.name}`]),
  );
  const [{ total }] = await db.select({ total: count() }).from(branchStocks).innerJoin(products, eq(products.id, branchStocks.productId)).where(where);
  const rows = await db
    .select({ stock: branchStocks, branchName: sql<string | null>`${branchName}`, sku: products.sku, productName: products.name })
    .from(branchStocks)
    .innerJoin(products, eq(products.id, branchStocks.productId))
    .where(where)
    .orderBy(...orderBy(null, {}, { column: branchStocks.quantity, direction: "asc" }, branchStocks.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.stock, branchName: row.branchName, sku: row.sku, productName: row.productName, available: Math.max(row.stock.quantity - row.stock.reservedQuantity, 0) })) };
}

export async function findBranchStock(id: number, staff: ScopedStaff) {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db
    .select({ stock: branchStocks, productName: products.name })
    .from(branchStocks)
    .innerJoin(products, and(eq(products.id, branchStocks.productId), isNull(products.deletedAt)))
    .where(and(eq(branchStocks.id, id), branchScope(branchStocks.branchId, staff)))
    .limit(1);

  return row ? { ...row.stock, productName: row.productName } : null;
}

/** All branches for the "Cabang" filter, by name. */
export async function branchFilterOptions(): Promise<{ value: string; label: string }[]> {
  const rows = await db.select({ id: branches.id, name: branches.name }).from(branches).where(isNull(branches.deletedAt)).orderBy(asc(branches.name));

  return rows.map((row) => ({ value: String(row.id), label: row.name }));
}

/**
 * BranchStocksTable::branchOptions(): where the staff member may book stock (only their
 * own branch when they have one); `productId` keeps the branches that already hold it.
 */
export async function bookableBranches(staff: Staff, productId?: number): Promise<{ value: string; label: string }[]> {
  const rows = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(
      and(
        isNull(branches.deletedAt),
        staff.branchId !== null ? eq(branches.id, staff.branchId) : undefined,
        productId !== undefined ? sql`exists (select 1 from ${branchStocks} where ${branchStocks.branchId} = ${branches.id} and ${branchStocks.productId} = ${productId})` : undefined,
      ),
    )
    .orderBy(asc(branches.name));

  return rows.map((row) => ({ value: String(row.id), label: row.name }));
}

/** The product's count at each branch it is stocked in, for "Stok saat ini". */
export async function quantitiesByBranch(productId: number): Promise<Record<string, number>> {
  const rows = await db.select({ branchId: branchStocks.branchId, quantity: branchStocks.quantity }).from(branchStocks).where(eq(branchStocks.productId, productId));

  return Object.fromEntries(rows.map((row) => [String(row.branchId), row.quantity]));
}

/** "Tambah Stok Awal"'s product search: by name or SKU, archived ones left out, 50 at most. */
export async function searchStockableProducts(search: string): Promise<{ value: string; label: string }[]> {
  const like = `%${search}%`;
  const rows = await db
    .select({ id: products.id, sku: products.sku, name: products.name })
    .from(products)
    .where(and(isNull(products.deletedAt), ne(products.status, "arsip"), or(ilike(products.name, like), ilike(products.sku, like))))
    .orderBy(asc(products.name))
    .limit(50);

  return rows.map((row) => ({ value: String(row.id), label: `${row.sku} · ${row.name}` }));
}

/* ---------------- the two forms ---------------- */

type Picked = { branchId: number; productId: number };

/** BranchStocksTable::mustBeOwnBranch(). */
function ownBranch(errors: ValidationErrors | null, staff: Staff, value: unknown, locale: AdminLocale): ValidationErrors | null {
  return staff.branchId !== null && value !== undefined && value !== null && value !== "" && staff.branchId !== Number(value)
    ? addError(errors, "branchId", translate(locale, "Anda hanya bisa menambah stok di cabang Anda sendiri."))
    : errors;
}

/** A select only takes one of its options. */
function invalidChoice(errors: ValidationErrors | null, field: string, attribute: string, locale: AdminLocale): ValidationErrors {
  return addError(errors, field, locale === "en" ? `The selected ${attribute} is invalid.` : `Kolom ${attribute} yang dipilih tidak valid.`);
}

/**
 * "Terima Barang" (and "Tambah Stok Awal" with its branch and product): a batch with an
 * expiry after today; an empty batch number becomes one per expiry date.
 */
export async function receiveGoods(
  body: Record<string, unknown>,
  staff: Staff,
  locale: AdminLocale,
  fixed: Partial<Picked>,
): Promise<{ errors: ValidationErrors } | { errors: null; quantity: number; branchName: string; productName: string }> {
  const t = (text: string) => lcfirst(translate(locale, text));
  const rules: Record<string, string[]> = {
    ...(fixed.branchId === undefined ? { branchId: ["required"] } : {}),
    ...(fixed.productId === undefined ? { productId: ["required"] } : {}),
    batchNumber: ["nullable", "max:60"],
    expiresAt: ["required", "after:today"],
    quantity: ["required", "numeric", "integer", "min:1", "max:100000"],
    note: ["nullable", "max:255"],
  };
  const attributes = { branchId: t("Cabang"), productId: t("Produk"), batchNumber: t("Nomor Batch"), expiresAt: t("Tanggal Kedaluwarsa"), quantity: t("Jumlah"), note: t("Catatan") };
  let { errors } = validate<Record<string, unknown>>(body, rules, {}, attributes, locale);
  const branchId = fixed.branchId ?? Number(body.branchId);
  const productId = fixed.productId ?? Number(body.productId);

  if (fixed.branchId === undefined && !errors?.branchId) {
    // the select's options first, then mustBeOwnBranch(), as Filament orders the rules
    if (!(await bookableBranches(staff)).some((option) => option.value === String(body.branchId))) {
      errors = invalidChoice(errors, "branchId", attributes.branchId, locale);
    }

    errors = ownBranch(errors, staff, body.branchId, locale);
  }

  const [product] = Number.isSafeInteger(productId) ? await db.select({ name: products.name }).from(products).where(and(eq(products.id, productId), isNull(products.deletedAt))).limit(1) : [];

  if (fixed.productId === undefined && !errors?.productId && !product) {
    errors = invalidChoice(errors, "productId", attributes.productId, locale);
  }

  if (errors) {
    return { errors };
  }

  const expiresAt = String(body.expiresAt);
  const batchNumber = typeof body.batchNumber === "string" && body.batchNumber.trim() !== "" ? body.batchNumber.trim() : `EXP-${expiresAt.replaceAll("-", "")}`;
  const quantity = Number(body.quantity);

  await receiveStock({
    branchId,
    productId,
    manifest: [{ batch_number: batchNumber, expires_at: expiresAt, quantity }],
    type: "pembelian",
    userId: staff.id,
    note: typeof body.note === "string" && body.note.trim() !== "" ? body.note.trim() : null,
  });

  const [branch] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId)).limit(1);

  return { errors: null, quantity, branchName: branch?.name ?? "", productName: product?.name ?? "" };
}

/** "Sesuaikan": a difference that isn't zero, and a reason. A removal below zero is refused with its reason. */
export async function adjustGoods(
  body: Record<string, unknown>,
  staff: Staff,
  locale: AdminLocale,
  fixed: { productId: number; branchId?: number },
): Promise<{ errors: ValidationErrors } | { errors: null; refused: string | null; branchName: string; productName: string }> {
  const t = (text: string) => lcfirst(translate(locale, text));
  const attributes = { branchId: t("Cabang"), delta: t("Jumlah Penyesuaian"), reason: t("Alasan"), note: t("Catatan") };
  let { errors } = validate<Record<string, unknown>>(
    body,
    {
      ...(fixed.branchId === undefined ? { branchId: ["required"] } : {}),
      delta: ["required", "numeric", "integer", "min:-100000", "max:100000", "not_in:0"],
      reason: ["required", `in:${Object.values(ADJUSTMENT_REASONS).join(",")}`],
      note: ["nullable", "max:255"],
    },
    { "delta.not_in": translate(locale, "Jumlah penyesuaian tidak boleh nol.") },
    attributes,
    locale,
  );
  const branchId = fixed.branchId ?? Number(body.branchId);

  if (fixed.branchId === undefined && !errors?.branchId) {
    const allowed = await bookableBranches(staff, fixed.productId);

    if (!allowed.some((option) => option.value === String(body.branchId))) {
      errors = invalidChoice(errors, "branchId", attributes.branchId, locale);
    }

    errors = ownBranch(errors, staff, body.branchId, locale);
  }

  if (errors) {
    return { errors };
  }

  const [[branch], [product]] = await Promise.all([
    db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId)).limit(1),
    db.select({ name: products.name }).from(products).where(eq(products.id, fixed.productId)).limit(1),
  ]);

  try {
    await adjustStock({
      branchId,
      productId: fixed.productId,
      delta: Math.trunc(Number(body.delta)),
      type: String(body.reason),
      userId: staff.id,
      note: typeof body.note === "string" && body.note.trim() !== "" ? body.note.trim() : null,
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return { errors: null, refused: error.message, branchName: branch?.name ?? "", productName: product?.name ?? "" };
    }

    throw error;
  }

  return { errors: null, refused: null, branchName: branch?.name ?? "", productName: product?.name ?? "" };
}

/* ---------------- Matriks Stok ---------------- */

/** StockMatrixWidget: every product by name, a column per active branch with its count there. */
export async function stockMatrix(staff: ScopedStaff) {
  const branchRows = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(isNull(branches.deletedAt), eq(branches.status, "aktif")))
    .orderBy(asc(branches.name));
  const [productRows, stockRows] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, category: categories.name })
      .from(products)
      .leftJoin(categories, and(eq(categories.id, products.categoryId), isNull(categories.deletedAt)))
      .where(isNull(products.deletedAt))
      .orderBy(asc(products.name), asc(products.id)),
    db.select({ branchId: branchStocks.branchId, productId: branchStocks.productId, quantity: branchStocks.quantity }).from(branchStocks).where(branchScope(branchStocks.branchId, staff)),
  ]);
  const quantity = new Map(stockRows.map((row) => [`${row.productId}-${row.branchId}`, row.quantity]));

  return {
    branches: branchRows,
    rows: productRows.map((product) => ({ ...product, quantities: branchRows.map((branch) => quantity.get(`${product.id}-${branch.id}`) ?? 0) })),
  };
}
