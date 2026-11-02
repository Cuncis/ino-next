import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { FULFILMENT_STAGES, fulfilmentStageFor, PAYMENT_STATUSES, options, toLabel } from "@/lib/admin-options";
import { rupiah } from "@/lib/money";
import { isSuperAdmin } from "@/lib/permissions";
import { adminDate, deletionActions, listLabels, paging, queryString, trashedFilter } from "@/server/admin/list-labels";
import { authorizes, listOrders, ORDER_PERMISSIONS, orderStatusColor, paymentStatusColor } from "@/server/admin/orders";

export const metadata: Metadata = { title: "Pesanan - Inofarma" };

/** GET /admin/pesanan: ListOrders with OrdersTable. */
export default async function Page({ searchParams }: PageProps<"/admin/pesanan">) {
  const context = await adminContext((access) => authorizes(access, ORDER_PERMISSIONS, "viewAny"));
  const { staff, access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const filters = {
    fulfilmentStage: queryString(query.filter_fulfilment_stage),
    paymentStatus: queryString(query.filter_payment_status),
    trashed: queryString(query.filter_trashed),
  };
  const search = queryString(query.search);
  const { rows, total } = await listOrders({ ...filters, search, page, perPage }, staff);
  const canEdit = authorizes(access, ORDER_PERMISSIONS, "update");
  const canDelete = isSuperAdmin(access);
  const label = t("Pesanan");

  const tableRows: ListRow[] = rows.map((order) => ({
    id: String(order.id),
    url: `/admin/pesanan/${order.id}`,
    cells: {
      number: { kind: "text", text: order.number },
      "customer.name": order.customerName ? { kind: "text", text: order.customerName } : { kind: "empty" },
      created_at: { kind: "text", text: adminDate(order.createdAt, locale) ?? "" },
      item_count: { kind: "text", text: String(order.itemCount), alignRight: true },
      payment_method: order.paymentMethod ? { kind: "text", text: t(order.paymentMethod) } : { kind: "empty" },
      grand_total: { kind: "text", text: rupiah(order.grandTotal), weight: "semibold", alignRight: true },
      payment_status: { kind: "badge", text: t(toLabel(PAYMENT_STATUSES, order.paymentStatus) ?? order.paymentStatus), color: paymentStatusColor(order.paymentStatus) },
      status: { kind: "badge", text: t(fulfilmentStageFor(order.status) ?? ""), color: orderStatusColor(order.status) },
    },
    actions: [
      { key: "view", label: t("Lihat"), icon: "c-eye", href: `/admin/pesanan/${order.id}` },
      ...(canEdit ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/pesanan/${order.id}/edit` }] : []),
      // a deleted order can't be deleted again
      ...(canDelete && order.deletedAt === null ? deletionActions(locale, label, { delete: `/admin/pesanan/${order.id}/hapus` }, false) : []),
    ],
  }));

  const spec: ListSpec = {
    heading: t("plural:Pesanan"),
    columns: [
      { name: "number", className: "number", label: t("No. Pesanan") },
      { name: "customer.name", className: "customer.name", label: t("Pelanggan") },
      { name: "created_at", className: "created-at", label: t("Tanggal") },
      { name: "item_count", className: "item-count", label: t("Item"), alignRight: true },
      { name: "payment_method", className: "payment-method", label: t("Pembayaran") },
      { name: "grand_total", className: "grand-total", label: t("Total"), alignRight: true },
      { name: "payment_status", className: "payment-status", label: t("Status Bayar") },
      { name: "status", className: "status", label: t("Status Pemenuhan") },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [
      {
        name: "fulfilment_stage",
        label: t("Status Pemenuhan"),
        value: filters.fulfilmentStage,
        defaultValue: "",
        options: [{ value: "", label: t("Semua") }, ...Object.keys(FULFILMENT_STAGES).map((stage) => ({ value: stage, label: t(stage) }))],
      },
      {
        name: "payment_status",
        label: t("Status Bayar"),
        value: filters.paymentStatus,
        defaultValue: "",
        options: [{ value: "", label: t("Semua") }, ...Object.entries(options(PAYMENT_STATUSES)).map(([value, text]) => ({ value, label: t(text) }))],
      },
      trashedFilter(locale, filters.trashed),
    ],
    // force delete and restore only make sense once deleted orders are in view
    bulkActions: canDelete
      ? deletionActions(
          locale,
          label,
          {
            delete: "/admin/pesanan/massal/hapus",
            ...(filters.trashed ? { forceDelete: "/admin/pesanan/massal/hapus-permanen", restore: "/admin/pesanan/massal/pulihkan" } : {}),
          },
          true,
        )
      : [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/pesanan">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Pesanan"), url: "/admin/pesanan" }, { label: t("Daftar") }]}
            heading={t("plural:Pesanan")}
            actions={authorizes(access, ORDER_PERMISSIONS, "create") ? <FiHeaderActions actions={[{ key: "create", label: t("Buat Pesanan"), icon: "", href: "/admin/pesanan/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} /> : null}
          />
        }
      >
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
