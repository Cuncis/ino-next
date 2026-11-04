import { existsSync } from "node:fs";
import path from "node:path";
import { and, asc, count, eq, isNull, max, or } from "drizzle-orm";
import { branches, categories, db, productImages, products } from "@/db";
import { uniqueSlug } from "@/lib/slug";
import { validate } from "@/lib/validation";
import type { AdminLocale } from "@/lib/admin-i18n";
import { replaceStock, type CountedBatch } from "@/server/inventory/stock-replacer";
import { assertColumns, readCsvTable, type CsvRow, type ImportFailure } from "./csv";
import { storeProductImage } from "./product-image-uploader";

/**
 * The house CSV, `produk-stok.csv`: product and stock in one file, one row per product,
 * branch and batch. Ported from App\Support\CsvTemplates (CatalogTemplate,
 * ProductTemplateImporter, StockTemplateImporter, CatalogTemplateImporter) with the
 * helpers they lean on (CategoryResolver, ProductImageFetcher).
 */
export const PRODUCT_COLUMNS = [
  "sku", "name", "category", "unit", "price", "old_price", "drug_class", "requires_prescription", "nie_bpom", "composition", "manufacturer", "blurb",
  "description", "indication", "dosage", "side_effects", "warning", "storage", "weight_grams", "max_qty_per_order", "status", "image_url",
] as const;

const DRUG_CLASSES = ["bebas", "bebas terbatas", "keras", "non-obat"];
const STORAGES = ["suhu ruang", "sejuk", "dingin"];
const STATUSES = ["aktif", "nonaktif", "arsip"];
const TRUE_VALUES = ["1", "ya", "yes", "true"];
const FALSE_VALUES = ["0", "tidak", "no", "false"];
const TEXT_COLUMNS = ["nie_bpom", "composition", "manufacturer", "blurb", "description", "indication", "dosage", "side_effects", "warning"] as const;

export const STOCK_COLUMNS = ["branch", "batch_number", "expires_at", "quantity", "is_listed"] as const;

export const CATALOG_COLUMNS = [...PRODUCT_COLUMNS, ...STOCK_COLUMNS];

const PRODUCT_SAMPLES: Record<string, string>[] = [
  {
    sku: "PRD-001", name: "Paracetamol 500 mg Strip 10", category: "Obat Bebas", unit: "Strip", price: "5000",
    old_price: "", drug_class: "bebas", requires_prescription: "0",
    nie_bpom: "DBL1234567890A1", composition: "Paracetamol 500 mg", manufacturer: "PT Contoh Farma",
    blurb: "Pereda demam dan nyeri.", description: "Obat penurun demam dan pereda nyeri ringan.",
    indication: "Demam, sakit kepala, nyeri ringan", dosage: "3 kali sehari 1 tablet",
    side_effects: "", warning: "", storage: "suhu ruang", weight_grams: "20",
    max_qty_per_order: "2", status: "aktif", image_url: "https://contoh.com/foto/paracetamol.jpg",
  },
  {
    sku: "PRD-002", name: "Vitamin C 1000 mg Botol 30", category: "Suplemen", unit: "Botol", price: "85000",
    old_price: "95000", drug_class: "non-obat", requires_prescription: "0",
    nie_bpom: "", composition: "Vitamin C 1000 mg", manufacturer: "",
    blurb: "", description: "", indication: "", dosage: "",
    side_effects: "", warning: "", storage: "suhu ruang", weight_grams: "150",
    max_qty_per_order: "2", status: "aktif", image_url: "https://contoh.com/foto/vit-c-1.jpg|https://contoh.com/foto/vit-c-2.jpg",
  },
];

/** CatalogTemplate::sampleRows(). */
export function catalogSampleRows(): Record<string, string>[] {
  const [product, second] = PRODUCT_SAMPLES;
  const emptyProduct = Object.fromEntries(PRODUCT_COLUMNS.map((column) => [column, ""]));

  return [
    { ...product, branch: "CB-001", batch_number: "BN2401A", expires_at: "2027-06-30", quantity: "120", is_listed: "1" },
    { ...emptyProduct, sku: "PRD-001", branch: "CB-001", batch_number: "", expires_at: "2027-12-31", quantity: "80", is_listed: "" },
    { ...emptyProduct, sku: "PRD-001", branch: "CB-002", batch_number: "BN2401A", expires_at: "2027-06-30", quantity: "60", is_listed: "" },
    { ...second, branch: "", batch_number: "", expires_at: "", quantity: "", is_listed: "" },
  ];
}

