import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { options, STOCK_TRANSFER_STATUSES, toLabel } from "@/lib/admin-options";
import { authorizes } from "@/lib/permissions";
import { listTransfers, TRANSFER_PERMISSIONS, transferStatusColor } from "@/server/admin/finance-transfers";
import { adminDate, listLabels, paging, queryString } from "@/server/admin/list-labels";

export const metadata: Metadata = { title: "Transfer - Inofarma" };

/** GET /admin/inventaris/transfer: ListStockTransfers, newest first. */
export default async function Page({ searchParams }: PageProps<"/admin/inventaris/transfer">) {
  const context = await adminContext((access) => authorizes(access, TRANSFER_PERMISSIONS, "viewAny"));
  const { staff, access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const status = queryString(query.filter_status);
  const search = queryString(query.search);
  const { rows, total } = await listTransfers({ search, status, page, perPage }, staff);

  const tableRows: ListRow[] = rows.map((transfer) => ({
    id: String(transfer.id),
    url: `/admin/inventaris/transfer/${transfer.id}`,
    cells: {
      code: { kind: "text", text: transfer.code },
      "fromBranch.name": transfer.fromName ? { kind: "text", text: transfer.fromName } : { kind: "empty" },
      "toBranch.name": transfer.toName ? { kind: "text", text: transfer.toName } : { kind: "empty" },
      "product.name": transfer.productName ? { kind: "text", text: transfer.productName } : { kind: "empty" },
      quantity: { kind: "text", text: String(transfer.quantity), alignRight: true },
      "requestedBy.name": transfer.requestedByName ? { kind: "text", text: transfer.requestedByName } : { kind: "placeholder", text: "—" },
      status: { kind: "badge", text: t(toLabel(STOCK_TRANSFER_STATUSES, transfer.status) ?? transfer.status), color: transferStatusColor(transfer.status) },
      created_at: { kind: "text", text: adminDate(transfer.createdAt, locale) ?? "" },
    },
    actions: [{ key: "view", label: t("Lihat"), icon: "c-eye", href: `/admin/inventaris/transfer/${transfer.id}` }],
  }));

  const spec: ListSpec = {
    heading: t("plural:Transfer"),
    columns: [
      { name: "code", className: "code", label: t("Kode") },
      { name: "fromBranch.name", className: "from-branch.name", label: t("Dari") },
      { name: "toBranch.name", className: "to-branch.name", label: t("Ke") },
      { name: "product.name", className: "product.name", label: t("Produk") },
      { name: "quantity", className: "quantity", label: t("Jumlah"), alignRight: true },
      { name: "requestedBy.name", className: "requested-by.name", label: t("Diminta Oleh") },
      { name: "status", className: "status", label: t("Status") },
      { name: "created_at", className: "created-at", label: t("Tanggal") },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [
      {
        name: "status",
        label: t("Status"),
        value: status,
        defaultValue: "",
        options: [{ value: "", label: t("Semua") }, ...Object.entries(options(STOCK_TRANSFER_STATUSES)).map(([value, text]) => ({ value, label: t(text) }))],
      },
    ],
    bulkActions: [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/inventaris/transfer">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Transfer"), url: "/admin/inventaris/transfer" }, { label: t("Daftar") }]}
            heading={t("plural:Transfer")}
            actions={
              authorizes(access, TRANSFER_PERMISSIONS, "create") ? (
                <FiHeaderActions actions={[{ key: "create", label: t("Minta Transfer"), icon: "", href: "/admin/inventaris/transfer/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} />
              ) : null
            }
          />
        }
      >
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
