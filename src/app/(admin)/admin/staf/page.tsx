import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { adminDate, deletionActions, listLabels, paging, queryString, trashedFilter } from "@/server/admin/list-labels";
import { listStaff } from "@/server/admin/staff-accounts";

export const metadata: Metadata = { title: "Staf - Inofarma" };

/** GET /admin/staf: ListStaff with StaffTable (Pengaturan:Ubah). */
export default async function Page({ searchParams }: PageProps<"/admin/staf">) {
  const context = await adminContext((access) => can(access, "Pengaturan:Ubah"));
  const { locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const trashed = queryString(query.filter_trashed);
  const search = queryString(query.search);
  const { rows, total } = await listStaff({ search, trashed, page, perPage });
  const label = t("Staf");

  const tableRows: ListRow[] = rows.map((account) => ({
    id: String(account.id),
    url: `/admin/staf/${account.id}/edit`,
    cells: {
      name: { kind: "text", text: account.name },
      email: { kind: "text", text: account.email },
      "branch.name": account.branchName ? { kind: "text", text: account.branchName } : { kind: "placeholder", text: t("Pusat (semua cabang)") },
      "roles.name": account.roleNames.length ? { kind: "badges", items: account.roleNames, color: "primary" } : { kind: "empty" },
      is_active: { kind: "icon", value: account.isActive, label: account.isActive ? "Yes" : "No" },
      two_factor_confirmed_at: { kind: "icon", value: account.twoFactor, label: account.twoFactor ? "Yes" : "No" },
      last_login_at: account.lastLoginAt ? { kind: "text", text: adminDate(account.lastLoginAt, locale, true) ?? "" } : { kind: "placeholder", text: "—" },
    },
    actions: [
      { key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/staf/${account.id}/edit` },
      ...(account.deletedAt === null ? deletionActions(locale, label, { delete: `/admin/staf/${account.id}/hapus` }, false) : []),
    ],
  }));

  const spec: ListSpec = {
    heading: t("plural:Staf"),
    columns: [
      { name: "name", className: "name", label: t("Nama") },
      { name: "email", className: "email", label: t("Email") },
      { name: "branch.name", className: "branch.name", label: t("Cabang") },
      { name: "roles.name", className: "roles.name", label: t("Peran") },
      { name: "is_active", className: "is-active", label: t("Aktif") },
      { name: "two_factor_confirmed_at", className: "two-factor-confirmed-at", label: t("2FA") },
      { name: "last_login_at", className: "last-login-at", label: t("Login Terakhir") },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [trashedFilter(locale, trashed)],
    bulkActions: deletionActions(locale, label, { delete: "/admin/staf/massal/hapus", ...(trashed ? { forceDelete: "/admin/staf/massal/hapus-permanen", restore: "/admin/staf/massal/pulihkan" } : {}) }, true),
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/staf">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Staf"), url: "/admin/staf" }, { label: t("Daftar") }]}
            heading={t("plural:Staf")}
            actions={<FiHeaderActions actions={[{ key: "create", label: t("Buat :label", { label }), icon: "", href: "/admin/staf/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} />}
          />
        }
      >
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
