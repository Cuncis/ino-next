import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { rupiah } from "@/lib/money";
import { can } from "@/lib/permissions";
import { invoiceStatus, invoiceStatusColor, listInvoices } from "@/server/admin/finance-transfers";
import { adminDate, listLabels, paging, queryString } from "@/server/admin/list-labels";

export const metadata: Metadata = { title: "Faktur - Inofarma" };

/** GET /admin/faktur: ListInvoices, every order read as an invoice, newest first. */
export default async function Page({ searchParams }: PageProps<"/admin/faktur">) {
  const context = await adminContext((access) => can(access, "Pesanan:Lihat"));
  const { staff, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const search = queryString(query.search);
  const { rows, total } = await listInvoices({ search, page, perPage }, staff);

  const tableRows: ListRow[] = rows.map((order) => {
    const status = invoiceStatus(order);

    return {
      id: String(order.id),
      url: `/admin/faktur/${order.id}`,
      cells: {
        number: { kind: "text", text: order.number },
        "customer.name": order.customerName ? { kind: "text", text: order.customerName } : { kind: "empty" },
        created_at: { kind: "text", text: adminDate(order.createdAt, locale) ?? "" },
        expires_at: order.expiresAt ? { kind: "text", text: adminDate(order.expiresAt, locale) ?? "" } : { kind: "placeholder", text: "—" },
        grand_total: { kind: "text", text: rupiah(order.grandTotal), alignRight: true },
        status: { kind: "badge", text: t(status), color: invoiceStatusColor(status) },
      },
      actions: [{ key: "view", label: t("Lihat"), icon: "c-eye", href: `/admin/faktur/${order.id}` }],
    };
  });

  const spec: ListSpec = {
    heading: t("plural:Faktur"),
    columns: [
      { name: "number", className: "number", label: t("Nomor") },
      { name: "customer.name", className: "customer.name", label: t("Pelanggan") },
      { name: "created_at", className: "created-at", label: t("Diterbitkan") },
      { name: "expires_at", className: "expires-at", label: t("Jatuh Tempo") },
      { name: "grand_total", className: "grand-total", label: t("Total"), alignRight: true },
      { name: "status", className: "status", label: t("Status") },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [],
    bulkActions: [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/faktur">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Faktur"), url: "/admin/faktur" }, { label: t("Daftar") }]} heading={t("plural:Faktur")} />}>
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
