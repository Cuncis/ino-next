import { and, asc, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { attributes, categories, db, orders, products, suppliers } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { branchScope } from "@/lib/branch-scope";
import { authorizes, can, type StaffAccess } from "@/lib/permissions";
import { CATALOG_PERMISSIONS } from "./catalog-records";
import { ORDER_PERMISSIONS, searchWords } from "./orders";
import { PRODUCT_PERMISSIONS } from "./products";
import type { Staff } from "./staff-auth";

/**
 * Filament's global search: every resource with a record title, in the order Filament
 * registered them (alphabetically by the resource's folder), up to 50 results each.
 * Each screen adds its provider as it is ported.
 */
export type SearchGroup = { label: string; results: { title: string; url: string; details: { label: string; value: string }[] }[] };

type Provider = {
  /** the Filament resource folder, which sets the group's place */
  folder: string;
  label: string;
  allowed: (access: StaffAccess) => boolean;
  search: (term: string, staff: Staff, access: StaffAccess) => Promise<{ title: string; url: string }[]>;
};

const LIMIT = 50;

async function orderNumbers(term: string, staff: Staff) {
  return db
    .select({ id: orders.id, number: orders.number })
    .from(orders)
    .where(and(isNull(orders.deletedAt), branchScope(orders.branchId, staff), searchWords(term, [sql`${orders.number}`])))
    .orderBy(asc(orders.id))
    .limit(LIMIT);
}

/** Records (not deleted) whose name matches, by id. */
async function byName(table: PgTable & { id: AnyPgColumn; name: AnyPgColumn; deletedAt: AnyPgColumn }, term: string) {
  return db
    .select({ id: table.id, name: table.name })
    .from(table as PgTable)
    .where(and(isNull(table.deletedAt), searchWords(term, [sql`${table.name}`])))
    .orderBy(asc(table.id))
    .limit(LIMIT) as Promise<{ id: number; name: string }[]>;
}

/**
 * A catalogue resource without a view page: its edit page for those who may edit, else
 * the list with the record's view action (Filament's getGlobalSearchResultUrl()).
 */
function catalogProvider(folder: string, label: string, slug: string, table: Parameters<typeof byName>[0]): Provider {
  return {
    folder,
    label,
    allowed: (access) => authorizes(access, CATALOG_PERMISSIONS, "viewAny"),
    search: async (term, _staff, access) =>
      (await byName(table, term)).map((record) => ({
        title: record.name,
        url: authorizes(access, CATALOG_PERMISSIONS, "update") ? `/admin/${slug}/${record.id}/edit` : `/admin/${slug}?tableAction=view&tableActionRecord=${record.id}`,
      })),
  };
}

const PROVIDERS: Provider[] = [
  catalogProvider("Attributes", "plural:Atribut", "atribut", attributes),
  catalogProvider("Categories", "plural:Kategori", "kategori", categories),
  catalogProvider("Suppliers", "plural:Pemasok", "pemasok", suppliers),
  {
    folder: "Products",
    label: "plural:Produk",
    allowed: (access) => authorizes(access, PRODUCT_PERMISSIONS, "viewAny"),
    search: async (term) => (await byName(products, term)).map((product) => ({ title: product.name, url: `/admin/produk/${product.id}` })),
  },
  {
    folder: "Orders",
    label: "plural:Pesanan",
    allowed: (access) => authorizes(access, ORDER_PERMISSIONS, "viewAny"),
    search: async (term, staff) => (await orderNumbers(term, staff)).map((order) => ({ title: order.number, url: `/admin/pesanan/${order.id}` })),
  },
  {
    // every order, not only those waiting at the counter: the resource's own query
    folder: "Pickups",
    label: "plural:Pengambilan",
    allowed: (access) => can(access, "Pesanan:Proses"),
    search: async (term, staff) =>
      (await orderNumbers(term, staff)).map((order) => ({ title: order.number, url: `/admin/pengambilan?tableAction=view&tableActionRecord=${order.id}` })),
  },
];

export async function globalSearch(term: string, staff: Staff, access: StaffAccess, locale: AdminLocale): Promise<SearchGroup[]> {
  if (term.trim() === "") {
    return [];
  }

  const groups: SearchGroup[] = [];

  for (const provider of [...PROVIDERS].sort((a, b) => a.folder.localeCompare(b.folder))) {
    if (!provider.allowed(access)) {
      continue;
    }

    const results = await provider.search(term, staff, access);

    if (results.length) {
      groups.push({ label: translate(locale, provider.label), results: results.map((result) => ({ ...result, details: [] })) });
    }
  }

  return groups;
}
