import { count, eq } from "drizzle-orm";
import { db, productImages, products } from "@/db";
import { slugify } from "@/lib/slug";
import { parseRecords, type ImportFailure } from "./csv";
import { CategoryResolver, ProductImageFetcher, type ImportSummary } from "./catalog-import";

/**
 * The older import from a Shopify product export, ported from
 * App\Support\ProductCsvImporter. `Variant SKU` is the SKU and `Handle` the slug, so the
 * same file imported twice updates rather than duplicates. Only product data; no stock.
 *
 * `Golongan Obat: BLUE` is "bebas terbatas", which must show a warning by law; the export
 * has no warning text, so those rows come in inactive.
 */
const DRUG_CLASS_MAP: Record<string, string> = {
  GREEN: "bebas",
  BLUE: "bebas terbatas",
  KUASI: "bebas",
  "OBAT TRADISIONAL": "bebas",
  FITOFARMAKA: "bebas",
  OHT: "bebas",
  SUPLEMEN: "bebas",
  PKRT: "bebas",
  "ALAT KESEHATAN - NON ELEKTROMEDIK NON STERIL": "bebas",
};

/** Checked in order, so "Dus, 1 Botol Plastik" is a Botol (the unit sold), not a Box. */
const UNIT_KEYWORDS: [string, string][] = [
  ["Botol", "Botol"],
  ["Strip", "Strip"],
  ["Tablet", "Tablet"],
  ["Kaplet", "Tablet"],
  ["Kapsul", "Tablet"],
  ["Box", "Box"],
  ["Dus", "Box"],
];

export async function importShopify(content: string): Promise<ImportSummary> {
  // fgetcsv() with its default comma; an empty file has no header at all (PHP failed there too)
  const [header, ...records] = parseRecords(content, ",");

  if (!header) {
    throw new TypeError("array_flip(): Argument #1 ($array) must be of type array, bool given");
  }

  const index = new Map(header.map((name, position) => [name, position]));
  const cell = (row: string[], name: string) => {
    const position = index.get(name);

    return position === undefined ? "" : (row[position] ?? "");
  };
  const summary: ImportSummary = { kind: "produk", created: 0, updated: 0, warnedInactive: 0, imagesFailed: [], groups: 0, batches: 0, zeroed: 0, failed: [] };
  const categories = new CategoryResolver();
  const images = new ProductImageFetcher();
  let rowNumber = 1;

  for (const row of records) {
    rowNumber++;

    try {
      await importRow(row ?? [""], cell, summary, categories, images);
    } catch (error) {
      summary.failed.push({ row: rowNumber, message: error instanceof Error ? error.message : String(error) } satisfies ImportFailure);
    }
  }

  await images.fetch(summary);

  return summary;
}

async function importRow(row: string[], cell: (row: string[], name: string) => string, summary: ImportSummary, categories: CategoryResolver, images: ProductImageFetcher): Promise<void> {
  const sku = cell(row, "Variant SKU").trim();

  if (sku === "") {
    throw new Error("Variant SKU kosong.");
  }

  const body = parseBody(cell(row, "Body (HTML)"));
  const tags = parseTags(cell(row, "Tags"));
  const drugClass = DRUG_CLASS_MAP[body.golongan] ?? "bebas";
  const needsWarning = drugClass === "bebas terbatas";
  const [existing] = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
  const title = cell(row, "Title").trim();
  const now = new Date();
  const columns = {
    name: title,
    slug: cell(row, "Handle").trim() || slugify(title !== "" ? title : sku),
    categoryId: await categories.id(tags.category),
    unit: guessUnit(body.kemasan),
    status: needsWarning ? "nonaktif" : "aktif",
    price: Math.round(phpFloat(cell(row, "Variant Price") || "0")),
    oldPrice: nullableInt(cell(row, "Variant Compare At Price")),
    requiresPrescription: false,
    blurb: body.deskripsi !== "" ? limit(body.deskripsi, 500) : null,
    description: buildDescription(body) || null,
    drugClass,
    nieBpom: body.nie !== "" ? body.nie : null,
    composition: body.komposisi !== "" ? limit(body.komposisi, 255) : null,
    indication: guessIndication(body.deskripsi),
    maxQtyPerOrder: tags.maxQty,
    storage: "suhu ruang",
    weightGrams: nullableInt(cell(row, "Variant Grams")) ?? 0,
  };
  let product: typeof products.$inferSelect;

  if (existing) {
    const dirty = existing.deletedAt !== null || Object.entries(columns).some(([key, value]) => existing[key as keyof typeof existing] !== value);

    [product] = dirty
      ? await db
          .update(products)
          .set({ ...columns, deletedAt: null, updatedAt: now })
          .where(eq(products.id, existing.id))
          .returning()
      : [existing];
    summary.updated++;
  } else {
    [product] = await db
      .insert(products)
      .values({ ...columns, sku, createdAt: now, updatedAt: now })
      .returning();
    summary.created++;
  }

  if (needsWarning) {
    summary.warnedInactive++;
  }

  const imageUrl = cell(row, "Image Src").trim();

  if (imageUrl !== "") {
    const [{ total }] = await db.select({ total: count() }).from(productImages).where(eq(productImages.productId, product.id));

    if (total === 0) {
      images.queue(product, [imageUrl]);
    }
  }
}

