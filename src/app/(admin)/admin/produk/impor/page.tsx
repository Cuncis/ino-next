import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import type { ListAction } from "@/components/admin/filament/ListTable";
import { can } from "@/lib/permissions";
import { MAX_QUANTITY_PER_ORDER, OVER_LIMIT_MESSAGE } from "@/server/admin/products";
import { ProductImportView } from "@/views/admin/ProductImportView";

export const metadata: Metadata = { title: "Import & Export CSV - Inofarma" };

const CSV_TYPES = ["text/csv", "text/plain", "application/vnd.ms-excel"];

/** GET /admin/produk/impor: ProductImport, reached from the Produk list's "Import CSV". */
export default async function Page() {
  const context = await adminContext((access) => can(access, "Produk:Lihat"));
  const { access, t } = context;
  const csvForm = (heading: string, description?: string) => ({
    heading,
    description,
    fields: [{ kind: "file" as const, name: "file", label: t("File CSV"), required: true, accept: CSV_TYPES, maxSizeKb: 10240 }],
    submitLabel: t("Kirim"),
    cancelLabel: t("Batal"),
  });
  const actions: ListAction[] = [
    ...(can(access, "Produk:Ubah") || can(access, "Inventaris:Sesuaikan Stok")
      ? [
          {
            key: "importCatalog",
            label: t("Import Produk & Stok"),
            icon: "o-arrow-up-tray",
            endpoint: "/admin/produk/impor/katalog",
            form: csvForm(
              t("Import Produk & Stok"),
              t("Satu file untuk produk dan stok. Stok per produk dan cabang diganti sesuai file: batch yang tidak ada di file menjadi 0. Produk dan cabang yang tidak ada di file tidak berubah."),
            ),
          },
        ]
      : []),
    {
      key: "exports",
      label: t("Export & Template"),
      icon: "o-arrow-down-tray",
      color: "gray",
      items: [
        ...(can(access, "Produk:Lihat") || can(access, "Inventaris:Lihat") ? [{ key: "exportCatalog", label: t("Export Produk & Stok"), icon: "", href: "/form/admin/produk/impor/ekspor" }] : []),
        { key: "downloadCatalogTemplate", label: t("Unduh Template"), icon: "", href: "/form/admin/produk/impor/template" },
      ],
    },
    { key: "import", label: t("Import Format Shopify"), icon: "o-arrow-up-tray", color: "gray", endpoint: "/admin/produk/impor/shopify", form: csvForm(t("Import Format Shopify")) },
    { key: "backToProducts", label: t("Kembali ke Produk"), icon: "", color: "gray", href: "/admin/produk" },
  ];

  return (
    // a page outside the navigation: no sidebar item is current, so Produk stays folded
    <AdminShell context={context} pathname="/admin/pages/produk-impor">
      <ProductImportView
        actions={actions}
        intro={
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>{t("Unduh template lewat tombol Export & Template, isi, lalu import. Produk dan stok ada dalam satu file: satu baris per produk, cabang, dan batch.")}</p>
            <p>{t("SKU yang sudah ada diperbarui, bukan diduplikasi. Untuk produk yang sudah ada, cukup isi sku dan kolom stok. Stok per produk dan cabang diganti sesuai file.")}</p>
            <p>
              {withCode(
                t('Kolom :column: maksimum pembelian per transaksi. Kosong berarti :default. Pembeli yang melewatinya melihat pesan ":message".', {
                  default: String(MAX_QUANTITY_PER_ORDER),
                  message: t(OVER_LIMIT_MESSAGE),
                }),
                { column: <code>max_qty_per_order</code> },
              )}
            </p>
            <p>
              {withCode(t("Kolom :column: :values.", {}), {
                column: <code>status</code>,
                values: (
                  <>
                    <code>aktif</code>, <code>nonaktif</code>, <code>arsip</code>
                  </>
                ),
              })}
            </p>
          </div>
        }
        labels={{
          heading: t("Import & Export CSV"),
          close: t("Tutup"),
          cancel: t("Batal"),
          created: t("Produk Baru"),
          updated: t("Diperbarui"),
          warnedInactive: t("Nonaktif (Perlu Peringatan)"),
          groups: t("Produk per Cabang Diperbarui"),
          zeroed: t("Batch Lama Dinolkan"),
          failed: t("Baris Gagal"),
          failedRows: t("Baris yang gagal di-import"),
          rowCount: t(":count baris"),
          rows: t("Baris :rows"),
          andMore: t("dan :count lainnya"),
          imagesFailed: t("Gambar yang gagal di-download"),
        }}
      />
    </AdminShell>
  );
}

/** A translated sentence with `:placeholders` replaced by markup (the Blade view's `{!! !!}`). */
function withCode(text: string, parts: Record<string, ReactNode>) {
  return text.split(/(:[a-z]+)/).map((piece, index) => <Fragment key={index}>{piece.startsWith(":") && parts[piece.slice(1)] !== undefined ? parts[piece.slice(1)] : piece}</Fragment>);
}
