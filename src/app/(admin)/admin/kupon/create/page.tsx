import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { COUPON_PERMISSIONS } from "@/server/admin/coupons";
import { COUPON_DEFAULTS, couponFormBlocks } from "@/server/admin/crm-form-specs";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Kupon - Inofarma" };

/** GET /admin/kupon/create: CreateCoupon. */
export default async function Page() {
  const context = await adminContext((access) => authorizes(access, COUPON_PERMISSIONS, "create"));
  const { locale, t } = context;

  return (
    <AdminShell context={context} pathname="/admin/kupon/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Kupon"), url: "/admin/kupon" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Kupon") })} />}>
        <ResourceForm mode="create" endpoint="/admin/kupon/buat" blocks={await couponFormBlocks(locale)} initial={COUPON_DEFAULTS} cancelUrl="/admin/kupon" labels={formLabels(locale)} />
      </FiPage>
    </AdminShell>
  );
}
