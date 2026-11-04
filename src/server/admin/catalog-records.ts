import { and, count, eq, inArray, isNull, max, sql, type SQL } from "drizzle-orm";
import { attributes, categories, db, products, suppliers } from "@/db";
import { nextCode } from "@/lib/code-sequence";
import type { ResourcePermissions } from "@/lib/permissions";
import { uniqueSlug } from "@/lib/slug";
import type { AttributeFormData, CategoryFormData, SupplierFormData } from "./catalog-forms";
import { orderBy, searchWords, trashedCondition, type SortState } from "./list-query";

/**
 * Kategori, Atribut and Pemasok: product master data, under the Produk permissions.
 * A category or supplier still holding products can't be deleted one at a time (the bulk
 * delete doesn't check, as in Laravel).
 */
export const CATALOG_PERMISSIONS: ResourcePermissions = { viewAny: "Produk:Lihat", create: "Produk:Tambah", update: "Produk:Ubah", delete: "Produk:Hapus" };

export type Category = typeof categories.$inferSelect;
export type Attribute = typeof attributes.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;

type ListQuery = { search?: string; trashed?: string; page: number; perPage: number };

/** Products (not deleted) of a category or supplier: `$record->products()->count()`. */
const productCount = (column: typeof products.categoryId | typeof products.supplierId, id: SQL) =>
  sql<string>`(select count(*) from ${products} where ${column} = ${id} and ${products.deletedAt} is null)`;

/* ---------------- Kategori ---------------- */

export async function listCategories(query: ListQuery) {
  const where = and(trashedCondition(categories.deletedAt, query.trashed), searchWords(query.search, [sql`${categories.name}`, sql`${categories.slug}`]));
  const [{ total }] = await db.select({ total: count() }).from(categories).where(where);
  const rows = await db
    .select({ category: categories, products: productCount(products.categoryId, sql`${categories.id}`) })
    .from(categories)
    .where(where)
    .orderBy(...orderBy(null, {}, { column: categories.position, direction: "asc" }, categories.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.category, productCount: Number(row.products) })) };
}

export async function findCategory(id: number): Promise<Category | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);

  return row ?? null;
}

export async function categoryProductCount(id: number): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .where(and(eq(products.categoryId, id), isNull(products.deletedAt)));

  return total;
}

/**
 * CreateCategory: a free slug from the slug field or the name, at the end of the order,
 * with one of the twelve stock pictures by how many categories there are.
 */
export async function createCategory(data: CategoryFormData): Promise<Category> {
  const [[{ highest }], [{ existing }]] = await Promise.all([
    db.select({ highest: max(categories.position) }).from(categories).where(isNull(categories.deletedAt)),
    db.select({ existing: count() }).from(categories).where(isNull(categories.deletedAt)),
  ]);
  const now = new Date();
  const [category] = await db
    .insert(categories)
    .values({
      name: data.name,
      slug: await uniqueSlug({ table: categories, column: categories.slug, value: data.slug ?? data.name }),
      status: data.status,
      description: data.description,
      position: Number(highest ?? 0) + 1,
      imagePath: `/media/images/small/img-${(existing % 12) + 1}.jpg`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return category;
}

/** EditCategory: an emptied slug keeps the old one. */
export async function updateCategory(category: Category, data: CategoryFormData): Promise<void> {
  const slug = await uniqueSlug({ table: categories, column: categories.slug, value: data.slug ?? category.slug, idColumn: categories.id, ignoreId: category.id });
  const next = { name: data.name, slug, status: data.status, description: data.description };

  if (Object.entries(next).some(([key, value]) => category[key as keyof Category] !== value)) {
    await db
      .update(categories)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(categories.id, category.id));
  }
}

/* ---------------- Atribut ---------------- */

export const ATTRIBUTE_SORTABLE = ["created_at", "updated_at"] as const;

export async function listAttributes(query: ListQuery & { sort: SortState }) {
  const where = and(trashedCondition(attributes.deletedAt, query.trashed), searchWords(query.search, [sql`${attributes.name}`, sql`${attributes.slug}`]));
  const [{ total }] = await db.select({ total: count() }).from(attributes).where(where);
  const rows = await db
    .select()
    .from(attributes)
    .where(where)
    .orderBy(...orderBy(query.sort, { created_at: attributes.createdAt, updated_at: attributes.updatedAt }, { column: attributes.name, direction: "asc" }, attributes.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows };
}

export async function findAttribute(id: number): Promise<Attribute | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(attributes).where(eq(attributes.id, id)).limit(1);

  return row ?? null;
}

export async function createAttribute(data: AttributeFormData): Promise<Attribute> {
  const now = new Date();
  const [attribute] = await db
    .insert(attributes)
    .values({ name: data.name, slug: await uniqueSlug({ table: attributes, column: attributes.slug, value: data.name }), type: data.type, values: data.values, createdAt: now, updatedAt: now })
    .returning();

  return attribute;
}

export async function updateAttribute(attribute: Attribute, data: AttributeFormData): Promise<void> {
  const slug = await uniqueSlug({ table: attributes, column: attributes.slug, value: data.name, idColumn: attributes.id, ignoreId: attribute.id });
  const changed = attribute.name !== data.name || attribute.slug !== slug || attribute.type !== data.type || JSON.stringify(attribute.values) !== JSON.stringify(data.values);

  if (changed) {
    await db.update(attributes).set({ name: data.name, slug, type: data.type, values: data.values, updatedAt: new Date() }).where(eq(attributes.id, attribute.id));
  }
}

/* ---------------- Pemasok ---------------- */

export async function listSuppliers(query: ListQuery) {
  const where = and(
    trashedCondition(suppliers.deletedAt, query.trashed),
    searchWords(query.search, [sql`${suppliers.code}`, sql`${suppliers.name}`, sql`${suppliers.contactPerson}`, sql`${suppliers.kota}`]),
  );
  const [{ total }] = await db.select({ total: count() }).from(suppliers).where(where);
  const rows = await db
    .select({
      supplier: suppliers,
      products: productCount(products.supplierId, sql`${suppliers.id}`),
      revenue: sql<string>`(select coalesce(sum(${products.price} * ${products.soldCount}), 0) from ${products} where ${products.supplierId} = ${suppliers.id} and ${products.deletedAt} is null)`,
    })
    .from(suppliers)
    .where(where)
    .orderBy(...orderBy(null, {}, { column: suppliers.id, direction: "asc" }, suppliers.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.supplier, productCount: Number(row.products), revenue: Number(row.revenue) })) };
}

