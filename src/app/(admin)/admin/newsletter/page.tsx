import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { NEWSLETTER_STATUSES, toLabel } from "@/lib/admin-options";
import { can } from "@/lib/permissions";
import { adminDate, listLabels, paging, queryString } from "@/server/admin/list-labels";
import { parseSort } from "@/server/admin/list-query";
import { listNewsletters, NEWSLETTER_SORTABLE } from "@/server/admin/newsletters";
import { FAILED, SENDING, SENT } from "@/server/newsletter/newsletter-mail";

export const metadata: Metadata = { title: "Newsletter - Inofarma" };

/** Str::limit($text, 50) */
const limit = (text: string, length = 50) => ([...text].length <= length ? text : `${[...text].slice(0, length).join("").trimEnd()}...`);

/** GET /admin/newsletter: ListNewsletters, newest first, each row with Pratinjau and Ubah. */
export default async function Page({ searchParams }: PageProps<"/admin/newsletter">) {
  const context = await adminContext((access) => can(access, "Konten:Lihat"));
  const { access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const search = queryString(query.search);
  const sort = parseSort(query.sort, NEWSLETTER_SORTABLE);
  const { rows, total } = await listNewsletters({ search, sort, page, perPage });
  const canEdit = can(access, "Konten:Ubah");
  const statusColor = (status: string) => (status === SENT ? "success" : status === SENDING ? "warning" : status === FAILED ? "danger" : "gray");

  const tableRows: ListRow[] = rows.map((newsletter) => ({
    id: String(newsletter.id),
    url: canEdit ? `/admin/newsletter/${newsletter.id}/edit` : null,
    cells: {
      name: { kind: "text", text: newsletter.name },
      subject: { kind: "text", text: limit(newsletter.subject) },
      status: { kind: "badge", text: t(toLabel(NEWSLETTER_STATUSES, newsletter.status) ?? newsletter.status), color: statusColor(newsletter.status) },
      sent_at: newsletter.sentAt ? { kind: "text", text: adminDate(newsletter.sentAt, locale, true) ?? "" } : { kind: "placeholder", text: "—" },
      recipient_count: { kind: "text", text: String(newsletter.recipientCount), alignRight: true },
      success_count: { kind: "text", text: String(newsletter.successCount), alignRight: true, color: "success" },
      failed_count: newsletter.failedCount > 0 ? { kind: "text", text: String(newsletter.failedCount), alignRight: true, color: "danger" } : { kind: "text", text: "0", alignRight: true },
    },
    actions: [
      { key: "preview", label: t("Pratinjau"), icon: "o-eye", endpoint: `/admin/newsletter/${newsletter.id}/pratinjau`, preview: { heading: t("Pratinjau Newsletter"), backLabel: t("Kembali Mengedit") } },
      ...(canEdit ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/newsletter/${newsletter.id}/edit` }] : []),
    ],
  }));

  const spec: ListSpec = {
    heading: t("plural:Newsletter"),
    columns: [
      { name: "name", className: "name", label: t("Nama Kampanye"), sortable: true },
      { name: "subject", className: "subject", label: t("Subjek Email") },
      { name: "status", className: "status", label: t("Status") },
      { name: "sent_at", className: "sent-at", label: t("Tanggal Kirim"), sortable: true },
      { name: "recipient_count", className: "recipient-count", label: t("Penerima"), alignRight: true },
      { name: "success_count", className: "success-count", label: t("Berhasil"), alignRight: true },
      { name: "failed_count", className: "failed-count", label: t("Gagal"), alignRight: true },
    ],
    sort,
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [],
    bulkActions: [],
    emptyHeading: t("Belum ada newsletter."),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/newsletter">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Newsletter"), url: "/admin/newsletter" }, { label: t("Daftar") }]}
            heading={t("plural:Newsletter")}
            actions={canEdit ? <FiHeaderActions actions={[{ key: "create", label: t("Buat :label", { label: t("Newsletter") }), icon: "", href: "/admin/newsletter/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} /> : null}
          />
        }
      >
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
