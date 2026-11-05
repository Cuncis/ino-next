import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { CUSTOMER_STATUSES, toLabel } from "@/lib/admin-options";
import { rupiah } from "@/lib/money";
import { authorizes } from "@/lib/permissions";
import { CUSTOMER_PERMISSIONS, listCustomers } from "@/server/admin/customers";
import { deletionActions, listLabels, paging, queryString, trashedFilter } from "@/server/admin/list-labels";

export const metadata: Metadata = { title: "Pelanggan - Inofarma" };

/** GET /admin/pelanggan: ListCustomers with CustomersTable: orders and spending per customer. */
export default async function Page({ searchParams }: PageProps<"/admin/pelanggan">) {
  const context = await adminContext((access) => authorizes(access, CUSTOMER_PERMISSIONS, "viewAny"));
  const { staff, access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const trashed = queryString(query.filter_trashed);
  const search = queryString(query.search);
  const { rows, total } = await listCustomers({ search, trashed, page, perPage }, staff);
  const canEdit = authorizes(access, CUSTOMER_PERMISSIONS, "update");
  const canDelete = authorizes(access, CUSTOMER_PERMISSIONS, "delete");
  const label = t("Pelanggan");

  const tableRows: ListRow[] = rows.map((customer) => ({
    id: String(customer.id),
    url: canEdit ? `/admin/pelanggan/${customer.id}/edit` : null,
    cells: {
      code: { kind: "text", text: customer.code },
      name: { kind: "text", text: customer.name },
      phone: customer.phone ? { kind: "text", text: customer.phone } : { kind: "empty" },
      city: customer.city ? { kind: "text", text: customer.city } : { kind: "empty" },
      orders_count: { kind: "text", text: String(customer.ordersCount), alignRight: true },
      spent_total: customer.spent === null ? { kind: "empty" } : { kind: "text", text: rupiah(customer.spent), alignRight: true },
      status: { kind: "badge", text: t(toLabel(CUSTOMER_STATUSES, customer.status) ?? customer.status), color: "primary" },
    },
    actions: [
      ...(canEdit ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/pelanggan/${customer.id}/edit` }] : []),
      ...(canDelete && customer.deletedAt === null ? deletionActions(locale, label, { delete: `/admin/pelanggan/${customer.id}/hapus` }, false) : []),
    ],
  }));

  const spec: ListSpec = {
    heading: t("plural:Pelanggan"),
    columns: [
      { name: "code", className: "code", label: t("Kode") },
      { name: "name", className: "name", label: t("Pelanggan") },
      { name: "phone", className: "phone", label: t("Telepon") },
      { name: "city", className: "city", label: t("Kota") },
      { name: "orders_count", className: "orders-count", label: t("Pesanan"), alignRight: true },
      { name: "spent_total", className: "spent-total", label: t("Total Belanja"), alignRight: true },
      { name: "status", className: "status", label: t("Status") },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [trashedFilter(locale, trashed)],
    bulkActions: canDelete
      ? deletionActions(locale, label, { delete: "/admin/pelanggan/massal/hapus", ...(trashed ? { forceDelete: "/admin/pelanggan/massal/hapus-permanen", restore: "/admin/pelanggan/massal/pulihkan" } : {}) }, true)
      : [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/pelanggan">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Pelanggan"), url: "/admin/pelanggan" }, { label: t("Daftar") }]}
            heading={t("plural:Pelanggan")}
            actions={
              authorizes(access, CUSTOMER_PERMISSIONS, "create") ? (
                <FiHeaderActions actions={[{ key: "create", label: t("Buat :label", { label }), icon: "", href: "/admin/pelanggan/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} />
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
