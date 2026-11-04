import type { ListSpec } from "@/components/admin/filament/ListTable";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { authorizes, type StaffAccess } from "@/lib/permissions";
import { displayUrl } from "@/lib/storage";
import type { productImages } from "@/db";
import { deletionActions, listLabels } from "./list-labels";
import { PRODUCT_PERMISSIONS } from "./products";

/**
 * ImagesRelationManager's table ("Gambar"): the photos by position, the main one ticked.
 * Changing them needs Produk:Ubah. On the product's own page the table is read-only as
 * Filament makes it there: no Hapus, but Upload Gambar, Jadikan Utama and reordering stay.
 */
export function productImagesSpec(locale: AdminLocale, access: StaffAccess, productId: number, images: (typeof productImages.$inferSelect)[], page: "view" | "edit"): ListSpec {
  const t = (text: string, replace?: Record<string, string>) => translate(locale, text, replace);
  const canChange = authorizes(access, PRODUCT_PERMISSIONS, "update");

  return {
    heading: t("Gambar"),
    header: {
      heading: t("Gambar"),
      actions: canChange
        ? [
            {
              key: "upload",
              label: t("Upload Gambar"),
              icon: "",
              endpoint: `/admin/produk/${productId}/gambar/unggah`,
              form: {
                heading: t("Upload Gambar"),
                fields: [{ kind: "file", name: "images", label: t("Gambar"), required: true, multiple: true, accept: ["image/*"], maxSizeKb: 5120 }],
                submitLabel: t("Kirim"),
                cancelLabel: t("Batal"),
              },
            },
          ]
        : [],
    },
    reorder: canChange
      ? {
          endpoint: `/admin/produk/${productId}/gambar/urutan`,
          labels: {
            enable: t("Urutkan ulang data"),
            disable: t("Selesaikan pengurutan ulang data"),
            // Filament's own English: it has no Indonesian for these
            indicator: "Drag and drop the records into order.",
            position: ":label, position :position of :count.",
            moveUp: "Move :label up",
            moveDown: "Move :label down",
          },
        }
      : undefined,
    localPaging: true,
    columns: [
      { name: "path", className: "path", label: t("Gambar") },
      { name: "is_primary", className: "is-primary", label: t("Utama") },
      { name: "position", className: "position", label: t("Urutan") },
    ],
    rows: images.map((image) => ({
      id: String(image.id),
      url: null,
      title: image.path,
      cells: {
        path: { kind: "image", src: displayUrl(image.path) },
        is_primary: { kind: "icon", value: image.isPrimary, label: image.isPrimary ? "Yes" : "No" },
        position: { kind: "text", text: String(image.position) },
      },
      actions: [
        ...(!image.isPrimary && canChange ? [{ key: "makePrimary", label: t("Jadikan Utama"), icon: "", color: "primary" as const, endpoint: `/admin/produk/${productId}/gambar/${image.id}/utama` }] : []),
        ...(page === "edit" && canChange ? deletionActions(locale, "product image", { delete: `/admin/produk/${productId}/gambar/${image.id}/hapus` }, false) : []),
      ],
    })),
    total: images.length,
    page: 1,
    perPage: 10,
    search: null,
    filters: [],
    bulkActions: [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };
}
