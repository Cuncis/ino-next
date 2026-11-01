import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { branchStocks, categories, db, inventoryBatches, productImages, products } from "@/db";
import { CATEGORY_STATUSES, DRUG_CLASSES, STORAGE_CONDITIONS, stockLabel, toLabel } from "@/lib/admin-options";
import { displayUrl } from "@/lib/storage";
import { SHORT_MONTHS } from "@/lib/dates";

/**
 * The catalogue as the storefront needs it, shared with every storefront page because
 * the search overlay lives in the layout and can be opened anywhere. Ported from
 * App\Support\Presenters\ShopCatalogPresenter.
 *
 * Only active products appear. A product's `status` here is availability (Tersedia /
 * Stok Menipis / Habis), not the catalogue status an administrator sets.
 */

/** The most of one product a shopper may buy in a single order, for a product without a limit of its own. */
export const MAX_QUANTITY_PER_ORDER = 2;

/** Product::purchaseLimit(): the product's own `max_qty_per_order`, or the default. */
export function purchaseLimit(maxQtyPerOrder: number | null): number {
  return maxQtyPerOrder || MAX_QUANTITY_PER_ORDER;
}

/** The fallback photo, so a product card is never empty (Product::getImagePathAttribute). */
export const PRODUCT_PLACEHOLDER_IMAGE = "/media/images/product/p-1.png";

const CATEGORY_PLACEHOLDER_IMAGE = "/media/images/small/img-1.jpg";

/** `2026-08-05` → `05 Agt 2026`, Carbon's translatedFormat('d M Y') in Indonesian. */
export function shortIndonesianDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");

  return `${day} ${SHORT_MONTHS[Number(month) - 1]} ${year}`;
}

/** PHP's number_format($value, 1) for a 2-decimal value given as text: half away from zero, no float error. */
export function oneDecimal(decimalText: string): string {
  const negative = decimalText.trim().startsWith("-");
  const hundredths = Math.round(Math.abs(Number(decimalText)) * 100);
  const tenths = Math.floor((hundredths + 5) / 10);

  return `${negative && tenths !== 0 ? "-" : ""}${Math.floor(tenths / 10)}.${tenths % 10}`;
}

export async function catalogForStorefront() {
  const stockSum = sql<string | null>`(select sum(${branchStocks.quantity}) from ${branchStocks} where ${branchStocks.productId} = ${products.id})`;
  // The soonest expiry among batches still on a shelf, across every branch
  const earliestExpiry = sql<string | null>`(select min(${inventoryBatches.expiresAt})::text from ${inventoryBatches}
    where ${inventoryBatches.productId} = ${products.id} and ${inventoryBatches.quantity} > 0 and ${inventoryBatches.expiresAt} >= current_date)`;

  const rows = await db
    .select({
      product: products,
      rating: sql<string>`${products.rating}::text`,
      categoryName: categories.name,
      stock: stockSum,
      earliestExpiry,
    })
    .from(products)
    // a soft-deleted category reads as no category, like Eloquent's belongsTo
    .leftJoin(categories, and(eq(categories.id, products.categoryId), isNull(categories.deletedAt)))
    .where(and(eq(products.status, "aktif"), isNull(products.deletedAt)))
    .orderBy(asc(products.id));

  const images = rows.length
    ? await db
        .select({ productId: productImages.productId, path: productImages.path, alt: productImages.alt })
        .from(productImages)
        .where(inArray(productImages.productId, rows.map((row) => row.product.id)))
        .orderBy(asc(productImages.position), asc(productImages.id))
    : [];

  const categoryRows = await db
    .select({
      name: categories.name,
      slug: categories.slug,
      imagePath: categories.imagePath,
      status: categories.status,
      products: sql<string>`(select count(*) from ${products} where ${products.categoryId} = ${categories.id} and ${products.deletedAt} is null)`,
    })
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.position), asc(categories.id));

  return {
    products: rows.map((row) => {
      const { product } = row;
      const own = images.filter((image) => image.productId === product.id);
      const imagePath = own[0]?.path ?? PRODUCT_PLACEHOLDER_IMAGE;
      const stock = Number(row.stock ?? 0);

      return {
        id: product.sku,
        slug: product.slug,
        name: product.name,
        category: row.categoryName,
        image: displayUrl(imagePath),
        // the gallery; a product with no images still gets its one placeholder photo
        images: own.length
          ? own.map((image) => ({ path: displayUrl(image.path), alt: image.alt ?? product.name }))
          : [{ path: displayUrl(imagePath), alt: product.name }],
        price: product.price,
        oldPrice: product.oldPrice,
        stock,
        sold: product.soldCount,
        rating: oneDecimal(row.rating),
        status: stockLabel(stock),
        unit: product.unit,
        // pack sizes are not modelled yet: the single unit the product is sold in
        variants: [product.unit],
        prescription: product.requiresPrescription,
        blurb: product.blurb,
        drugClass: toLabel(DRUG_CLASSES, product.drugClass),
        needsWarningLabel: product.drugClass === "bebas terbatas",
        nie: product.nieBpom,
        composition: product.composition,
        indication: product.indication,
        dosage: product.dosage,
        sideEffects: product.sideEffects,
        warning: product.warning,
        manufacturer: product.manufacturer,
        maxQtyPerOrder: product.maxQtyPerOrder,
        purchaseLimit: purchaseLimit(product.maxQtyPerOrder),
        storage: toLabel(STORAGE_CONDITIONS, product.storage),
        expiresAt: row.earliestExpiry ? shortIndonesianDate(row.earliestExpiry) : null,
      };
    }),
    categories: categoryRows.map((category) => ({
      name: category.name,
      slug: category.slug,
      image: displayUrl(category.imagePath ?? CATEGORY_PLACEHOLDER_IMAGE),
      status: toLabel(CATEGORY_STATUSES, category.status),
      products: Number(category.products),
    })),
  };
}
