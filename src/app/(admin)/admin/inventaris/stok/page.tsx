import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListAction, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { listLabels, paging, queryString } from "@/server/admin/list-labels";
import { bookableBranches, branchFilterOptions, listBranchStocks } from "@/server/admin/stock";
import { actionForm, adjustFields, receiveFields, selectLabels } from "@/server/admin/stock-forms";

export const metadata: Metadata = { title: "Stok - Inofarma" };

/** GET /admin/inventaris/stok: ListBranchStocks with BranchStocksTable, least stock first. */
export default async function Page({ searchParams }: PageProps<"/admin/inventaris/stok">) {
  const context = await adminContext((access) => can(access, "Inventaris:Lihat"));
  const { staff, access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const branchId = queryString(query.filter_branch_id);
  const search = queryString(query.search);
  const [{ rows, total }, branchFilter, bookable] = await Promise.all([listBranchStocks({ search, branchId, page, perPage }, staff), branchFilterOptions(), bookableBranches(staff)]);
  const canAdjust = can(access, "Inventaris:Sesuaikan Stok");
  const canReceive = can(access, "Inventaris:Terima Barang");

  const tableRows: ListRow[] = rows.map((stock) => ({
    id: String(stock.id),
    url: null,
    cells: {
      "branch.name": stock.branchName ? { kind: "text", text: stock.branchName } : { kind: "empty" },
      "product.sku": { kind: "text", text: stock.sku },
      "product.name": { kind: "text", text: stock.productName },
      quantity: { kind: "text", text: String(stock.quantity), alignRight: true },
      reserved_quantity: { kind: "text", text: String(stock.reservedQuantity), alignRight: true },
      available: { kind: "text", text: String(stock.available), alignRight: true },
    },
    actions: [
      ...(canAdjust
        ? [{ key: "sesuaikan", label: t("Sesuaikan"), icon: "o-adjustments-horizontal", color: "primary" as const, endpoint: `/admin/inventaris/stok/${stock.id}/sesuaikan`, form: actionForm(locale, t("Sesuaikan"), adjustFields(locale, stock.quantity)) }]
        : []),
      ...(canReceive
        ? [{ key: "terima", label: t("Terima Barang"), icon: "o-inbox-arrow-down", color: "primary" as const, endpoint: `/admin/inventaris/stok/${stock.id}/terima`, form: actionForm(locale, t("Terima Barang"), receiveFields(locale)) }]
        : []),
    ],
  }));

  const spec: ListSpec = {
    heading: t("plural:Stok"),
    columns: [
      { name: "branch.name", className: "branch.name", label: t("Cabang") },
      { name: "product.sku", className: "product.sku", label: t("SKU") },
      { name: "product.name", className: "product.name", label: t("Produk") },
      { name: "quantity", className: "quantity", label: t("Jumlah"), alignRight: true },
      { name: "reserved_quantity", className: "reserved-quantity", label: t("Dipesan"), alignRight: true },
      { name: "available", className: "available", label: t("Tersedia"), alignRight: true },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [{ name: "branch_id", label: t("Cabang"), value: branchId, defaultValue: "", options: [{ value: "", label: t("Semua") }, ...branchFilter] }],
    bulkActions: [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  const headerActions: ListAction[] = [
    ...(canReceive
      ? [
          {
            key: "stokAwal",
            label: t("Tambah Stok Awal"),
            icon: "o-plus",
            endpoint: "/admin/inventaris/stok/awal",
            form: actionForm(
              locale,
              t("Tambah Stok Awal"),
              [
                { kind: "searchable" as const, name: "branchId", label: t("Cabang"), required: true, options: bookable, value: staff.branchId === null ? "" : String(staff.branchId), labels: selectLabels(locale) },
                { kind: "searchable" as const, name: "productId", label: t("Produk"), required: true, options: [], searchUrl: "/form/admin/inventaris/produk-cari", helper: t("Produk berstatus Arsip tidak muncul."), labels: selectLabels(locale) },
                ...receiveFields(locale),
              ],
              { description: t("Pilih cabang dan produk, lalu isi batch pertama yang diterima. Cocok untuk produk baru yang belum punya stok di cabang itu."), submitLabel: t("Simpan Stok") },
            ),
          },
        ]
      : []),
    ...(canAdjust
      ? [
          {
            key: "importStock",
            label: t("Import Stok"),
            icon: "o-arrow-up-tray",
            color: "gray" as const,
            endpoint: "/admin/inventaris/stok/impor",
            form: actionForm(
              locale,
              t("Import Stok"),
              [{ kind: "file" as const, name: "file", label: t("File CSV"), required: true, accept: ["text/csv", "text/plain", "application/vnd.ms-excel"], maxSizeKb: 10240, helper: t("Satu baris per produk, cabang, dan batch. Unduh templatenya lewat tombol Export & Template.") }],
              { description: t("Stok yang ada diganti sesuai file: batch yang tidak ada di file menjadi 0. Produk dan cabang yang tidak ada di file tidak berubah."), submitLabel: t("Import") },
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
        { key: "exportStock", label: t("Export Stok"), icon: "", href: "/form/admin/inventaris/stok/ekspor" },
        { key: "downloadStockTemplate", label: t("Unduh Template Stok"), icon: "", href: "/form/admin/inventaris/stok/template" },
      ],
    },
  ];

  return (
    <AdminShell context={context} pathname="/admin/inventaris/stok">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Stok"), url: "/admin/inventaris/stok" }, { label: t("Daftar") }]}
            heading={t("plural:Stok")}
            actions={<FiHeaderActions actions={headerActions} labels={{ close: t("Tutup"), cancel: t("Batal") }} />}
          />
        }
      >
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
