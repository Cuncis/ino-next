import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { deletionActions, listLabels, paging, queryString } from "@/server/admin/list-labels";
import { listRoles } from "@/server/admin/roles";

export const metadata: Metadata = { title: "Peran - Inofarma" };

/** Str::limit($text, 60) */
const limit = (text: string, length = 60) => ([...text].length <= length ? text : `${[...text].slice(0, length).join("").trimEnd()}...`);

/** GET /admin/peran: ListRoles with RolesTable (Peran:Lihat; changes need Peran:Ubah). */
export default async function Page({ searchParams }: PageProps<"/admin/peran">) {
  const context = await adminContext((access) => can(access, "Peran:Lihat"));
  const { access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const search = queryString(query.search);
  const { rows, total } = await listRoles({ search, page, perPage });
  const canChange = can(access, "Peran:Ubah");

  const tableRows: ListRow[] = rows.map((role) => ({
    id: String(role.id),
    url: canChange ? `/admin/peran/${role.id}/edit` : null,
    cells: {
      name: { kind: "text", text: role.name },
      description: role.description ? { kind: "text", text: limit(role.description) } : { kind: "placeholder", text: "—" },
      users_count: { kind: "text", text: String(role.usersCount), alignRight: true },
      permissions_count: { kind: "text", text: String(role.permissionsCount), alignRight: true },
    },
    actions: canChange
      ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/peran/${role.id}/edit` }, ...deletionActions(locale, t("Peran"), { delete: `/admin/peran/${role.id}/hapus` }, false)]
      : [],
  }));

  const spec: ListSpec = {
    heading: t("plural:Peran"),
    columns: [
      { name: "name", className: "name", label: t("Nama") },
      { name: "description", className: "description", label: t("Deskripsi") },
      { name: "users_count", className: "users-count", label: t("Staf"), alignRight: true },
      { name: "permissions_count", className: "permissions-count", label: t("Hak Akses"), alignRight: true },
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
    <AdminShell context={context} pathname="/admin/peran">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Peran"), url: "/admin/peran" }, { label: t("Daftar") }]}
            heading={t("plural:Peran")}
            actions={canChange ? <FiHeaderActions actions={[{ key: "create", label: t("Buat :label", { label: t("Peran") }), icon: "", href: "/admin/peran/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} /> : null}
          />
        }
      >
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