export async function findSupplier(id: number): Promise<Supplier | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);

  return row ?? null;
}

export async function supplierProductCount(id: number): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .where(and(eq(products.supplierId, id), isNull(products.deletedAt)));

  return total;
}

/** CreateSupplier: code SEL-001 onwards. */
export async function createSupplier(data: SupplierFormData): Promise<Supplier> {
  const now = new Date();
  const [supplier] = await db
    .insert(suppliers)
    .values({
      code: await nextCode({ table: suppliers, column: suppliers.code, prefix: "SEL-" }),
      name: data.name,
      contactPerson: data.contact_person,
      email: data.email,
      phone: data.phone,
      licenseNumber: data.license_number,
      kota: data.kota,
      status: data.status,
      addressLine: data.address_line,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return supplier;
}

export async function updateSupplier(supplier: Supplier, data: SupplierFormData): Promise<void> {
  const next = {
    name: data.name,
    contactPerson: data.contact_person,
    email: data.email,
    phone: data.phone,
    licenseNumber: data.license_number,
    kota: data.kota,
    status: data.status,
    addressLine: data.address_line,
  };

  if (Object.entries(next).some(([key, value]) => supplier[key as keyof Supplier] !== value)) {
    await db
      .update(suppliers)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(suppliers.id, supplier.id));
  }
}

/* ---------------- deleting, for all three ---------------- */

const TABLES = { kategori: categories, atribut: attributes, pemasok: suppliers } as const;

export type CatalogSlug = keyof typeof TABLES;

export async function softDeleteRecord(slug: CatalogSlug, id: number): Promise<boolean> {
  const table = TABLES[slug];

  await db
    .update(table)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(table.id, id), isNull(table.deletedAt)));

  return true;
}

export async function restoreRecord(slug: CatalogSlug, id: number): Promise<boolean> {
  const table = TABLES[slug];

  await db.update(table).set({ deletedAt: null, updatedAt: new Date() }).where(eq(table.id, id));

  return true;
}

/** Fails (false) while products still point at the category or supplier, deleted ones included. */
export async function forceDeleteRecord(slug: CatalogSlug, id: number): Promise<boolean> {
  const table = TABLES[slug];

  try {
    await db.delete(table).where(eq(table.id, id));

    return true;
  } catch {
    return false;
  }
}

export async function existingIds(slug: CatalogSlug, ids: number[]): Promise<number[]> {
  const table = TABLES[slug];

  if (!ids.length) {
    return [];
  }

  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(inArray(table.id, ids))
    .orderBy(table.id);

  return rows.map((row) => row.id);
}