export type ImportSummary = {
  kind: "produk-stok" | "produk";
  created: number;
  updated: number;
  warnedInactive: number;
  imagesFailed: string[];
  groups: number;
  batches: number;
  zeroed: number;
  failed: ImportFailure[];
};

class RowError extends Error {}

/* ---------------- CategoryResolver ---------------- */

/** Finds a category by name, creating (or restoring) one an import mentions for the first time. */
export class CategoryResolver {
  private cache = new Map<string, number>();

  async id(name: string): Promise<number> {
    const cached = this.cache.get(name);

    if (cached !== undefined) {
      return cached;
    }

    let [category] = await db.select().from(categories).where(eq(categories.name, name)).orderBy(asc(categories.id)).limit(1);

    if (category?.deletedAt) {
      [category] = await db.update(categories).set({ deletedAt: null, updatedAt: new Date() }).where(eq(categories.id, category.id)).returning();
    }

    if (!category) {
      const [[{ highest }], [{ existing }]] = await Promise.all([
        db.select({ highest: max(categories.position) }).from(categories).where(isNull(categories.deletedAt)),
        db.select({ existing: count() }).from(categories).where(isNull(categories.deletedAt)),
      ]);
      const now = new Date();

      [category] = await db
        .insert(categories)
        .values({
          name,
          slug: await uniqueSlug({ table: categories, column: categories.slug, value: name }),
          status: "aktif",
          position: Number(highest ?? 0) + 1,
          imagePath: `/media/images/small/img-${(existing % 12) + 1}.jpg`,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    }

    // the storefront's own artwork for a category, when there is one
    const curated = `/media/images/categories/${category.slug}.png`;

    if (existsSync(path.join(process.cwd(), "public", curated)) && category.imagePath !== curated && (!category.imagePath || category.imagePath.startsWith("/media/images/small/"))) {
      await db.update(categories).set({ imagePath: curated, updatedAt: new Date() }).where(eq(categories.id, category.id));
    }

    this.cache.set(name, category.id);

    return category.id;
  }
}

/* ---------------- ProductImageFetcher ---------------- */

/** Downloads product photos at the end of an import, ten at a time (one by one took too long). */
export class ProductImageFetcher {
  private pending: { productId: number; sku: string; url: string }[] = [];

  queue(product: { id: number; sku: string }, urls: string[]): void {
    for (const url of urls) {
      this.pending.push({ productId: product.id, sku: product.sku, url });
    }
  }

  async fetch(summary: { imagesFailed: string[] }): Promise<void> {
    for (let start = 0; start < this.pending.length; start += 10) {
      const chunk = this.pending.slice(start, start + 10);
      const responses = await Promise.all(
        chunk.map(async (item) => {
          try {
            const response = await fetch(item.url, { headers: { "User-Agent": "Inofarma-ProductImport/1.0 (internal catalogue import)" }, signal: AbortSignal.timeout(20_000) });

            return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
          } catch {
            return null;
          }
        }),
      );

      for (const [index, item] of chunk.entries()) {
        try {
          const body = responses[index];

          if (!body) {
            throw new Error(`Gagal mengunduh gambar: ${item.url}`);
          }

          const { path: stored } = await storeProductImage(body, item.productId);
          const [{ total }] = await db.select({ total: count() }).from(productImages).where(eq(productImages.productId, item.productId));
          const position = total + 1;
          const now = new Date();

          await db.insert(productImages).values({ productId: item.productId, path: stored, position, isPrimary: position === 1, createdAt: now, updatedAt: now });
        } catch {
          summary.imagesFailed.push(item.sku);
        }
      }
    }

    summary.imagesFailed = [...new Set(summary.imagesFailed)];
    this.pending = [];
  }
}

/* ---------------- ProductTemplateImporter ---------------- */

type Product = typeof products.$inferSelect;

export class ProductTemplateImporter {
  readonly categories = new CategoryResolver();
  readonly images = new ProductImageFetcher();

  constructor(private readonly locale: AdminLocale = "id") {}

  /**
   * Saves one product row. With `partial` (the combined file) a product that exists
   * needs only `sku` plus the columns to change; a new one needs every required column.
   * `header` lists the columns `cells` really carries; the others are left alone.
   */
  async importRow(input: Record<string, string>, header: string[], summary: Pick<ImportSummary, "created" | "updated" | "warnedInactive">, partial = false): Promise<void> {
    const cells = { ...input };

    for (const column of ["drug_class", "storage", "status", "requires_prescription"]) {
      if (cells[column] !== undefined) {
        cells[column] = cells[column].toLowerCase();
      }
    }

    const [existing] = await db.select().from(products).where(eq(products.sku, cells.sku ?? "")).limit(1);

    this.validate(cells, !partial || !existing);

    const has = (column: string) => header.includes(column);
    const attributes: Partial<Product> = {};

    if (has("name")) attributes.name = cells.name;
    if (has("unit")) attributes.unit = cells.unit;
    if (has("drug_class")) attributes.drugClass = cells.drug_class;
    if (has("category")) attributes.categoryId = await this.categories.id(cells.category);
    if (has("price")) attributes.price = phpInt(cells.price);
    if (has("weight_grams")) attributes.weightGrams = phpInt(cells.weight_grams);

    for (const column of TEXT_COLUMNS) {
      if (has(column)) {
        (attributes as Record<string, unknown>)[camel(column)] = cells[column] !== "" ? cells[column] : null;
      }
    }

    if (has("old_price")) attributes.oldPrice = cells.old_price !== "" ? phpInt(cells.old_price) : null;

    if (has("max_qty_per_order")) {
      const limit = phpInt(cells.max_qty_per_order);

      attributes.maxQtyPerOrder = limit > 0 ? limit : null;
    }

    if (has("storage") && cells.storage !== "") attributes.storage = cells.storage;
    if (has("status") && cells.status !== "") attributes.status = cells.status;
    if (has("requires_prescription") && cells.requires_prescription !== "") attributes.requiresPrescription = TRUE_VALUES.includes(cells.requires_prescription);

    // the model as it will be saved: the stored row (restored), or a new one with Product's defaults
    const merged = { ...(existing ?? { status: "aktif", warning: null, drugClass: "non-obat", maxQtyPerOrder: 2 }), ...attributes } as Product;
    const touchesWarningRules = !partial || !existing || has("drug_class") || has("warning") || has("status");

    // a "bebas terbatas" product must carry its warning by law: without one it waits, inactive
    if (touchesWarningRules && merged.drugClass === "bebas terbatas" && (merged.warning ?? "").trim() === "") {
      attributes.status = "nonaktif";
      summary.warnedInactive++;
    }

    const now = new Date();
    let product: Product;

    if (existing) {
      const restored = existing.deletedAt !== null;
      const dirty = Object.entries(attributes).some(([key, value]) => existing[key as keyof Product] !== value);

      [product] =
        dirty || restored
          ? await db
              .update(products)
              .set({ ...attributes, ...(restored ? { deletedAt: null } : {}), updatedAt: now })
              .where(eq(products.id, existing.id))
              .returning()
          : [existing];
      summary.updated++;
    } else {
      [product] = await db
        .insert(products)
        .values({
          maxQtyPerOrder: 2,
          ...attributes,
          sku: cells.sku,
          name: cells.name,
          categoryId: attributes.categoryId!,
          price: attributes.price!,
          slug: await uniqueSlug({ table: products, column: products.slug, value: cells.name }),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      summary.created++;
    }

    const urls = has("image_url") ? imageUrls(cells.image_url) : [];

    if (urls.length) {
      const [{ total }] = await db.select({ total: count() }).from(productImages).where(eq(productImages.productId, product.id));

      if (total === 0) {
        this.images.queue(product, urls);
      }
    }
  }

  private validate(cells: Record<string, string>, enforceRequired: boolean): void {
    const digits = "regex:/^\\d+$/";
    const rules: Record<string, string[]> = {
      sku: ["required", "string", "max:40"],
      name: ["required", "string", "max:255"],
      category: ["required", "string", "max:255"],
      unit: ["required", "string", "max:30"],
      price: ["required", digits],
      old_price: ["nullable", digits],
      drug_class: ["required", `in:${DRUG_CLASSES.join(",")}`],
      requires_prescription: ["nullable", `in:${[...TRUE_VALUES, ...FALSE_VALUES].join(",")}`],
      nie_bpom: ["nullable", "max:40"],
      composition: ["nullable", "max:255"],
      manufacturer: ["nullable", "max:255"],
      blurb: ["nullable", "max:500"],
      storage: ["nullable", `in:${STORAGES.join(",")}`],
      weight_grams: ["required", digits],
      max_qty_per_order: ["nullable", digits, "max:65535"],
      status: ["nullable", `in:${STATUSES.join(",")}`],
    };

    if (!enforceRequired) {
      for (const [column, columnRules] of Object.entries(rules)) {
        if (column !== "sku") {
          rules[column] = columnRules.filter((rule) => rule !== "required");
        }
      }
    }

    const { errors } = validate(
      cells,
      rules,
      {
        regex: 'Kolom :attribute harus berupa bilangan bulat tanpa titik, koma, atau "Rp" (contoh: 15000).',
        in: "Kolom :attribute berisi nilai yang tidak dikenal.",
        required: "Kolom :attribute wajib diisi.",
        max: "Kolom :attribute terlalu panjang atau terlalu besar.",
      },
      {},
      this.locale,
    );

    if (errors) {
      throw new RowError(Object.values(errors)[0][0]);
    }
  }
}

/** PHP's (int) cast of a cell of digits. */
function phpInt(value: string): number {
  const match = /^\s*([+-]?\d+)/.exec(value);

  return match ? Number.parseInt(match[1], 10) : 0;
}

function camel(column: string): string {
  return column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function imageUrls(raw: string): string[] {
  const urls = raw
    .split("|")
    .map((url) => url.trim())
    .filter((url) => url !== "");

  for (const url of urls) {
    if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) {
      throw new RowError(`Alamat gambar tidak valid: ${url}`);
    }
  }

  return urls;
}

/* ---------------- StockTemplateImporter ---------------- */

type Branch = typeof branches.$inferSelect;

type StockGroup = {
  firstLine: number;
  branch: Branch;
  product: Product;
  entries: CountedBatch[];
  settings: { is_listed?: boolean };
  seen: Set<string>;
  broken: boolean;
};

export class StockTemplateImporter {
  private branches = new Map<string, Branch | null>();
  private products = new Map<string, Product | null>();

  constructor(
    private readonly restrictToBranchId: number | null,
    private readonly userId: number | null,
    private readonly locale: AdminLocale = "id",
  ) {}

  /**
   * Adds one stock row to its product + branch group. A row that fails once its group
   * is known marks the whole group broken, so a typo never zeroes a batch.
   */
  async collect(cells: Record<string, string>, header: string[], groups: Map<string, StockGroup>, line: number): Promise<void> {
    for (const column of ["sku", "branch_code"]) {
      if ((cells[column] ?? "") === "") {
        throw new RowError(`Kolom ${column} wajib diisi.`);
      }
    }

    const branch = await this.branch(cells.branch_code);
    const product = await this.product(cells.sku);
    const key = `${branch.id}-${product.id}`;

    if (!groups.has(key)) {
      groups.set(key, { firstLine: line, branch, product, entries: [], settings: {}, seen: new Set(), broken: false });
    }

    const group = groups.get(key)!;

    try {
      this.collectRow(cells, header, group);
    } catch (error) {
      group.broken = true;
      throw error;
    }
  }

  /** Replaces each group's stock, all or nothing per group. */
  async applyGroups(groups: Map<string, StockGroup>, summary: ImportSummary, note: string): Promise<void> {
    for (const group of groups.values()) {
      if (group.broken) {
        summary.failed.push({ row: group.firstLine, message: "Stok produk ini di cabang tersebut tidak diubah karena ada baris yang salah." });
        continue;
      }

      try {
        const result = await replaceStock({ branchId: group.branch.id, productId: group.product.id, batches: group.entries, settings: group.settings, userId: this.userId, note });

        summary.groups++;
        summary.batches += result.batches;
        summary.zeroed += result.zeroed;
      } catch (error) {
        summary.failed.push({ row: group.firstLine, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  private collectRow(cells: Record<string, string>, header: string[], group: StockGroup): void {
    const { errors } = validate(
      cells,
      { batch_number: ["nullable", "max:60"], expires_at: ["required"], quantity: ["required", "regex:/^\\d+$/"] },
      { required: "Kolom :attribute wajib diisi.", regex: "Kolom :attribute harus berupa bilangan bulat tanpa titik atau koma.", max: "Kolom :attribute terlalu panjang." },
      {},
      this.locale,
    );

    if (errors) {
      throw new RowError(Object.values(errors)[0][0]);
    }

    const expiresAt = parseDate(cells.expires_at);
    const given = (cells.batch_number ?? "") !== "";
    const batchNumber = given ? cells.batch_number : `EXP-${expiresAt.replaceAll("-", "")}`;
    const batchKey = batchNumber.toLowerCase();

    if (group.seen.has(batchKey)) {
      throw new RowError(
        given
          ? `Batch ${batchNumber} muncul lebih dari sekali untuk produk dan cabang yang sama.`
          : `Tanggal kedaluwarsa ${expiresAt} tanpa batch_number muncul lebih dari sekali untuk produk dan cabang yang sama. Gabungkan jumlahnya dalam satu baris.`,
      );
    }

    // the branch's settings can sit on any row of the group: the first value given wins
    if (header.includes("is_listed") && (cells.is_listed ?? "") !== "" && group.settings.is_listed === undefined) {
      const value = cells.is_listed.toLowerCase();

      if (![...TRUE_VALUES, ...FALSE_VALUES].includes(value)) {
        throw new RowError("Kolom is_listed harus 1 atau 0.");
      }

      group.settings.is_listed = TRUE_VALUES.includes(value);
    }

    group.seen.add(batchKey);
    group.entries.push({ batch_number: batchNumber, expires_at: expiresAt, quantity: phpInt(cells.quantity) });
  }

  private async branch(codeOrName: string): Promise<Branch> {
    const key = codeOrName.toLowerCase();

    if (!this.branches.get(key)) {
      const [found] = await db
        .select()
        .from(branches)
        .where(and(isNull(branches.deletedAt), or(eq(branches.code, codeOrName), eq(branches.name, codeOrName))))
        .orderBy(asc(branches.id))
        .limit(1);

      this.branches.set(key, found ?? null);
    }

    const branch = this.branches.get(key);

    if (!branch) {
      throw new RowError(`Cabang "${codeOrName}" tidak ditemukan (isi dengan kode atau nama cabang).`);
    }

    if (this.restrictToBranchId !== null && branch.id !== this.restrictToBranchId) {
      throw new RowError(`Anda tidak punya akses ke cabang "${codeOrName}".`);
    }

    return branch;
  }

  private async product(sku: string): Promise<Product> {
    const key = sku.toLowerCase();

    if (!this.products.get(key)) {
      const [found] = await db
        .select()
        .from(products)
        .where(and(eq(products.sku, sku), isNull(products.deletedAt)))
        .limit(1);

      this.products.set(key, found ?? null);
    }

    const product = this.products.get(key);

    if (!product) {
      throw new RowError(`Produk dengan SKU "${sku}" tidak ditemukan. Import produk lebih dulu.`);
    }

    return product;
  }
}

/** `Y-m-d` or `d/m/Y`, as a date that really exists (Carbon's strict createFromFormat). */
function parseDate(value: string): string {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null;

  if (parts) {
    const [year, month, day] = parts.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // Carbon rolls an impossible day over (31/02 becomes 3 March), like Date.UTC
    return date.toISOString().slice(0, 10);
  }

  throw new RowError("Kolom expires_at harus berformat YYYY-MM-DD (contoh: 2027-06-30).");
}

/* ---------------- CatalogTemplateImporter ---------------- */

/**
 * Imports `produk-stok.csv`. `sku` keys the product; its columns may sit on any row of
 * that SKU and an empty cell means "leave as is". For each product and branch the stock
 * rows are the whole list of batches. Throws CsvError for a file it can't read at all.
 */
export async function importCatalog(options: {
  content: string;
  fileName: string;
  restrictToBranchId: number | null;
  userId: number | null;
  canEditProducts: boolean;
  canAdjustStock: boolean;
  locale: AdminLocale;
}): Promise<ImportSummary> {
  const { header, rows } = readCsvTable(options.content);

  assertColumns(header, ["sku"]);

  const summary: ImportSummary = { kind: "produk-stok", created: 0, updated: 0, warnedInactive: 0, imagesFailed: [], groups: 0, batches: 0, zeroed: 0, failed: [] };
  const productImporter = new ProductTemplateImporter(options.locale);
  const stock = new StockTemplateImporter(options.restrictToBranchId, options.userId, options.locale);
  const groups = new Map<string, StockGroup>();

  for (const skuRows of rowsBySku(rows, summary).values()) {
    const productOk = await importProduct(skuRows, header, productImporter, summary, options.canEditProducts);

    for (const { line, cells } of skuRows) {
      if (!STOCK_COLUMNS.some((column) => (cells[column] ?? "") !== "")) {
        continue;
      }

      if (!productOk) {
        summary.failed.push({ row: line, message: "Stok tidak diproses karena data produknya bermasalah." });
        continue;
      }

      try {
        if (!options.canAdjustStock) {
          throw new RowError("Anda tidak punya izin menyesuaikan stok.");
        }

        await stock.collect(stockCells(cells), header, groups, line);
      } catch (error) {
        // PHP caught RuntimeException, which a database error is too
        summary.failed.push({ row: line, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  await productImporter.images.fetch(summary);
  await stock.applyGroups(groups, summary, `Impor produk dan stok CSV (${options.fileName})`);

  return summary;
}

function rowsBySku(rows: CsvRow[], summary: ImportSummary): Map<string, CsvRow[]> {
  const bySku = new Map<string, CsvRow[]>();

  for (const row of rows) {
    const sku = row.cells.sku;

    if (sku === "") {
      summary.failed.push({ row: row.line, message: "Kolom sku wajib diisi." });
      continue;
    }

    bySku.set(sku.toLowerCase(), [...(bySku.get(sku.toLowerCase()) ?? []), row]);
  }

  return bySku;
}

/** Creates or updates the product from the merged cells of its rows; false when its stock mustn't be applied. */
async function importProduct(skuRows: CsvRow[], header: string[], importer: ProductTemplateImporter, summary: ImportSummary, canEditProducts: boolean): Promise<boolean> {
  const firstLine = skuRows[0].line;
  const sku = skuRows[0].cells.sku;
  let merged: Record<string, string>;

  try {
    merged = mergeProductCells(skuRows, header);
  } catch (error) {
    summary.failed.push({ row: firstLine, message: (error as Error).message });

    return false;
  }

  const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.sku, sku)).limit(1);

  if (existing && Object.keys(merged).length === 1) {
    return true;
  }

  try {
    if (!canEditProducts) {
      throw new RowError("Anda tidak punya izin mengubah data produk.");
    }

    await importer.importRow(merged, Object.keys(merged), summary, true);
  } catch (error) {
    summary.failed.push({ row: firstLine, message: error instanceof Error ? error.message : String(error) });

    return false;
  }

  return true;
}

function mergeProductCells(skuRows: CsvRow[], header: string[]): Record<string, string> {
  const merged: Record<string, string> = { sku: skuRows[0].cells.sku };

  for (const column of PRODUCT_COLUMNS) {
    if (column === "sku" || !header.includes(column)) {
      continue;
    }

    const values = new Map<string, number[]>();

    for (const { line, cells } of skuRows) {
      if (cells[column] !== "") {
        values.set(cells[column], [...(values.get(cells[column]) ?? []), line]);
      }
    }

    if (values.size > 1) {
      const lines = [...values.values()].flat().join(", ");

      throw new RowError(`Kolom ${column} berbeda antar baris untuk SKU ${merged.sku} (baris ${lines}). Samakan atau kosongkan di baris lain.`);
    }

    if (values.size === 1) {
      merged[column] = [...values.keys()][0];
    }
  }

  return merged;
}

function stockCells(cells: Record<string, string>): Record<string, string> {
  return {
    sku: cells.sku,
    branch_code: cells.branch ?? "",
    batch_number: cells.batch_number ?? "",
    expires_at: cells.expires_at ?? "",
    quantity: cells.quantity ?? "",
    is_listed: cells.is_listed ?? "",
  };
}
