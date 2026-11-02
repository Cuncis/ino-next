import { authorizes, can, loadStaffAccess, type StaffAccess } from "@/lib/permissions";
import { errorPageResponse } from "@/server/error-page";
import { findAdminOrder, ORDER_PERMISSIONS } from "./orders";
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

const RULES: Rule[] = [
  { pattern: /^\/admin\/pesanan$/, allowed: (access) => authorizes(access, ORDER_PERMISSIONS, "viewAny") },
  { pattern: /^\/admin\/pesanan\/create$/, allowed: (access) => authorizes(access, ORDER_PERMISSIONS, "create") },
  { pattern: /^\/admin\/pesanan\/([^/]+)$/, allowed: (access) => authorizes(access, ORDER_PERMISSIONS, "view"), record: orderExists },
  { pattern: /^\/admin\/pesanan\/([^/]+)\/edit$/, allowed: (access) => authorizes(access, ORDER_PERMISSIONS, "update"), record: orderExists },
  { pattern: /^\/admin\/pengambilan$/, allowed: (access) => can(access, "Pesanan:Proses") },
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
