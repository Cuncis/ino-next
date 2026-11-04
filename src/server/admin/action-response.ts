import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { loadStaffAccess, type StaffAccess } from "@/lib/permissions";
import { staffForAction } from "./staff-guard";
import type { Staff } from "./staff-auth";

/**
 * Shared by the admin's action endpoints: the signed-in staff member with their rights,
 * and Filament's notification (toast) as JSON for the page to show.
 */
export type ToastSpec = { status: "success" | "danger" | "warning" | "info"; title: string; replace?: Record<string, string | number>; body?: string; persistent?: boolean };

export function toastJson(locale: AdminLocale, toast: ToastSpec, extra: Record<string, unknown> = {}, status = 200): Response {
  return Response.json(
    {
      toast: { status: toast.status, title: translate(locale, toast.title, toast.replace), body: toast.body ? translate(locale, toast.body, toast.replace) : undefined, persistent: toast.persistent || undefined },
      ...extra,
    },
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

export type BulkOutcome = { success: number; total: number };

/**
 * Filament v4's bulk processing: each selected record on its own, so one that can't be
 * changed (a foreign key holds it) doesn't stop the rest. `work` returns false or throws
 * for a record that failed.
 */
export async function eachRecord(ids: number[], work: (id: number) => Promise<boolean | void>): Promise<BulkOutcome> {
  let success = 0;

  for (const id of ids) {
    try {
      if ((await work(id)) !== false) {
        success++;
      }
    } catch (error) {
      console.error(error);
    }
  }

  return { success, total: ids.length };
}

const BULK_TEXTS = {
  delete: { done: "Data berhasil dihapus", partial: "Menghapus :count dari :total", none: "Gagal menghapus", failed: ":count tidak dapat dihapus." },
  forceDelete: { done: "Data berhasil dihapus", partial: "Menghapus :count dari :total", none: "Gagal menghapus", failed: ":count tidak dapat dihapus." },
  restore: { done: "Data berhasil dipulihkan", partial: "Pulihkan :count dari :total", none: "Gagal memulihkan", failed: ":count tidak dapat dipulihkan." },
} as const;

/** The bulk action's notification: done, or (persistent) a warning for some and a danger for none. */
export function bulkOutcomeJson(locale: AdminLocale, kind: keyof typeof BULK_TEXTS, outcome: BulkOutcome, extra: Record<string, unknown> = {}): Response {
  const texts = BULK_TEXTS[kind];
  const failed = outcome.total - outcome.success;

  if (failed === 0) {
    return toastJson(locale, { status: "success", title: texts.done }, extra);
  }

  return Response.json({
    toast: {
      status: outcome.success ? "warning" : "danger",
      title: translate(locale, outcome.success ? texts.partial : texts.none, { count: outcome.success, total: outcome.total }),
      body: translate(locale, texts.failed, { count: failed }),
      persistent: true,
    },
    ...extra,
  });
}
