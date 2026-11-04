import { authorizes } from "@/lib/permissions";
import { validationErrorResponse } from "@/lib/validation";
import type { AdminLocale } from "@/lib/admin-i18n";
import { adminActionContext, bulkOutcomeJson, eachRecord, idsFrom, toastJson } from "./action-response";
import { validateAttributeForm, validateCategoryForm, validateSupplierForm } from "./catalog-forms";
import {
  CATALOG_PERMISSIONS,
  categoryProductCount,
  createAttribute,
  createCategory,
  createSupplier,
  existingIds,
  findAttribute,
  findCategory,
  findSupplier,
  forceDeleteRecord,
  restoreRecord,
  softDeleteRecord,
  supplierProductCount,
  updateAttribute,
  updateCategory,
  updateSupplier,
  type CatalogSlug,
} from "./catalog-records";
import { formBody } from "./form-body";

/**
 * Kategori, Atribut and Pemasok behind /admin/{kategori|atribut|pemasok}/…: the form,
 * the deletions and the bulk deletions. None has a page of its own, so a new record
 * opens on its edit page.
 */
type Resource<T extends { id: number; name: string; deletedAt: Date | null }> = {
  find: (id: number) => Promise<T | null>;
  validate: (body: Record<string, unknown>, locale: AdminLocale, ignoreId: number | null) => Promise<{ data: unknown; errors: Record<string, string[]> | null }>;
  create: (data: never) => Promise<{ id: number }>;
  update: (record: T, data: never) => Promise<void>;
  /** a message when the record still holds products, which keeps a single delete from happening */
  inUse?: (record: T) => Promise<{ title: string; replace: Record<string, string | number> } | null>;
};

const RESOURCES: { [slug in CatalogSlug]: Resource<{ id: number; name: string; deletedAt: Date | null }> } = {
  kategori: {
    find: findCategory,
    validate: validateCategoryForm,
    create: createCategory as never,
    update: updateCategory as never,
    inUse: async (record) => {
      const count = await categoryProductCount(record.id);

      return count > 0 ? { title: 'Kategori ":name" masih dipakai :count produk dan tidak bisa dihapus.', replace: { name: record.name, count } } : null;
    },
  },
  atribut: { find: findAttribute, validate: validateAttributeForm, create: createAttribute as never, update: updateAttribute as never },
  pemasok: {
    find: findSupplier,
    validate: validateSupplierForm,
    create: createSupplier as never,
    update: updateSupplier as never,
    inUse: async (record) => {
      const count = await supplierProductCount(record.id);

      return count > 0 ? { title: '":name" masih memasok :count produk dan tidak bisa dihapus.', replace: { name: record.name, count } } : null;
    },
  },
};

const notFound = () => Response.json({ message: "Not Found" }, { status: 404 });

/** POST /admin/{slug}/buat. */
export async function createCatalogAction(request: Request, slug: CatalogSlug): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => authorizes(access, CATALOG_PERMISSIONS, "create"));

  if (response) {
    return response;
  }

  const { data } = await formBody(request);
  const result = await RESOURCES[slug].validate(data, locale, null);

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const record = await RESOURCES[slug].create(result.data as never);

  return toastJson(locale, { status: "success", title: "Data berhasil dibuat" }, { redirect: data.another ? `/admin/${slug}/create` : `/admin/${slug}/${record.id}/edit` });
}

/** POST /admin/{slug}/{id}/simpan. */
export async function updateCatalogAction(request: Request, slug: CatalogSlug, id: string): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => authorizes(access, CATALOG_PERMISSIONS, "update"));

  if (response) {
    return response;
  }

  const record = await RESOURCES[slug].find(Number(id));

  if (!record) {
    return notFound();
  }

  const result = await RESOURCES[slug].validate((await formBody(request)).data, locale, record.id);

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  await RESOURCES[slug].update(record, result.data as never);

  return toastJson(locale, { status: "success", title: "Data berhasil disimpan" });
}

/** POST /admin/{slug}/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function catalogOperationAction(request: Request, slug: CatalogSlug, id: string, operation: string): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => authorizes(access, CATALOG_PERMISSIONS, "delete"));

  if (response) {
    return response;
  }

  const record = await RESOURCES[slug].find(Number(id));

  if (!record) {
    return notFound();
  }

  const toList = (await formBody(request)).data.back === "list" ? { redirect: `/admin/${slug}` } : {};

  switch (operation) {
    case "hapus": {
      const inUse = await RESOURCES[slug].inUse?.(record);

      // DeleteAction::before() cancels with its own danger notification
      if (inUse) {
        return toastJson(locale, { status: "danger", title: inUse.title, replace: inUse.replace });
      }

      await softDeleteRecord(slug, record.id);

      return toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, toList);
    }
    case "hapus-permanen":
      return (await forceDeleteRecord(slug, record.id)) ? toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, toList) : toastJson(locale, { status: "danger", title: "Gagal menghapus" });
    case "pulihkan":
      await restoreRecord(slug, record.id);

      return toastJson(locale, { status: "success", title: "Data berhasil dipulihkan" });
    default:
      return notFound();
  }
}

/** POST /admin/{slug}/massal/{action}: Filament's bulk deletions (no "in use" check, as in Laravel). */
export async function catalogBulkAction(request: Request, slug: CatalogSlug, action: string): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => authorizes(access, CATALOG_PERMISSIONS, "delete"));

  if (response) {
    return response;
  }

  const ids = await existingIds(slug, idsFrom((await formBody(request)).data));

  switch (action) {
    case "hapus":
      return bulkOutcomeJson(locale, "delete", await eachRecord(ids, (id) => softDeleteRecord(slug, id)));
    case "hapus-permanen":
      return bulkOutcomeJson(locale, "forceDelete", await eachRecord(ids, (id) => forceDeleteRecord(slug, id)));
    case "pulihkan":
      return bulkOutcomeJson(locale, "restore", await eachRecord(ids, (id) => restoreRecord(slug, id)));
    default:
      return notFound();
  }
}
