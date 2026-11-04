import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListAction, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { options, PRODUCT_STATUSES, toLabel } from "@/lib/admin-options";
import { rupiah } from "@/lib/money";
import { authorizes, can } from "@/lib/permissions";
import { deletionActions, listLabels, paging, queryString, trashedFilter } from "@/server/admin/list-labels";
import { categoryOptions, listProducts, MAX_QUANTITY_PER_ORDER, OVER_LIMIT_MESSAGE, PRODUCT_PERMISSIONS, productStatusColor, purchaseLimit, stockColor } from "@/server/admin/products";

export const metadata: Metadata = { title: "Produk - Inofarma" };

/** GET /admin/produk: ListProducts with ProductsTable. */
export default async function Page({ searchParams }: PageProps<"/admin/produk">) {
  const context = await adminContext((access) => authorizes(access, PRODUCT_PERMISSIONS, "viewAny"));
  const { staff, access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const filters = { categoryId: queryString(query.filter_category_id), status: queryString(query.filter_status), trashed: queryString(query.filter_trashed) };
  const search = queryString(query.search);
  const [{ rows, total }, categories] = await Promise.all([listProducts({ ...filters, search, page, perPage }, staff), categoryOptions()]);
  const canEdit = authorizes(access, PRODUCT_PERMISSIONS, "update");
  const canDelete = authorizes(access, PRODUCT_PERMISSIONS, "delete");
  const label = t("Produk");
  const limitMessage = t("Pembeli yang melewati batas ini melihat pesan: \":message\".", { message: t(OVER_LIMIT_MESSAGE) });

  const tableRows: ListRow[] = rows.map((product) => ({
    id: String(product.id),
    url: `/admin/produk/${product.id}`,
    cells: {
      sku: { kind: "text", text: product.sku },
      name: { kind: "text", text: product.name },
      "category.name": product.categoryName ? { kind: "text", text: product.categoryName } : { kind: "empty" },
      price: { kind: "text", text: rupiah(product.price), alignRight: true },
      stocks_sum_quantity: { kind: "badge", text: String(product.stock), color: stockColor(product.stock), alignRight: true },
      max_qty_per_order: { kind: "text", text: String(purchaseLimit(product)), alignRight: true, tooltip: t(OVER_LIMIT_MESSAGE) },
      sold_count: { kind: "text", text: String(product.soldCount), alignRight: true },
      status: { kind: "badge", text: t(toLabel(PRODUCT_STATUSES, product.status) ?? product.status), color: productStatusColor(product.status) },
    },
    actions: [
      { key: "view", label: t("Lihat"), icon: "c-eye", href: `/admin/produk/${product.id}` },
      ...(canEdit ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/produk/${product.id}/edit` }] : []),
      ...(canDelete && product.deletedAt === null ? deletionActions(locale, label, { delete: `/admin/produk/${product.id}/hapus` }, false) : []),
    ],
  }));

  // the bulk menu: the two "Ubah" actions, then Filament's deletions
  const bulkActions: ListAction[] = [
    ...(canEdit
      ? [
          {
            key: "setPurchaseLimit",
            label: t("Ubah Maks. Pembelian"),
            icon: "o-shopping-cart",
            endpoint: "/admin/produk/massal/maks-pembelian",
            form: {
              heading: t("Ubah Maks. Pembelian"),
              description: limitMessage,
              fields: [{ kind: "number" as const, name: "max_qty_per_order", label: t("Maks. pembelian per transaksi"), required: true, integer: true, min: 1, max: 65535, value: String(MAX_QUANTITY_PER_ORDER) }],
              submitLabel: t("Kirim"),
              cancelLabel: t("Batal"),
            },
          },
          {
            key: "setStatus",
            label: t("Ubah Status"),
            icon: "o-check-circle",
            endpoint: "/admin/produk/massal/status",
            form: {
              heading: t("Ubah Status"),
              fields: [
                {
                  kind: "select" as const,
                  name: "status",
                  label: t("Status"),
                  required: true,
                  placeholder: t("Pilih salah satu opsi"),
                  options: Object.entries(options(PRODUCT_STATUSES)).map(([value, text]) => ({ value, label: t(text) })),
                },
              ],
              submitLabel: t("Kirim"),
              cancelLabel: t("Batal"),
            },
          },
        ]
      : []),
    ...(canDelete
      ? deletionActions(
          locale,
          label,
          { delete: "/admin/produk/massal/hapus", ...(filters.trashed ? { forceDelete: "/admin/produk/massal/hapus-permanen", restore: "/admin/produk/massal/pulihkan" } : {}) },
          true,
        )
      : []),
  ];

  const spec: ListSpec = {
    heading: t("plural:Produk"),
    tableKey: "produk",
    columns: [
      { name: "sku", className: "sku", label: t("SKU") },
      { name: "name", className: "name", label: t("Nama") },
      { name: "category.name", className: "category.name", label: t("Kategori") },
      { name: "price", className: "price", label: t("Harga"), alignRight: true },
      { name: "stocks_sum_quantity", className: "stocks-sum-quantity", label: t("Stok"), alignRight: true },
      { name: "max_qty_per_order", className: "max-qty-per-order", label: t("Maks. Beli"), alignRight: true, toggleable: "shown" },
      { name: "sold_count", className: "sold-count", label: t("Terjual"), alignRight: true },
      { name: "status", className: "status", label: t("Status") },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [
      { name: "category_id", label: t("Kategori"), value: filters.categoryId, defaultValue: "", options: [{ value: "", label: t("Semua") }, ...categories] },
      {
        name: "status",
        label: t("Status"),
        value: filters.status,
        defaultValue: "",
        options: [{ value: "", label: t("Semua") }, ...Object.entries(options(PRODUCT_STATUSES)).map(([value, text]) => ({ value, label: t(text) }))],
      },
      trashedFilter(locale, filters.trashed),
    ],
    bulkActions,
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  const headerActions: ListAction[] = [
    { key: "importCsv", label: t("Import CSV"), icon: "o-arrow-up-tray", color: "gray", href: "/admin/produk/impor" },
    ...(authorizes(access, PRODUCT_PERMISSIONS, "create") ? [{ key: "create", label: t("Buat :label", { label }), icon: "", href: "/admin/produk/create" }] : []),
  ];

  return (
    <AdminShell context={context} pathname="/admin/produk">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Produk"), url: "/admin/produk" }, { label: t("Daftar") }]}
            heading={t("plural:Produk")}
            actions={can(access, "Produk:Lihat") ? <FiHeaderActions actions={headerActions} labels={{ close: t("Tutup"), cancel: t("Batal") }} /> : null}
          />
        }
      >
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
