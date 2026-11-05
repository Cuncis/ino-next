import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { CUSTOMER_DEFAULTS, customerFormBlocks } from "@/server/admin/crm-form-specs";
import { CUSTOMER_PERMISSIONS } from "@/server/admin/customers";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Pelanggan - Inofarma" };

/** GET /admin/pelanggan/create: CreateCustomer. */
export default async function Page() {
  const context = await adminContext((access) => authorizes(access, CUSTOMER_PERMISSIONS, "create"));
  const { locale, t } = context;

  return (
    <AdminShell context={context} pathname="/admin/pelanggan/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Pelanggan"), url: "/admin/pelanggan" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Pelanggan") })} />}>
        <ResourceForm mode="create" endpoint="/admin/pelanggan/buat" blocks={customerFormBlocks(locale)} initial={CUSTOMER_DEFAULTS} cancelUrl="/admin/pelanggan" labels={formLabels(locale)} />
      </FiPage>
    </AdminShell>
  );
}
