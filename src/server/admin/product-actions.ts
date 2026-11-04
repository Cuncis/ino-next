import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { options, PRODUCT_STATUSES } from "@/lib/admin-options";
import { authorizes, can } from "@/lib/permissions";
import { validate, validationErrorResponse } from "@/lib/validation";
import { csvDownload, catalogSample, exportCatalog, exportStamp } from "@/server/catalog/catalog-export";
import { importCatalog, type ImportSummary } from "@/server/catalog/catalog-import";
import { CsvError, groupFailures } from "@/server/catalog/csv";
import { importShopify } from "@/server/catalog/shopify-import";
import { appUrl } from "@/lib/app-url";
import { adminActionContext, bulkOutcomeJson, eachRecord, idsFrom, toastJson } from "./action-response";
import { validateProductForm } from "./catalog-forms";
import { fileBuffers, formBody } from "./form-body";
import {
  createProduct,
  deletePhoto,
  deleteProduct,
  existingProductIds,
  findAdminProduct,
  findPhoto,
  forceDeleteProduct,
  makePrimaryPhoto,
  PRODUCT_PERMISSIONS,
  reorderPhotos,
  restoreProduct,
  setPurchaseLimit,
  setStatus,
  softDeleteProduct,
  updateProduct,
  uploadPhotos,
} from "./products";

/**
 * The Produk resource's actions behind /admin/produk/… (the proxy sends each POST to
 * /form/admin/produk/…): the form, the deletions, the bulk actions, the photos, and the
 * CSV import and export.
 */
const notFound = () => Response.json({ message: "Not Found" }, { status: 404 });

/** POST /admin/produk/buat: CreateProduct, then its photos; Filament opens the new product's page. */
export async function createProductAction(request: Request): Promise<Response> {
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, PRODUCT_PERMISSIONS, "create"));

  if (response) {
    return response;
  }

  const { data, files } = await formBody(request);
  const photos = files.photos ?? [];
  const result = await validateProductForm(data, locale);

  if (!result.data) {
    return validationErrorResponse(result.errors);
  }

  const { product, failedPhotos } = await createProduct(result.data, await fileBuffers(photos.slice(0, 8)), staff);
  const t = (text: string, replace?: Record<string, string | number>) => translate(locale, text, replace);
  // afterCreate()'s warning goes out before Filament's own "created"
  const toasts = [
    ...(failedPhotos > 0
      ? [{ status: "warning", title: t(":count foto gagal diproses.", { count: failedPhotos }), body: t("Produk sudah disimpan. Tambahkan fotonya lagi lewat tab Gambar."), persistent: true }]
      : []),
    { status: "success", title: t("Data berhasil dibuat") },
  ];

  return Response.json({ toasts, redirect: data.another ? "/admin/produk/create" : `/admin/produk/${product.id}` });
}

/** POST /admin/produk/{id}/simpan: EditProduct; the page stays. */
export async function updateProductAction(request: Request, id: string): Promise<Response> {
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, PRODUCT_PERMISSIONS, "update"));

  if (response) {
    return response;
  }

  const product = await findAdminProduct(Number(id));

  if (!product) {
    return notFound();
  }

  const result = await validateProductForm((await formBody(request)).data, locale);

  if (!result.data) {
    return validationErrorResponse(result.errors);
  }

  await updateProduct(product, result.data, staff);

  return toastJson(locale, { status: "success", title: "Data berhasil disimpan" });
}

/** POST /admin/produk/{id}/{hapus|hapus-permanen|pulihkan}; from the edit page a removal goes back to the list. */
export async function productOperationAction(request: Request, id: string, operation: string): Promise<Response> {
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, PRODUCT_PERMISSIONS, "delete"));

  if (response) {
    return response;
  }

  const product = await findAdminProduct(Number(id));

  if (!product) {
    return notFound();
  }

  const toList = (await formBody(request)).data.back === "list" ? { redirect: "/admin/produk" } : {};

  switch (operation) {
    case "hapus":
      await deleteProduct(product, staff);

      return toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, toList);
    case "hapus-permanen":
      return (await forceDeleteProduct(product.id)) ? toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, toList) : toastJson(locale, { status: "danger", title: "Gagal menghapus" });
    case "pulihkan":
      await restoreProduct(product.id);

      return toastJson(locale, { status: "success", title: "Data berhasil dipulihkan" });
    default:
      return notFound();
  }
}