type Body = { kemasan: string; deskripsi: string; komposisi: string; golongan: string; bentukSediaan: string; nie: string };

/** `Body (HTML)` is `<p>kemasan</p><p>Label: value</p>…`; unknown labels are ignored. */
function parseBody(html: string): Body {
  const paragraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => decodeEntities(match[1].replace(/<[^>]*>/g, "")).trim());
  const fields: Body = { kemasan: paragraphs[0] ?? "", deskripsi: "", komposisi: "", golongan: "", bentukSediaan: "", nie: "" };

  for (const paragraph of paragraphs.slice(1)) {
    const match = /^([^:]+):\s*([\s\S]*)$/.exec(paragraph);

    if (!match) {
      continue;
    }

    const value = match[2].trim();

    switch (match[1].trim()) {
      case "Deskripsi":
        fields.deskripsi = value;
        break;
      case "Komposisi":
        fields.komposisi = value;
        break;
      case "Golongan Obat":
        fields.golongan = value.toUpperCase();
        break;
      case "Bentuk Sediaan":
        fields.bentukSediaan = value;
        break;
      case "NIE":
        fields.nie = value;
        break;
    }
  }

  return fields;
}

/** html_entity_decode() for what an export holds: named, decimal and hex entities. */
function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#039": "'" };

  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));

    return named[code.toLowerCase()] ?? entity;
  });
}

function buildDescription(body: Body): string {
  return [body.kemasan !== "" ? `Kemasan: ${body.kemasan}` : null, body.deskripsi !== "" ? body.deskripsi : null, body.bentukSediaan !== "" ? `Bentuk Sediaan: ${body.bentukSediaan}` : null]
    .filter((part) => part !== null)
    .join("\n\n");
}

/** Only when the sentence says so plainly; never made up. */
function guessIndication(deskripsi: string): string | null {
  const match = /yang (?:diindikasikan untuk|berkhasiat untuk|berfungsi untuk) (.+)/i.exec(deskripsi);

  return match ? limit(match[1].trim().replace(/\.+$/, ""), 1000) : null;
}

function guessUnit(kemasan: string): string {
  const lower = kemasan.toLowerCase();

  return UNIT_KEYWORDS.find(([keyword]) => lower.includes(keyword.toLowerCase()))?.[1] ?? "Pcs";
}

/** `Tags` is one category plus `mqty:N`; `mqty:0` means no limit. */
function parseTags(raw: string): { category: string; maxQty: number | null } {
  let category = "Kesehatan";
  let maxQty: number | null = null;

  for (const tag of raw.split(",").map((part) => part.trim())) {
    if (tag === "" || tag === "0") {
      // array_filter() drops empty tags (and "0")
      continue;
    }

    const match = /^mqty:(\d+)$/i.exec(tag);

    if (match) {
      maxQty = Number(match[1]) > 0 ? Number(match[1]) : null;
    } else {
      category = tag;
    }
  }

  return { category, maxQty };
}

function nullableInt(value: string): number | null {
  const text = value.trim();

  return text === "" || phpFloat(text) <= 0 ? null : Math.round(phpFloat(text));
}

/** PHP's (float) cast: the number at the start, or 0. */
function phpFloat(value: string): number {
  const match = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(value);

  return match ? Number(match[0]) : 0;
}

/** Str::limit($value, $limit, ''): cut to the limit, trailing spaces dropped. */
function limit(value: string, length: number): string {
  const characters = [...value];

  return characters.length <= length ? value : characters.slice(0, length).join("").trimEnd();
}
