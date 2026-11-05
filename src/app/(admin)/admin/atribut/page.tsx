import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { ATTRIBUTE_TYPES, toLabel } from "@/lib/admin-options";
import { authorizes } from "@/lib/permissions";
import { ATTRIBUTE_SORTABLE, CATALOG_PERMISSIONS, listAttributes } from "@/server/admin/catalog-records";
import { adminDateTime, deletionActions, listLabels, paging, queryString, trashedFilter } from "@/server/admin/list-labels";
import { parseSort } from "@/server/admin/list-query";

export const metadata: Metadata = { title: "Atribut - Inofarma" };

/** GET /admin/atribut: ListAttributes with AttributesTable, by name. */
export default async function Page({ searchParams }: PageProps<"/admin/atribut">) {
  const context = await adminContext((access) => authorizes(access, CATALOG_PERMISSIONS, "viewAny"));
  const { access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const trashed = queryString(query.filter_trashed);
  const search = queryString(query.search);
  const sort = parseSort(query.sort, ATTRIBUTE_SORTABLE);
  const { rows, total } = await listAttributes({ search, trashed, page, perPage, sort });
  const canEdit = authorizes(access, CATALOG_PERMISSIONS, "update");
  const canDelete = authorizes(access, CATALOG_PERMISSIONS, "delete");
  const label = t("Atribut");

  const tableRows: ListRow[] = rows.map((attribute) => {
    const values = Array.isArray(attribute.values) ? (attribute.values as string[]) : [];

    return {
      id: String(attribute.id),
      url: canEdit ? `/admin/atribut/${attribute.id}/edit` : null,
      cells: {
        name: { kind: "text", text: attribute.name },
        type: { kind: "badge", text: t(toLabel(ATTRIBUTE_TYPES, attribute.type) ?? attribute.type), color: "primary" },
        values: { kind: "text", text: values.length ? values.join(", ") : "—" },
        slug: { kind: "text", text: attribute.slug },
        created_at: { kind: "text", text: adminDateTime(attribute.createdAt, locale) ?? "" },
        updated_at: { kind: "text", text: adminDateTime(attribute.updatedAt, locale) ?? "" },
      },
      actions: [
        ...(canEdit ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/atribut/${attribute.id}/edit` }] : []),
        ...(canDelete && attribute.deletedAt === null ? deletionActions(locale, label, { delete: `/admin/atribut/${attribute.id}/hapus` }, false) : []),
      ],
    };
  });

  const spec: ListSpec = {
    heading: t("plural:Atribut"),
    tableKey: "atribut",
    columns: [
      { name: "name", className: "name", label: t("Atribut") },
      { name: "type", className: "type", label: t("Tipe") },
      { name: "values", className: "values", label: t("Nilai") },
      { name: "slug", className: "slug", label: "Slug", toggleable: "hidden" },
      { name: "created_at", className: "created-at", label: "Created at", toggleable: "hidden", sortable: true },
      { name: "updated_at", className: "updated-at", label: "Updated at", toggleable: "hidden", sortable: true },
    ],
    sort,
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [trashedFilter(locale, trashed)],
    bulkActions: canDelete
      ? deletionActions(locale, label, { delete: "/admin/atribut/massal/hapus", ...(trashed ? { forceDelete: "/admin/atribut/massal/hapus-permanen", restore: "/admin/atribut/massal/pulihkan" } : {}) }, true)
      : [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/atribut">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Atribut"), url: "/admin/atribut" }, { label: t("Daftar") }]}
            heading={t("plural:Atribut")}
            actions={
              authorizes(access, CATALOG_PERMISSIONS, "create") ? (
                <FiHeaderActions actions={[{ key: "create", label: t("Buat :label", { label }), icon: "", href: "/admin/atribut/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} />
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
