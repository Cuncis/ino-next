import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { CATEGORY_STATUSES, toLabel } from "@/lib/admin-options";
import { authorizes } from "@/lib/permissions";
import { CATALOG_PERMISSIONS, listCategories } from "@/server/admin/catalog-records";
import { deletionActions, listLabels, paging, queryString, trashedFilter } from "@/server/admin/list-labels";

export const metadata: Metadata = { title: "Kategori - Inofarma" };

/** GET /admin/kategori: ListCategories with CategoriesTable, in the storefront's order. */
export default async function Page({ searchParams }: PageProps<"/admin/kategori">) {
  const context = await adminContext((access) => authorizes(access, CATALOG_PERMISSIONS, "viewAny"));
  const { access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const trashed = queryString(query.filter_trashed);
  const search = queryString(query.search);
  const { rows, total } = await listCategories({ search, trashed, page, perPage });
  const canEdit = authorizes(access, CATALOG_PERMISSIONS, "update");
  const canDelete = authorizes(access, CATALOG_PERMISSIONS, "delete");
  const label = t("Kategori");

  const tableRows: ListRow[] = rows.map((category) => ({
    id: String(category.id),
    url: canEdit ? `/admin/kategori/${category.id}/edit` : null,
    cells: {
      name: { kind: "text", text: category.name },
      slug: { kind: "text", text: category.slug },
      status: { kind: "badge", text: t(toLabel(CATEGORY_STATUSES, category.status) ?? category.status), color: "primary" },
      products_count: { kind: "text", text: String(category.productCount), alignRight: true },
    },
    actions: [
      ...(canEdit ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/kategori/${category.id}/edit` }] : []),
      ...(canDelete && category.deletedAt === null ? deletionActions(locale, label, { delete: `/admin/kategori/${category.id}/hapus` }, false) : []),
    ],
  }));

  const spec: ListSpec = {
    heading: t("plural:Kategori"),
    tableKey: "kategori",
    columns: [
      { name: "name", className: "name", label: t("Nama") },
      { name: "slug", className: "slug", label: t("Slug"), toggleable: "hidden" },
      { name: "status", className: "status", label: t("Status") },
      { name: "products_count", className: "products-count", label: t("Produk"), alignRight: true },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [trashedFilter(locale, trashed)],
    bulkActions: canDelete
      ? deletionActions(locale, label, { delete: "/admin/kategori/massal/hapus", ...(trashed ? { forceDelete: "/admin/kategori/massal/hapus-permanen", restore: "/admin/kategori/massal/pulihkan" } : {}) }, true)
      : [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/kategori">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Kategori"), url: "/admin/kategori" }, { label: t("Daftar") }]}
            heading={t("plural:Kategori")}
            actions={
              authorizes(access, CATALOG_PERMISSIONS, "create") ? (
                <FiHeaderActions actions={[{ key: "create", label: t("Buat :label", { label }), icon: "", href: "/admin/kategori/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} />
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