/** POST /admin/produk/massal/{action}: the list's bulk actions on the selected products. */
export async function productBulkAction(request: Request, action: string): Promise<Response> {
  const changes = action === "maks-pembelian" || action === "status";
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, PRODUCT_PERMISSIONS, changes ? "update" : "delete"));

  if (response) {
    return response;
  }

  const { data } = await formBody(request);
  const ids = await existingProductIds(idsFrom(data));
  const t = (text: string) => translate(locale, text);
  const updated = () => toastJson(locale, { status: "success", title: ":count produk diperbarui.", replace: { count: ids.length } });

  switch (action) {
    case "maks-pembelian": {
      const result = validate<{ max_qty_per_order: string }>(
        data,
        { max_qty_per_order: ["required", "numeric", "integer", "min:1", "max:65535"] },
        {},
        { max_qty_per_order: lcfirst(t("Maks. pembelian per transaksi")) },
        locale,
      );

      if (!result.data) {
        return validationErrorResponse(result.errors);
      }

      await setPurchaseLimit(ids, Number(result.data.max_qty_per_order));

      return updated();
    }
    case "status": {
      const result = validate<{ status: string }>(data, { status: ["required", `in:${Object.keys(options(PRODUCT_STATUSES)).join(",")}`] }, {}, { status: lcfirst(t("Status")) }, locale);

      if (!result.data) {
        return validationErrorResponse(result.errors);
      }

      await setStatus(ids, result.data.status, staff);

      return updated();
    }
    case "hapus":
      return bulkOutcomeJson(locale, "delete", await eachRecord(ids, softDeleteProduct));
    case "hapus-permanen":
      return bulkOutcomeJson(locale, "forceDelete", await eachRecord(ids, forceDeleteProduct));
    case "pulihkan":
      return bulkOutcomeJson(locale, "restore", await eachRecord(ids, restoreProduct));
    default:
      return notFound();
  }
}

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/* ---------------- photos ---------------- */

/** POST /admin/produk/{id}/gambar/unggah: Upload Gambar (no notification, as in Laravel). */
export async function uploadPhotosAction(request: Request, id: string): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => authorizes(access, PRODUCT_PERMISSIONS, "update"));

  if (response) {
    return response;
  }

  const product = await findAdminProduct(Number(id));

  if (!product) {
    return notFound();
  }

  const images = (await formBody(request)).files.images ?? [];
  const attribute = lcfirst(translate(locale, "Gambar"));

  if (!images.length) {
    return validationErrorResponse({ images: [validate({}, { images: ["required"] }, {}, { images: attribute }, locale).errors!.images[0]] });
  }

  if (images.some((file) => !file.type.startsWith("image/"))) {
    return validationErrorResponse({ images: [locale === "en" ? `The ${attribute} field must be an image.` : `Kolom ${attribute} harus berupa gambar.`] });
  }

  await uploadPhotos(product.id, await fileBuffers(images));

  return Response.json({});
}

/** POST /admin/produk/{id}/gambar/urutan: the photos dragged into a new order. */
export async function reorderPhotosAction(request: Request, id: string): Promise<Response> {
  const { response } = await adminActionContext(request, (access) => authorizes(access, PRODUCT_PERMISSIONS, "update"));

  if (response) {
    return response;
  }

  const { data } = await formBody(request);
  const order = Array.isArray(data.order) ? data.order.map(Number).filter(Number.isInteger) : [];

  await reorderPhotos(Number(id), order);

  return Response.json({});
}

/** POST /admin/produk/{id}/gambar/{image}/{utama|hapus}. */
export async function photoOperationAction(request: Request, id: string, imageId: string, operation: string): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => authorizes(access, PRODUCT_PERMISSIONS, "update"));

  if (response) {
    return response;
  }

  const image = await findPhoto(Number(id), Number(imageId));

  if (!image) {
    return notFound();
  }

  switch (operation) {
    case "utama":
      await makePrimaryPhoto(image.productId, image.id);

      return Response.json({});
    case "hapus":
      await deletePhoto(image.productId, image);

      return toastJson(locale, { status: "success", title: "Data berhasil dihapus" });
    default:
      return notFound();
  }
}

