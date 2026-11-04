import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { FiWidgets, FiWidgetTable, textCell } from "@/components/admin/filament/WidgetTable";
import { rupiah } from "@/lib/money";
import { can } from "@/lib/permissions";
import { dailyCollections, defaultRange, listPayments, paymentStatusColor } from "@/server/admin/finance-transfers";
import { adminDate, listLabels, paging, queryString } from "@/server/admin/list-labels";
import { DateRangeFilters } from "@/views/admin/DateRangeFilters";

export const metadata: Metadata = { title: "Rekonsiliasi - Inofarma" };

const ucfirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * GET /admin/rekonsiliasi: ListReconciliations. The money collected per branch per day
 * (DailyReconciliationWidget, the last seven days unless filtered), then the payment log
 * with "Cek Status" for an attempt still waiting.
 */
export default async function Page({ searchParams }: PageProps<"/admin/rekonsiliasi">) {
  const context = await adminContext((access) => can(access, "Pesanan:Lihat"));
  const { staff, access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const search = queryString(query.search);
  const defaults = defaultRange();
  const from = isDate(queryString(query.dari)) ? queryString(query.dari) : defaults.from;
  const to = isDate(queryString(query.sampai)) ? queryString(query.sampai) : defaults.to;
  const [daily, { rows, total }] = await Promise.all([dailyCollections(from, to, staff), listPayments({ search, page, perPage }, staff)]);
  const collected = daily.reduce((sum, row) => sum + row.total, 0);
  const canCheck = can(access, "Pesanan:Proses");

  const tableRows: ListRow[] = rows.map((payment) => ({
    id: String(payment.id),
    url: null,
    cells: {
      "order.number": payment.orderNumber ? { kind: "text", text: payment.orderNumber } : { kind: "empty" },
      "order.branch.name": payment.branchName ? { kind: "text", text: payment.branchName } : { kind: "empty" },
      channel: payment.channel ? { kind: "text", text: payment.channel } : { kind: "placeholder", text: "—" },
      amount: { kind: "text", text: rupiah(payment.amount), alignRight: true },
      status: { kind: "badge", text: t(ucfirst(payment.status)), color: paymentStatusColor(payment.status) },
      created_at: { kind: "text", text: adminDate(payment.createdAt, locale, true) ?? "" },
    },
    actions: payment.status === "pending" && canCheck ? [{ key: "cekStatus", label: t("Cek Status"), icon: "o-arrow-path", color: "primary" as const, endpoint: `/admin/rekonsiliasi/${payment.id}/cek-status` }] : [],
  }));

  const spec: ListSpec = {
    heading: t("Log Pembayaran"),
    header: { heading: t("Log Pembayaran"), actions: [] },
    columns: [
      { name: "order.number", className: "order.number", label: t("No. Pesanan") },
      { name: "order.branch.name", className: "order.branch.name", label: t("Cabang") },
      { name: "channel", className: "channel", label: t("Kanal") },
      { name: "amount", className: "amount", label: t("Jumlah"), alignRight: true },
      { name: "status", className: "status", label: t("Status") },
      { name: "created_at", className: "created-at", label: t("Waktu") },
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
    <AdminShell context={context} pathname="/admin/rekonsiliasi">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Rekonsiliasi"), url: "/admin/rekonsiliasi" }, { label: t("Daftar") }]} heading={t("plural:Rekonsiliasi")} />}>
        <FiWidgets>
          <FiWidgetTable
            heading={t("Terkumpul per Cabang per Hari")}
            description={t("Total periode ini: :total", { total: rupiah(collected) })}
            filters={<DateRangeFilters from={from} to={to} defaults={defaults} labels={{ filters: t("Filter"), reset: t("Atur ulang filter"), apply: t("Terapkan filter"), from: t("Dari"), to: t("Sampai") }} />}
            columns={[
              { name: "tanggal", className: "tanggal", label: t("Tanggal") },
              { name: "branch", className: "branch", label: t("Cabang") },
              { name: "jumlah_pesanan", className: "jumlah-pesanan", label: t("Jumlah Pesanan"), alignRight: true },
              { name: "total", className: "total", label: t("Total Terkumpul"), alignRight: true },
            ]}
            rows={daily.map((row) => ({
              key: `${row.day}-${row.branchName}`,
              cells: {
                tanggal: textCell(adminDate(new Date(`${row.day}T00:00:00+07:00`), locale) ?? row.day),
                branch: textCell(row.branchName),
                jumlah_pesanan: textCell(String(row.orderCount), true),
                total: textCell(rupiah(row.total), true, "bold"),
              },
            }))}
            emptyHeading={t("Belum ada pembayaran lunas pada rentang tanggal ini.")}
          />
        </FiWidgets>
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
