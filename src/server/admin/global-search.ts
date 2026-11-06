import { and, asc, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { attributes, branches, categories, chatConversations, roles, users, coupons, customers, db, newsletters, orders, payments, products, stockTransfers, subscribers, suppliers } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { branchScope, customerBranchScope, transferBranchScope } from "@/lib/branch-scope";
import { authorizes, can, type StaffAccess } from "@/lib/permissions";
import { CATALOG_PERMISSIONS } from "./catalog-records";
import { BRANCH_PERMISSIONS } from "./branches";
import { COUPON_PERMISSIONS } from "./coupons";
import { CUSTOMER_PERMISSIONS } from "./customers";
import { ORDER_PERMISSIONS, searchWords } from "./orders";
import { PRODUCT_PERMISSIONS } from "./products";
import { TRANSFER_PERMISSIONS } from "./finance-transfers";
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

/**
 * `column` matching every word, LIMIT at most, in no particular order: Filament's query
 * has no ORDER BY, so PostgreSQL answers in its storage order (an updated row moves to
 * the end), and the same unordered query here gets the same order.
 */
async function titles(table: PgTable & { id: AnyPgColumn }, column: AnyPgColumn, term: string, where?: ReturnType<typeof and>) {
  return db
    .select({ id: table.id, title: column })
    .from(table as PgTable)
    .where(and(where, searchWords(term, [sql`${column}`])))
    .limit(LIMIT) as Promise<{ id: number; title: string }[]>;
}

const PROVIDERS: Provider[] = [
  {
    folder: "Branches",
    label: "plural:Cabang",
    allowed: (access) => authorizes(access, BRANCH_PERMISSIONS, "viewAny"),
    search: async (term, _staff, access) =>
      (await titles(branches, branches.name, term, isNull(branches.deletedAt))).map((row) => ({
        title: row.title,
        url: authorizes(access, BRANCH_PERMISSIONS, "update") ? `/admin/cabang/${row.id}/edit` : `/admin/cabang?tableAction=view&tableActionRecord=${row.id}`,
      })),
  },
  {
    // no policy: whoever sees Staf may edit
    folder: "Staff",
    label: "plural:Staf",
    allowed: (access) => can(access, "Pengaturan:Ubah"),
    search: async (term) => (await titles(users, users.name, term, isNull(users.deletedAt))).map((row) => ({ title: row.title, url: `/admin/staf/${row.id}/edit` })),
  },
  {
    folder: "Roles",
    label: "plural:Peran",
    allowed: (access) => can(access, "Peran:Lihat"),
    search: async (term, _staff, access) =>
      (await titles(roles, roles.name, term)).map((row) => ({ title: row.title, url: can(access, "Peran:Ubah") ? `/admin/peran/${row.id}/edit` : `/admin/peran?tableAction=view&tableActionRecord=${row.id}` })),
  },
  {
    folder: "ChatConversations",
    label: "plural:Percakapan",
    allowed: (access) => can(access, "Inbox:Lihat"),
    search: async (term) => (await titles(chatConversations, chatConversations.name, term)).map((row) => ({ title: row.title, url: `/admin/inbox/${row.id}` })),
  },
  {
    folder: "Coupons",
    label: "plural:Kupon",
    allowed: (access) => authorizes(access, COUPON_PERMISSIONS, "viewAny"),
    search: async (term) => (await titles(coupons, coupons.code, term, isNull(coupons.deletedAt))).map((row) => ({ title: row.title, url: `/admin/kupon/${row.id}/edit` })),
  },
  {
    folder: "Customers",
    label: "plural:Pelanggan",
    allowed: (access) => authorizes(access, CUSTOMER_PERMISSIONS, "viewAny"),
    search: async (term, staff, access) =>
      (await titles(customers, customers.name, term, and(isNull(customers.deletedAt), customerBranchScope(staff)))).map((row) => ({
        title: row.title,
        url: authorizes(access, CUSTOMER_PERMISSIONS, "update") ? `/admin/pelanggan/${row.id}/edit` : `/admin/pelanggan?tableAction=view&tableActionRecord=${row.id}`,
      })),
  },
  {
    folder: "Newsletters",
    label: "plural:Newsletter",
    allowed: (access) => can(access, "Konten:Lihat"),
    search: async (term, _staff, access) =>
      (await titles(newsletters, newsletters.name, term)).map((row) => ({
        title: row.title,
        url: can(access, "Konten:Ubah") ? `/admin/newsletter/${row.id}/edit` : `/admin/newsletter?tableAction=view&tableActionRecord=${row.id}`,
      })),
  },
  {
    // no page for one subscriber: the list with its view action
    folder: "Subscribers",
    label: "plural:Subscriber",
    allowed: (access) => can(access, "Konten:Lihat"),
    search: async (term) => (await titles(subscribers, subscribers.email, term)).map((row) => ({ title: row.title, url: `/admin/subscriber?tableAction=view&tableActionRecord=${row.id}` })),
  },
  catalogProvider("Attributes", "plural:Atribut", "atribut", attributes),
  catalogProvider("Categories", "plural:Kategori", "kategori", categories),
  catalogProvider("Suppliers", "plural:Pemasok", "pemasok", suppliers),
  {
    folder: "Invoices",
    label: "plural:Faktur",
    allowed: (access) => can(access, "Pesanan:Lihat"),
    search: async (term, staff) => (await orderNumbers(term, staff)).map((order) => ({ title: order.number, url: `/admin/faktur/${order.id}` })),
  },
  {
    // a payment has no page of its own: the list with its view action (Filament's fallback)
    folder: "Reconciliations",
    label: "plural:Rekonsiliasi",
    allowed: (access) => can(access, "Pesanan:Lihat"),
    search: async (term) =>
      (
        await db
          .select({ id: payments.id, invoiceNumber: payments.invoiceNumber })
          .from(payments)
          .where(searchWords(term, [sql`${payments.invoiceNumber}`]))
          .orderBy(asc(payments.id))
          .limit(LIMIT)
      ).map((payment) => ({ title: payment.invoiceNumber, url: `/admin/rekonsiliasi?tableAction=view&tableActionRecord=${payment.id}` })),
  },
  {
    folder: "StockTransfers",
    label: "plural:Transfer",
    allowed: (access) => authorizes(access, TRANSFER_PERMISSIONS, "viewAny"),
    search: async (term, staff) =>
      (
        await db
          .select({ id: stockTransfers.id, code: stockTransfers.code })
          .from(stockTransfers)
          .where(and(transferBranchScope(staff), searchWords(term, [sql`${stockTransfers.code}`])))
          .orderBy(asc(stockTransfers.id))
          .limit(LIMIT)
      ).map((transfer) => ({ title: transfer.code, url: `/admin/inventaris/transfer/${transfer.id}` })),
  },
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
