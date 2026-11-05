import { authorizes, type ResourcePermissions } from "@/lib/permissions";
import { validationErrorResponse } from "@/lib/validation";
import { adminActionContext, bulkOutcomeJson, eachRecord, idsFrom, toastJson } from "./action-response";
import {
  COUPON_PERMISSIONS,
  createCoupon,
  existingCouponIds,
  findCoupon,
  forceDeleteCoupon,
  restoreCoupon,
  softDeleteCoupon,
  updateCoupon,
  validateCouponForm,
  type CouponFormData,
} from "./coupons";
import {
  createCustomer,
  CUSTOMER_PERMISSIONS,
  customerOrderCount,
  findCustomer,
  forceDeleteCustomer,
  restoreCustomer,
  softDeleteCustomer,
  updateCustomer,
  validateCustomerForm,
  visibleCustomerIds,
  type CustomerFormData,
} from "./customers";
import { formBody } from "./form-body";
import type { Staff } from "./staff-auth";
import type { AdminLocale } from "@/lib/admin-i18n";

/**
 * Pelanggan and Kupon behind /admin/{pelanggan|kupon}/…: the form, the deletions and the
 * bulk deletions. Neither has a page of its own, so a new record opens on its edit page.
 */
type Driver = {
  permissions: ResourcePermissions;
  find: (id: number, staff: Staff) => Promise<{ id: number } | null>;
  validate: (body: Record<string, unknown>, locale: AdminLocale, ignoreId: number | null) => Promise<{ data: unknown; errors: Record<string, string[]> | null }>;
  create: (data: never, staff: Staff) => Promise<{ id: number }>;
  update: (record: never, data: never) => Promise<void>;
  /** a danger notification that cancels a single delete */
  refuseDelete?: (record: never, staff: Staff) => Promise<{ title: string; body: string; replace: Record<string, string | number> } | null>;
  softDelete: (id: number) => Promise<boolean>;
  restore: (id: number) => Promise<boolean>;
  forceDelete: (id: number) => Promise<boolean>;
  existing: (ids: number[], staff: Staff) => Promise<number[]>;
};

const DRIVERS = {
  pelanggan: {
    permissions: CUSTOMER_PERMISSIONS,
    find: findCustomer,
    validate: validateCustomerForm,
    create: ((data: CustomerFormData, staff: Staff) => createCustomer(data, staff)) as never,
    update: updateCustomer as never,
    // the same guard as the legacy admin: deactivate a customer with order history instead
    refuseDelete: (async (record: { id: number; name: string }, staff: Staff) => {
      const count = await customerOrderCount(record.id, staff);

      return count > 0 ? { title: '":name" memiliki :count pesanan dan tidak bisa dihapus.', body: "Ubah statusnya menjadi Nonaktif.", replace: { name: record.name, count } } : null;
    }) as never,
    softDelete: softDeleteCustomer,
    restore: restoreCustomer,
    forceDelete: forceDeleteCustomer,
    existing: visibleCustomerIds,
  },
  kupon: {
    permissions: COUPON_PERMISSIONS,
    find: (id: number) => findCoupon(id),
    validate: validateCouponForm,
    create: ((data: CouponFormData) => createCoupon(data)) as never,
    update: updateCoupon as never,
    softDelete: softDeleteCoupon,
    restore: restoreCoupon,
    forceDelete: forceDeleteCoupon,
    existing: (ids: number[]) => existingCouponIds(ids),
  },
} satisfies Record<string, Driver>;

export type CrmSlug = keyof typeof DRIVERS;

const notFound = () => Response.json({ message: "Not Found" }, { status: 404 });

/** POST /admin/{slug}/buat. */
export async function createCrmAction(request: Request, slug: CrmSlug): Promise<Response> {
  const driver: Driver = DRIVERS[slug];
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, driver.permissions, "create"));

  if (response) {
    return response;
  }

  const { data } = await formBody(request);
  const result = await driver.validate(data, locale, null);

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const record = await driver.create(result.data as never, staff);

  return toastJson(locale, { status: "success", title: "Data berhasil dibuat" }, { redirect: data.another ? `/admin/${slug}/create` : `/admin/${slug}/${record.id}/edit` });
}

/** POST /admin/{slug}/{id}/simpan. */
export async function updateCrmAction(request: Request, slug: CrmSlug, id: string): Promise<Response> {
  const driver: Driver = DRIVERS[slug];
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, driver.permissions, "update"));

  if (response) {
    return response;
  }

  const record = await driver.find(Number(id), staff);

  if (!record) {
    return notFound();
  }

  const result = await driver.validate((await formBody(request)).data, locale, record.id);

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  await driver.update(record as never, result.data as never);

  return toastJson(locale, { status: "success", title: "Data berhasil disimpan" });
}

/** POST /admin/{slug}/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function crmOperationAction(request: Request, slug: CrmSlug, id: string, operation: string): Promise<Response> {
  const driver: Driver = DRIVERS[slug];
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, driver.permissions, "delete"));

  if (response) {
    return response;
  }

  const record = await driver.find(Number(id), staff);

  if (!record) {
    return notFound();
  }

  const toList = (await formBody(request)).data.back === "list" ? { redirect: `/admin/${slug}` } : {};

  switch (operation) {
    case "hapus": {
      const refusal = await driver.refuseDelete?.(record as never, staff);

      if (refusal) {
        return toastJson(locale, { status: "danger", ...refusal });
      }

      await driver.softDelete(record.id);

      return toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, toList);
    }
    case "hapus-permanen":
      return (await driver.forceDelete(record.id)) ? toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, toList) : toastJson(locale, { status: "danger", title: "Gagal menghapus" });
    case "pulihkan":
      await driver.restore(record.id);

      return toastJson(locale, { status: "success", title: "Data berhasil dipulihkan" });
    default:
      return notFound();
  }
}

/** POST /admin/{slug}/massal/{action}: Filament's bulk deletions, record by record (no order guard, as in Laravel). */
export async function crmBulkAction(request: Request, slug: CrmSlug, action: string): Promise<Response> {
  const driver: Driver = DRIVERS[slug];
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, driver.permissions, "delete"));

  if (response) {
    return response;
  }

  const ids = await driver.existing(idsFrom((await formBody(request)).data), staff);

  switch (action) {
    case "hapus":
      return bulkOutcomeJson(locale, "delete", await eachRecord(ids, driver.softDelete));
    case "hapus-permanen":
      return bulkOutcomeJson(locale, "forceDelete", await eachRecord(ids, driver.forceDelete));
    case "pulihkan":
      return bulkOutcomeJson(locale, "restore", await eachRecord(ids, driver.restore));
    default:
      return notFound();
  }
}
