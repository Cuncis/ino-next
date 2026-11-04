import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { SUPPLIER_STATUSES, toLabel } from "@/lib/admin-options";
import { rupiah } from "@/lib/money";
import { authorizes } from "@/lib/permissions";
import { CATALOG_PERMISSIONS, listSuppliers } from "@/server/admin/catalog-records";
import { adminDate, deletionActions, listLabels, paging, queryString, trashedFilter } from "@/server/admin/list-labels";

export const metadata: Metadata = { title: "Pemasok - Inofarma" };

/** GET /admin/pemasok: ListSuppliers with SuppliersTable: products and revenue per supplier. */
export default async function Page({ searchParams }: PageProps<"/admin/pemasok">) {
  const context = await adminContext((access) => authorizes(access, CATALOG_PERMISSIONS, "viewAny"));
  const { access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const trashed = queryString(query.filter_trashed);
  const search = queryString(query.search);
  const { rows, total } = await listSuppliers({ search, trashed, page, perPage });
  const canEdit = authorizes(access, CATALOG_PERMISSIONS, "update");
  const canDelete = authorizes(access, CATALOG_PERMISSIONS, "delete");
  const label = t("Pemasok");

  const tableRows: ListRow[] = rows.map((supplier) => ({
    id: String(supplier.id),
    url: canEdit ? `/admin/pemasok/${supplier.id}/edit` : null,
    cells: {
      code: { kind: "text", text: supplier.code },
      name: { kind: "text", text: supplier.name },
      contact_person: supplier.contactPerson ? { kind: "text", text: supplier.contactPerson } : { kind: "empty" },
      kota: supplier.kota ? { kind: "text", text: supplier.kota } : { kind: "empty" },
      products_count: { kind: "text", text: String(supplier.productCount), alignRight: true },
      revenue: { kind: "text", text: rupiah(supplier.revenue), alignRight: true },
      created_at: { kind: "text", text: adminDate(supplier.createdAt, locale) ?? "" },
      status: { kind: "badge", text: t(toLabel(SUPPLIER_STATUSES, supplier.status) ?? supplier.status), color: "gray" },
    },
    actions: [
      ...(canEdit ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/pemasok/${supplier.id}/edit` }] : []),
      ...(canDelete && supplier.deletedAt === null ? deletionActions(locale, label, { delete: `/admin/pemasok/${supplier.id}/hapus` }, false) : []),
    ],
  }));

  const spec: ListSpec = {
    heading: t("plural:Pemasok"),
    columns: [
      { name: "code", className: "code", label: t("Kode") },
      { name: "name", className: "name", label: t("Pemasok") },
      { name: "contact_person", className: "contact-person", label: t("Pemilik") },
      { name: "kota", className: "kota", label: t("Kota") },
      { name: "products_count", className: "products-count", label: t("Produk"), alignRight: true },
      { name: "revenue", className: "revenue", label: t("Pendapatan"), alignRight: true },
      { name: "created_at", className: "created-at", label: t("Bergabung") },
      { name: "status", className: "status", label: t("Status") },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [trashedFilter(locale, trashed)],
    bulkActions: canDelete
      ? deletionActions(locale, label, { delete: "/admin/pemasok/massal/hapus", ...(trashed ? { forceDelete: "/admin/pemasok/massal/hapus-permanen", restore: "/admin/pemasok/massal/pulihkan" } : {}) }, true)
      : [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/pemasok">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Pemasok"), url: "/admin/pemasok" }, { label: t("Daftar") }]}
            heading={t("plural:Pemasok")}
            actions={
              authorizes(access, CATALOG_PERMISSIONS, "create") ? (
                <FiHeaderActions actions={[{ key: "create", label: t("Buat :label", { label }), icon: "", href: "/admin/pemasok/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} />
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
