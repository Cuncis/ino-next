import { and, asc, isNull, sql } from "drizzle-orm";
import { db, orders } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { branchScope } from "@/lib/branch-scope";
import { authorizes, can, type StaffAccess } from "@/lib/permissions";
import { ORDER_PERMISSIONS, searchWords } from "./orders";
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
  search: (term: string, staff: Staff) => Promise<{ title: string; url: string }[]>;
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

const PROVIDERS: Provider[] = [
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

    const results = await provider.search(term, staff);

    if (results.length) {
      groups.push({ label: translate(locale, provider.label), results: results.map((result) => ({ ...result, details: [] })) });
    }
  }

  return groups;
}
