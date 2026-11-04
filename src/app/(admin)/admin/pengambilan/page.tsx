import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiListTable, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { adminDate, listLabels, paging, queryString } from "@/server/admin/list-labels";
import { listPickups } from "@/server/admin/orders";

export const metadata: Metadata = { title: "Pengambilan - Inofarma" };

/**
 * GET /admin/pengambilan: the counter's queue (ListPickups). Scanning a pickup slip's QR
 * opens it with `?order=&kode=`: the queue filtered to that order, and the code filled in
 * when "Serahkan" is pressed.
 */
export default async function Page({ searchParams }: PageProps<"/admin/pengambilan">) {
  const context = await adminContext((access) => can(access, "Pesanan:Proses"));
  const { staff, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const search = queryString(query.search) || queryString(query.order);
  const prefill = queryString(query.kode);
  const { rows, total } = await listPickups({ search, page, perPage }, staff);

  const spec: ListSpec = {
    heading: t("plural:Pengambilan"),
    columns: [
      { name: "number", className: "number", label: t("No. Pesanan") },
      { name: "customer.name", className: "customer.name", label: t("Pelanggan") },
      { name: "branch.name", className: "branch.name", label: t("Cabang") },
      { name: "ready_at", className: "ready-at", label: t("Siap Sejak") },
      { name: "pickup_code_expires_at", className: "pickup-code-expires-at", label: t("Berlaku Sampai") },
    ],
    rows: rows.map((order) => ({
      id: String(order.id),
      url: null,
      cells: {
        number: { kind: "text", text: order.number },
        "customer.name": order.customerName ? { kind: "text", text: order.customerName } : { kind: "empty" },
        "branch.name": order.branchName ? { kind: "text", text: order.branchName } : { kind: "empty" },
        ready_at: { kind: "text", text: adminDate(order.readyAt, locale, true) ?? "" },
        pickup_code_expires_at: { kind: "text", text: adminDate(order.pickupCodeExpiresAt, locale, true) ?? "" },
      },
      actions: [
        {
          key: "serahkan",
          label: t("Serahkan"),
          icon: "o-check-badge",
          color: "primary",
          endpoint: `/admin/pengambilan/${order.id}/serahkan`,
          form: { heading: t("Serahkan"), fields: [{ kind: "text", name: "code", label: t("Kode Ambil"), required: true, maxLength: 10, value: prefill }], submitLabel: t("Kirim"), cancelLabel: t("Batal") },
        },
      ],
    })),
    total,
    page,
    perPage,
    search,
    filters: [],
    bulkActions: [],
    emptyHeading: t("Tidak ada pesanan yang siap diambil."),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/pengambilan">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Pengambilan"), url: "/admin/pengambilan" }, { label: t("Daftar") }]} heading={t("plural:Pengambilan")} />}>
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
