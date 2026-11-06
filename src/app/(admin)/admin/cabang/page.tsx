import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { BRANCH_STATUSES, toLabel } from "@/lib/admin-options";
import { authorizes } from "@/lib/permissions";
import { BRANCH_PERMISSIONS, BRANCH_SORTABLE, isOpenNow, listBranches } from "@/server/admin/branches";
import { adminDateTime, deletionActions, listLabels, paging, queryString, trashedFilter } from "@/server/admin/list-labels";
import { parseSort } from "@/server/admin/list-query";

export const metadata: Metadata = { title: "Cabang - Inofarma" };

/** GET /admin/cabang: ListBranches with BranchesTable. */
export default async function Page({ searchParams }: PageProps<"/admin/cabang">) {
  const context = await adminContext((access) => authorizes(access, BRANCH_PERMISSIONS, "viewAny"));
  const { staff, access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const trashed = queryString(query.filter_trashed);
  const search = queryString(query.search);
  const sort = parseSort(query.sort, BRANCH_SORTABLE);
  const { rows, total } = await listBranches({ search, trashed, sort, page, perPage }, staff);
  const canEdit = authorizes(access, BRANCH_PERMISSIONS, "update");
  const canDelete = authorizes(access, BRANCH_PERMISSIONS, "delete");
  const label = t("Cabang");

  const tableRows: ListRow[] = rows.map((branch) => ({
    id: String(branch.id),
    url: canEdit ? `/admin/cabang/${branch.id}/edit` : null,
    cells: {
      code: { kind: "text", text: branch.code },
      name: { kind: "text", text: branch.name },
      kota: { kind: "text", text: branch.kota },
      stocks_count: { kind: "text", text: String(branch.stocksCount), alignRight: true },
      is_open_now: { kind: "icon", value: isOpenNow(branch), label: isOpenNow(branch) ? "Yes" : "No" },
      status: { kind: "badge", text: t(toLabel(BRANCH_STATUSES, branch.status) ?? branch.status), color: "primary" },
      created_at: branch.createdAt ? { kind: "text", text: adminDateTime(branch.createdAt, locale) ?? "" } : { kind: "empty" },
    },
    actions: [
      ...(canEdit ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/cabang/${branch.id}/edit` }] : []),
      ...(canDelete && branch.deletedAt === null ? deletionActions(locale, label, { delete: `/admin/cabang/${branch.id}/hapus` }, false) : []),
    ],
  }));

  const spec: ListSpec = {
    heading: t("plural:Cabang"),
    tableKey: "cabang",
    columns: [
      { name: "code", className: "code", label: t("Kode") },
      { name: "name", className: "name", label: t("Cabang") },
      { name: "kota", className: "kota", label: t("Kota") },
      { name: "stocks_count", className: "stocks-count", label: t("Produk Distok"), alignRight: true },
      { name: "is_open_now", className: "is-open-now", label: t("Buka Sekarang") },
      { name: "status", className: "status", label: t("Status") },
      { name: "created_at", className: "created-at", label: t("Created at"), sortable: true, toggleable: "hidden" },
    ],
    sort,
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [trashedFilter(locale, trashed)],
    bulkActions: canDelete
      ? deletionActions(locale, label, { delete: "/admin/cabang/massal/hapus", ...(trashed ? { forceDelete: "/admin/cabang/massal/hapus-permanen", restore: "/admin/cabang/massal/pulihkan" } : {}) }, true)
      : [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/cabang">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Cabang"), url: "/admin/cabang" }, { label: t("Daftar") }]}
            heading={t("plural:Cabang")}
            actions={
              authorizes(access, BRANCH_PERMISSIONS, "create") ? (
                <FiHeaderActions actions={[{ key: "create", label: t("Buat :label", { label }), icon: "", href: "/admin/cabang/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} />
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