/* ---------------- CSV ---------------- */

function summaryJson(summary: ImportSummary) {
  return {
    kind: summary.kind,
    created: summary.created,
    updated: summary.updated,
    warnedInactive: summary.warnedInactive,
    groups: summary.groups,
    zeroed: summary.zeroed,
    failedCount: summary.failed.length,
    imagesFailed: summary.imagesFailed,
    failures: groupFailures(summary.failed),
  };
}

async function csvUpload(request: Request, locale: AdminLocale): Promise<{ file: File; response?: never } | { response: Response; file?: never }> {
  const [file] = (await formBody(request)).files.file ?? [];

  if (!file) {
    const attribute = lcfirst(translate(locale, "File CSV"));

    return { response: validationErrorResponse({ file: [validate({}, { file: ["required"] }, {}, { file: attribute }, locale).errors!.file[0]] }) };
  }

  return { file };
}

/** The file as PHP reads it: UTF-8 with any byte-order mark kept (File.text() drops it). */
async function rawText(file: File): Promise<string> {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await file.arrayBuffer());
}

/** POST /admin/produk/impor/katalog: Import Produk & Stok. A file it can't read at all is a danger toast. */
export async function importCatalogAction(request: Request): Promise<Response> {
  const { staff, access, locale, response } = await adminActionContext(request, (rights) => can(rights, "Produk:Ubah") || can(rights, "Inventaris:Sesuaikan Stok"));

  if (response) {
    return response;
  }

  const upload = await csvUpload(request, locale);

  if (upload.response) {
    return upload.response;
  }

  try {
    const summary = await importCatalog({
      content: await rawText(upload.file),
      fileName: upload.file.name,
      restrictToBranchId: staff.branchId,
      userId: staff.id,
      canEditProducts: can(access, "Produk:Ubah"),
      canAdjustStock: can(access, "Inventaris:Sesuaikan Stok"),
      locale,
    });

    return toastJson(
      locale,
      { status: "success", title: "Import selesai: :created produk baru, :updated diperbarui, :groups stok produk per cabang diperbarui.", replace: { created: summary.created, updated: summary.updated, groups: summary.groups } },
      { result: summaryJson(summary) },
    );
  } catch (error) {
    if (error instanceof CsvError) {
      return toastJson(locale, { status: "danger", title: "Import gagal", body: error.message });
    }

    throw error;
  }
}

/** POST /admin/produk/impor/shopify: Import Format Shopify (product data only). */
export async function importShopifyAction(request: Request): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => can(access, "Produk:Lihat"));

  if (response) {
    return response;
  }

  const upload = await csvUpload(request, locale);

  if (upload.response) {
    return upload.response;
  }

  const summary = await importShopify(await rawText(upload.file));

  return toastJson(
    locale,
    { status: "success", title: "Import selesai: :created produk baru, :updated diperbarui.", replace: { created: summary.created, updated: summary.updated } },
    { result: summaryJson(summary) },
  );
}

/** GET /form/admin/produk/impor/ekspor: Export Produk & Stok, with stock only for those who may see it. */
export async function exportCatalogAction(request: Request): Promise<Response> {
  const { staff, access, response } = await adminActionContext(request, (rights) => can(rights, "Produk:Lihat") || can(rights, "Inventaris:Lihat"));

  if (response) {
    return response;
  }

  const content = await exportCatalog({ includeStock: can(access, "Inventaris:Lihat"), staff, origin: appUrl("").replace(/\/$/, "") });

  return csvDownload(content, `produk-stok-${exportStamp()}.csv`);
}

/** GET /form/admin/produk/impor/template: the sample file. */
export async function catalogTemplateAction(request: Request): Promise<Response> {
  const { response } = await adminActionContext(request, (access) => can(access, "Produk:Lihat"));

  return response ?? csvDownload(catalogSample(), "template-produk-stok.csv");
}
