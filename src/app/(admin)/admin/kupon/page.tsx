import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiListTable, type ListCell, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { translateChoice } from "@/lib/admin-i18n";
import { COUPON_STATUSES, COUPON_TYPES, toLabel } from "@/lib/admin-options";
import { rupiah } from "@/lib/money";
import { authorizes } from "@/lib/permissions";
import { COUPON_PERMISSIONS, isExhausted, isExpired, listCoupons } from "@/server/admin/coupons";
import { adminDate, deletionActions, listLabels, paging, queryString, trashedFilter } from "@/server/admin/list-labels";

export const metadata: Metadata = { title: "Kupon - Inofarma" };

/** GET /admin/kupon: ListCoupons with CouponsTable (Super Admin only). */
export default async function Page({ searchParams }: PageProps<"/admin/kupon">) {
  const context = await adminContext((access) => authorizes(access, COUPON_PERMISSIONS, "viewAny"));
  const { access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const trashed = queryString(query.filter_trashed);
  const search = queryString(query.search);
  const { rows, total } = await listCoupons({ search, trashed, page, perPage });
  const canEdit = authorizes(access, COUPON_PERMISSIONS, "update");
  const canDelete = authorizes(access, COUPON_PERMISSIONS, "delete");
  const label = t("Kupon");

  const tableRows: ListRow[] = rows.map((coupon) => {
    const branchesCell: ListCell = coupon.branchNames.length
      ? {
          kind: "badges",
          items: coupon.branchNames.slice(0, 2),
          color: "primary",
          more: coupon.branchNames.length > 2 ? translateChoice(locale, "dan :count lainnya", coupon.branchNames.length - 2) : undefined,
        }
      : { kind: "placeholder", text: t("Semua cabang") };
    const status = isExhausted(coupon) ? t("Habis") : isExpired(coupon) ? t("Kedaluwarsa") : t(toLabel(COUPON_STATUSES, coupon.status) ?? coupon.status);

    return {
      id: String(coupon.id),
      url: canEdit ? `/admin/kupon/${coupon.id}/edit` : null,
      cells: {
        code: { kind: "text", text: coupon.code },
        type: { kind: "badge", text: t(toLabel(COUPON_TYPES, coupon.type) ?? coupon.type), color: "primary" },
        value: { kind: "text", text: coupon.type === "persentase" ? `${coupon.value}%` : rupiah(coupon.value) },
        // an empty minimum shows nothing; a zero one a dash
        minimum_purchase: coupon.minimumPurchase === null ? { kind: "empty" } : { kind: "text", text: coupon.minimumPurchase ? rupiah(coupon.minimumPurchase) : "—", alignRight: true },
        used_count: { kind: "text", text: String(coupon.usedCount), alignRight: true },
        "branches.name": branchesCell,
        expires_at: coupon.expiresAt ? { kind: "text", text: adminDate(coupon.expiresAt, locale) ?? "" } : { kind: "placeholder", text: "—" },
        status: { kind: "badge", text: status, color: "primary" },
      },
      actions: [
        ...(canEdit ? [{ key: "edit", label: t("Ubah"), icon: "c-pencil-square", color: "primary" as const, href: `/admin/kupon/${coupon.id}/edit` }] : []),
        ...(canDelete && coupon.deletedAt === null ? deletionActions(locale, label, { delete: `/admin/kupon/${coupon.id}/hapus` }, false) : []),
      ],
    };
  });

  const spec: ListSpec = {
    heading: t("plural:Kupon"),
    columns: [
      { name: "code", className: "code", label: t("Kode") },
      { name: "type", className: "type", label: t("Tipe") },
      { name: "value", className: "value", label: t("Nilai") },
      { name: "minimum_purchase", className: "minimum-purchase", label: t("Min. Belanja"), alignRight: true },
      { name: "used_count", className: "used-count", label: t("Terpakai"), alignRight: true },
      { name: "branches.name", className: "branches.name", label: t("Cabang") },
      { name: "expires_at", className: "expires-at", label: t("Berlaku Sampai") },
      { name: "status", className: "status", label: t("Status") },
    ],
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [trashedFilter(locale, trashed)],
    bulkActions: canDelete
      ? deletionActions(locale, label, { delete: "/admin/kupon/massal/hapus", ...(trashed ? { forceDelete: "/admin/kupon/massal/hapus-permanen", restore: "/admin/kupon/massal/pulihkan" } : {}) }, true)
      : [],
    emptyHeading: t("Tidak ada data yang ditemukan"),
    labels: listLabels(locale),
  };

  return (
    <AdminShell context={context} pathname="/admin/kupon">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Kupon"), url: "/admin/kupon" }, { label: t("Daftar") }]}
            heading={t("plural:Kupon")}
            actions={
              authorizes(access, COUPON_PERMISSIONS, "create") ? (
                <FiHeaderActions actions={[{ key: "create", label: t("Buat :label", { label }), icon: "", href: "/admin/kupon/create" }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} />
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
