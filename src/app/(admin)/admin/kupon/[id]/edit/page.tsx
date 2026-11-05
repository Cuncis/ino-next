import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { COUPON_PERMISSIONS, couponBranchIds, findCoupon } from "@/server/admin/coupons";
import { couponFormBlocks } from "@/server/admin/crm-form-specs";
import { deletionActions } from "@/server/admin/list-labels";
import { FormHeaderButtons, ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Ubah Kupon - Inofarma" };

/** A stored date (midnight, Jakarta) as the date input's Y-m-d. */
const ymd = (date: Date | null) => (date ? new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10) : "");

/** GET /admin/kupon/{id}/edit: EditCoupon. */
export default async function Page({ params }: PageProps<"/admin/kupon/[id]/edit">) {
  const context = await adminContext((access) => authorizes(access, COUPON_PERMISSIONS, "update"));
  const { access, locale, t } = context;
  const record = await findCoupon(Number((await params).id));

  if (!record) {
    notFound();
  }

  const labels = formLabels(locale);
  const deleted = record.deletedAt !== null;

  return (
    <AdminShell context={context} pathname={`/admin/kupon/${record.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Kupon"), url: "/admin/kupon" }, { label: record.code, url: `/admin/kupon/${record.id}/edit` }, { label: t("Ubah") }]}
            heading={t("Ubah :label", { label: record.code })}
            actions={<FormHeaderButtons cancelUrl="/admin/kupon" labels={{ cancel: labels.cancel, save: labels.save }} />}
          />
        }
      >
        <ResourceForm
          mode="edit"
          endpoint={`/admin/kupon/${record.id}/simpan`}
          blocks={await couponFormBlocks(locale)}
          initial={{
            code: record.code,
            type: record.type,
            value: String(record.value),
            minimum_purchase: record.minimumPurchase === null ? "" : String(record.minimumPurchase),
            quota: record.quota === null ? "" : String(record.quota),
            status: record.status,
            starts_at: ymd(record.startsAt),
            expires_at: ymd(record.expiresAt),
            branches: await couponBranchIds(record.id),
          }}
          pageActions={
            authorizes(access, COUPON_PERMISSIONS, "delete")
              ? deletionActions(locale, t("Kupon"), deleted ? { forceDelete: `/admin/kupon/${record.id}/hapus-permanen`, restore: `/admin/kupon/${record.id}/pulihkan` } : { delete: `/admin/kupon/${record.id}/hapus` }, false)
              : []
          }
          cancelUrl="/admin/kupon"
          labels={labels}
        />
      </FiPage>
    </AdminShell>
  );
}
