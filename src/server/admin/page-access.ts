import { authorizes, can, loadStaffAccess, type StaffAccess } from "@/lib/permissions";
import { errorPageResponse } from "@/server/error-page";
import { CATALOG_PERMISSIONS, findAttribute, findCategory, findSupplier } from "./catalog-records";
import { COUPON_PERMISSIONS, findCoupon } from "./coupons";
import { findConversation } from "./inbox";
import { findNewsletter } from "./newsletters";
import { CUSTOMER_PERMISSIONS, findCustomer } from "./customers";
import { findAdminOrder, ORDER_PERMISSIONS } from "./orders";
import { findInvoice, findTransfer, TRANSFER_PERMISSIONS } from "./finance-transfers";
import { findAdminProduct, PRODUCT_PERMISSIONS } from "./products";
import type { Staff } from "./staff-auth";

/**
 * Who may open which admin page, checked in src/proxy.ts before the page streams, so
 * the answer carries Laravel's status code: 404 when the record isn't there (or belongs
 * to another branch), then 403 when the staff member lacks the permission. Each screen
 * adds its rules as it is ported; other paths are left to the pages themselves.
 */
type Rule = {
  pattern: RegExp;
  allowed: (access: StaffAccess) => boolean;
  /** whether the record in the path exists for this staff member */
  record?: (id: number, staff: Staff) => Promise<boolean>;
};

const orderExists = async (id: number, staff: Staff) => (await findAdminOrder(id, staff)) !== null;
const productExists = async (id: number) => (await findAdminProduct(id)) !== null;

/** Kategori, Atribut, Pemasok, Pelanggan and Kupon: list, create and edit; there is no page for one record. */
function catalogRules(slug: string, exists: (id: number, staff: Staff) => Promise<unknown>, permissions = CATALOG_PERMISSIONS): Rule[] {
  return [
    { pattern: new RegExp(`^/admin/${slug}$`), allowed: (access) => authorizes(access, permissions, "viewAny") },
    { pattern: new RegExp(`^/admin/${slug}/create$`), allowed: (access) => authorizes(access, permissions, "create") },
    { pattern: new RegExp(`^/admin/${slug}/([^/]+)/edit$`), allowed: (access) => authorizes(access, permissions, "update"), record: async (id, staff) => (await exists(id, staff)) !== null },
    { pattern: new RegExp(`^/admin/${slug}/([^/]+)$`), allowed: () => true, record: async () => false },
  ];
}

const RULES: Rule[] = [
  { pattern: /^\/admin\/pesanan$/, allowed: (access) => authorizes(access, ORDER_PERMISSIONS, "viewAny") },
  { pattern: /^\/admin\/pesanan\/create$/, allowed: (access) => authorizes(access, ORDER_PERMISSIONS, "create") },
  { pattern: /^\/admin\/pesanan\/([^/]+)$/, allowed: (access) => authorizes(access, ORDER_PERMISSIONS, "view"), record: orderExists },
  { pattern: /^\/admin\/pesanan\/([^/]+)\/edit$/, allowed: (access) => authorizes(access, ORDER_PERMISSIONS, "update"), record: orderExists },
  { pattern: /^\/admin\/pengambilan$/, allowed: (access) => can(access, "Pesanan:Proses") },
  { pattern: /^\/admin\/produk$/, allowed: (access) => authorizes(access, PRODUCT_PERMISSIONS, "viewAny") },
  { pattern: /^\/admin\/produk\/create$/, allowed: (access) => authorizes(access, PRODUCT_PERMISSIONS, "create") },
  // ProductImport::canAccess()
  { pattern: /^\/admin\/produk\/impor$/, allowed: (access) => can(access, "Produk:Lihat") },
  { pattern: /^\/admin\/produk\/([^/]+)$/, allowed: (access) => authorizes(access, PRODUCT_PERMISSIONS, "view"), record: productExists },
  { pattern: /^\/admin\/produk\/([^/]+)\/edit$/, allowed: (access) => authorizes(access, PRODUCT_PERMISSIONS, "update"), record: productExists },
  { pattern: /^\/admin\/inventaris\/stok$/, allowed: (access) => can(access, "Inventaris:Lihat") },
  { pattern: /^\/admin\/inventaris\/matriks$/, allowed: (access) => can(access, "Inventaris:Lihat") },
  { pattern: /^\/admin\/inventaris\/transfer$/, allowed: (access) => authorizes(access, TRANSFER_PERMISSIONS, "viewAny") },
  { pattern: /^\/admin\/inventaris\/transfer\/create$/, allowed: (access) => authorizes(access, TRANSFER_PERMISSIONS, "create") },
  {
    pattern: /^\/admin\/inventaris\/transfer\/([^/]+)$/,
    allowed: (access) => authorizes(access, TRANSFER_PERMISSIONS, "view"),
    record: async (id, staff) => (await findTransfer(id, staff)) !== null,
  },
  { pattern: /^\/admin\/faktur$/, allowed: (access) => can(access, "Pesanan:Lihat") },
  { pattern: /^\/admin\/faktur\/([^/]+)$/, allowed: (access) => can(access, "Pesanan:Lihat"), record: async (id, staff) => (await findInvoice(id, staff)) !== null },
  { pattern: /^\/admin\/rekonsiliasi$/, allowed: (access) => can(access, "Pesanan:Lihat") },
  ...catalogRules("kategori", findCategory),
  ...catalogRules("atribut", findAttribute),
  ...catalogRules("pemasok", findSupplier),
  { pattern: /^\/admin\/inbox$/, allowed: (access) => can(access, "Inbox:Lihat") },
  { pattern: /^\/admin\/inbox\/([^/]+)$/, allowed: (access) => can(access, "Inbox:Lihat"), record: async (id) => (await findConversation(id)) !== null },
  { pattern: /^\/admin\/newsletter$/, allowed: (access) => can(access, "Konten:Lihat") },
  { pattern: /^\/admin\/newsletter\/create$/, allowed: (access) => can(access, "Konten:Ubah") },
  { pattern: /^\/admin\/newsletter\/([^/]+)\/edit$/, allowed: (access) => can(access, "Konten:Ubah"), record: async (id) => (await findNewsletter(id)) !== null },
  { pattern: /^\/admin\/newsletter\/([^/]+)$/, allowed: () => true, record: async () => false },
  { pattern: /^\/admin\/subscriber$/, allowed: (access) => can(access, "Konten:Lihat") },
  ...catalogRules("pelanggan", findCustomer, CUSTOMER_PERMISSIONS),
  ...catalogRules("kupon", findCoupon, COUPON_PERMISSIONS),
];

/** The error response for this page, or null when the staff member may open it. */
export async function adminPageRefusal(pathname: string, staff: Staff): Promise<Response | null> {
  for (const rule of RULES) {
    const match = rule.pattern.exec(pathname);

    if (!match) {
      continue;
    }

    if (rule.record) {
      const id = /^\d+$/.test(match[1]) ? Number(match[1]) : null;

      if (id === null || !(await rule.record(id, staff))) {
        return errorPageResponse(404, "Not Found");
      }
    }

    return rule.allowed(await loadStaffAccess(staff.id)) ? null : errorPageResponse(403, "Forbidden");
  }

  return null;
}
