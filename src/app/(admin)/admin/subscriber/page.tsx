import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiListTable, type ListAction, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { options, SUBSCRIBER_STATUSES, toLabel } from "@/lib/admin-options";
import { can } from "@/lib/permissions";
import { actionForm } from "@/server/admin/stock-forms";
import { adminDate, listLabels, paging, queryString } from "@/server/admin/list-labels";
import { parseSort } from "@/server/admin/list-query";
import { listSubscribers, SUBSCRIBER_SORTABLE } from "@/server/admin/subscribers";
import { SUBSCRIBED } from "@/server/newsletter/subscribers";

export const metadata: Metadata = { title: "Subscriber - Inofarma" };

/** GET /admin/subscriber: ListSubscribers with SubscribersTable, Import CSV and Export CSV above it. */
export default async function Page({ searchParams }: PageProps<"/admin/subscriber">) {
  const context = await adminContext((access) => can(access, "Konten:Lihat"));
  const { access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const status = queryString(query.filter_status);
  const search = queryString(query.search);
  const sort = parseSort(query.sort, SUBSCRIBER_SORTABLE);
  const { rows, total } = await listSubscribers({ search, status: status || undefined, sort, page, perPage });
  const canChange = can(access, "Konten:Ubah");

  const tableRows: ListRow[] = rows.map((subscriber) => ({
    id: String(subscriber.id),
    url: null,
    cells: {
      email: { kind: "copyable", text: subscriber.email, copiedMessage: t("Berhasil disalin") },
      status: { kind: "badge", text: t(toLabel(SUBSCRIBER_STATUSES, subscriber.status) ?? subscriber.status), color: subscriber.status === SUBSCRIBED ? "success" : "gray" },
      subscribed_at: subscriber.subscribedAt ? { kind: "text", text: adminDate(subscriber.subscribedAt, locale, true) ?? "" } : { kind: "placeholder", text: "—" },
      unsubscribed_at: subscriber.unsubscribedAt ? { kind: "text", text: adminDate(subscriber.unsubscribedAt, locale, true) ?? "" } : { kind: "placeholder", text: "—" },
    },
    actions:
      subscriber.status === SUBSCRIBED && canChange
        ? [
            {
              key: "unsubscribe",
              label: t("Berhentikan"),
              icon: "o-user-minus",
              color: "danger",
              endpoint: `/admin/subscriber/${subscriber.id}/berhentikan`,
              confirm: {
                heading: t("Berhentikan langganan?"),
                description: t(":email tidak akan menerima newsletter lagi.", { email: subscriber.email }),
                submitLabel: t("Konfirmasi"),
                color: "danger",
                icon: "o-exclamation-triangle",
              },
            },
          ]
        : [],
  }));

  const headerActions: ListAction[] = [
    ...(canChange
      ? [
          {
            key: "import",
            label: t("Import CSV"),
            icon: "o-arrow-up-tray",
            color: "gray" as const,
            endpoint: "/admin/subscriber/impor",
            form: actionForm(locale, t("Import Subscriber dari CSV"), [{ kind: "file" as const, name: "file", label: t("File CSV"), required: true, accept: ["text/csv", "text/plain", "application/vnd.ms-excel"] }], {
              description: t('Satu alamat email per baris, atau file dengan kolom "email". Email yang sudah ada dilewati, dan yang pernah berhenti tidak akan didaftarkan ulang.'),
            }),
          },
        ]
      : []),
    { key: "export", label: t("Export CSV"), icon: "o-arrow-down-tray", color: "gray", href: "/form/admin/subscriber/ekspor" },
  ];

  const spec: ListSpec = {
    heading: t("plural:Subscriber"),
    tableKey: "subscriber",
    header: { actions: headerActions },
    columns: [
      { name: "email", className: "email", label: t("Email"), sortable: true },
      { name: "status", className: "status", label: t("Status") },
      { name: "subscribed_at", className: "subscribed-at", label: t("Tanggal Berlangganan"), sortable: true },
      { name: "unsubscribed_at", className: "unsubscribed-at", label: t("Tanggal Berhenti"), sortable: true, toggleable: "hidden" },
    ],
    sort,
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
        options: [{ value: "", label: t("Semua") }, ...Object.entries(options(SUBSCRIBER_STATUSES)).map(([value, text]) => ({ value, label: t(text) }))],
      },
    ],
    bulkActions: [],
    emptyHeading: t("Belum ada subscriber."),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/subscriber">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Subscriber"), url: "/admin/subscriber" }, { label: t("Daftar") }]} heading={t("plural:Subscriber")} />}>
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
