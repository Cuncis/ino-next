import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { branches, branchStocks, categories, db, inventoryBatches, productImages, products } from "@/db";
import { branchScope, type ScopedStaff } from "@/lib/branch-scope";
import { CSV_BOM, csvLine } from "./csv";
import { CATALOG_COLUMNS, catalogSampleRows, STOCK_FILE_COLUMNS, STOCK_SAMPLE_ROWS } from "./catalog-import";

/**
 * The `produk-stok.csv` download (App\Support\CsvTemplates\TemplateExporter::catalog):
 * one row per batch in stock with the product's columns repeated, or a single row for a
 * product with none. Only the staff member's branch for branch staff, and no stock cells
 * at all without permission to see stock. Columns are exactly what the import reads.
 */
export async function exportCatalog(options: { includeStock: boolean; staff: ScopedStaff; origin: string }): Promise<string> {
  const { includeStock, staff, origin } = options;
  const [rows, categoryRows, images] = await Promise.all([
    db.select().from(products).where(isNull(products.deletedAt)).orderBy(asc(products.sku)),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(isNull(categories.deletedAt)),
    db.select().from(productImages).orderBy(asc(productImages.position), asc(productImages.id)),
  ]);
  const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]));
  const imagesOf = new Map<number, string[]>();

  for (const image of images) {
    imagesOf.set(image.productId, [...(imagesOf.get(image.productId) ?? []), image.path.startsWith("/") ? `${origin}${image.path}` : image.path]);
  }

  const batches = includeStock && rows.length
    ? await db
        .select({ batch: inventoryBatches, branchCode: branches.code })
        .from(inventoryBatches)
        .innerJoin(branches, and(eq(branches.id, inventoryBatches.branchId), isNull(branches.deletedAt)))
        .where(and(gt(inventoryBatches.quantity, 0), branchScope(inventoryBatches.branchId, staff)))
        .orderBy(asc(inventoryBatches.branchId), asc(inventoryBatches.expiresAt), asc(inventoryBatches.id))
    : [];
  const settings = includeStock ? await db.select().from(branchStocks).where(branchScope(branchStocks.branchId, staff)) : [];
  const listed = new Map(settings.map((row) => [`${row.branchId}-${row.productId}`, row.isListed ? 1 : 0]));
  const batchesOf = new Map<number, typeof batches>();

  for (const row of batches) {
    batchesOf.set(row.batch.productId, [...(batchesOf.get(row.batch.productId) ?? []), row]);
  }

  let out = CSV_BOM + csvLine([...CATALOG_COLUMNS]);

  for (const product of rows) {
    const productCells: Record<string, string | number | null> = {
      sku: product.sku,
      name: product.name,
      category: categoryNames.get(product.categoryId) ?? null,
      unit: product.unit,
      price: product.price,
      old_price: product.oldPrice,
      drug_class: product.drugClass,
      requires_prescription: product.requiresPrescription ? 1 : 0,
      nie_bpom: product.nieBpom,
      composition: product.composition,
      manufacturer: product.manufacturer,
      blurb: product.blurb,
      description: product.description,
      indication: product.indication,
      dosage: product.dosage,
      side_effects: product.sideEffects,
      warning: product.warning,
      storage: product.storage,
      weight_grams: product.weightGrams,
      max_qty_per_order: product.maxQtyPerOrder,
      status: product.status,
      image_url: (imagesOf.get(product.id) ?? []).join("|"),
    };
    const productBatches = batchesOf.get(product.id) ?? [];

    if (!productBatches.length) {
      out += csvLine(CATALOG_COLUMNS.map((column) => productCells[column] ?? ""));
      continue;
    }

    for (const { batch, branchCode } of productBatches) {
      const cells: Record<string, string | number | null> = {
        ...productCells,
        branch: branchCode,
        batch_number: batch.batchNumber,
        expires_at: batch.expiresAt,
        quantity: batch.quantity,
        is_listed: listed.get(`${batch.branchId}-${batch.productId}`) ?? null,
      };

      out += csvLine(CATALOG_COLUMNS.map((column) => cells[column] ?? ""));
    }
  }

  return out;
}

/** TemplateExporter::catalogSample(): the columns and four example rows. */
export function catalogSample(): string {
  return CSV_BOM + csvLine([...CATALOG_COLUMNS]) + catalogSampleRows().map((row) => csvLine(CATALOG_COLUMNS.map((column) => row[column] ?? ""))).join("");
}

/** A CSV download, named like Laravel's streamDownload(). */
export function csvDownload(content: string, fileName: string): Response {
  return new Response(content, {
    headers: { "Content-Type": "text/csv; charset=UTF-8", "Content-Disposition": `attachment; filename=${fileName}` },
  });
}

/** `now()->format('Ymd-His')` in Jakarta. */
export function exportStamp(now = new Date()): string {
  const jakarta = new Date(now.getTime() + 7 * 3600_000).toISOString();

  return `${jakarta.slice(0, 10).replaceAll("-", "")}-${jakarta.slice(11, 19).replaceAll(":", "")}`;
}

/**
 * TemplateExporter::stock(): every batch in stock, by branch, product and expiry; only
 * the staff member's branch for branch staff. A deleted product or branch is left out.
 */
export async function exportStock(staff: ScopedStaff): Promise<string> {
  const rows = await db
    .select({ batch: inventoryBatches, sku: products.sku, branchCode: branches.code })
    .from(inventoryBatches)
    .innerJoin(branches, and(eq(branches.id, inventoryBatches.branchId), isNull(branches.deletedAt)))
    .innerJoin(products, and(eq(products.id, inventoryBatches.productId), isNull(products.deletedAt)))
    .where(and(gt(inventoryBatches.quantity, 0), branchScope(inventoryBatches.branchId, staff)))
    .orderBy(asc(inventoryBatches.branchId), asc(inventoryBatches.productId), asc(inventoryBatches.expiresAt), asc(inventoryBatches.id));
  const settings = await db.select().from(branchStocks).where(branchScope(branchStocks.branchId, staff));
  const listed = new Map(settings.map((row) => [`${row.branchId}-${row.productId}`, row.isListed ? 1 : 0]));
  let out = CSV_BOM + csvLine([...STOCK_FILE_COLUMNS]);

  for (const { batch, sku, branchCode } of rows) {
    out += csvLine([sku, branchCode, batch.batchNumber, batch.expiresAt, batch.quantity, listed.get(`${batch.branchId}-${batch.productId}`) ?? null]);
  }

  return out;
}

/** TemplateExporter::stockSample(). */
export function stockSample(): string {
  return CSV_BOM + csvLine([...STOCK_FILE_COLUMNS]) + STOCK_SAMPLE_ROWS.map((row) => csvLine(STOCK_FILE_COLUMNS.map((column) => row[column] ?? ""))).join("");
}
