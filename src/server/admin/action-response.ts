import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { loadStaffAccess, type StaffAccess } from "@/lib/permissions";
import { staffForAction } from "./staff-guard";
import type { Staff } from "./staff-auth";

/**
 * Shared by the admin's action endpoints: the signed-in staff member with their rights,
 * and Filament's notification (toast) as JSON for the page to show.
 */
export type ToastSpec = { status: "success" | "danger" | "warning" | "info"; title: string; replace?: Record<string, string | number>; body?: string };

export function toastJson(locale: AdminLocale, toast: ToastSpec, extra: Record<string, unknown> = {}, status = 200): Response {
  return Response.json(
    { toast: { status: toast.status, title: translate(locale, toast.title, toast.replace), body: toast.body ? translate(locale, toast.body, toast.replace) : undefined }, ...extra },
    { status },
  );
}

/** The staff member for an admin action, refused with 403 when `allowed` says no. */
export async function adminActionContext(
  request: Request,
  allowed: (access: StaffAccess) => boolean,
): Promise<{ staff: Staff; access: StaffAccess; locale: AdminLocale; response?: never } | { response: Response; staff?: never; access?: never; locale?: never }> {
  const guard = await staffForAction(request);

  if (guard.response) {
    return { response: guard.response };
  }

  const access = await loadStaffAccess(guard.staff.id);

  if (!allowed(access)) {
    return { response: Response.json({ message: "This action is unauthorized." }, { status: 403 }) };
  }

  return { staff: guard.staff, access, locale: guard.locale };
}

/** The `ids` of a bulk action's body, as numbers. */
export function idsFrom(body: Record<string, unknown>): number[] {
  return Array.isArray(body.ids) ? body.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
}
