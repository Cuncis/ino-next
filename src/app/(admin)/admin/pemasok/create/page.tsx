import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { supplierFormBlocks, formLabels } from "@/server/admin/catalog-form-specs";
import { CATALOG_PERMISSIONS } from "@/server/admin/catalog-records";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Pemasok - Inofarma" };

/** GET /admin/pemasok/create: CreateSupplier. */
export default async function Page() {
  const context = await adminContext((access) => authorizes(access, CATALOG_PERMISSIONS, "create"));
  const { locale, t } = context;

  return (
    <AdminShell context={context} pathname="/admin/pemasok/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Pemasok"), url: "/admin/pemasok" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Pemasok") })} />}>
        <ResourceForm mode="create" endpoint="/admin/pemasok/buat" blocks={supplierFormBlocks(locale)} initial={{ name: "", contact_person: "", email: "", phone: "", license_number: "", kota: "", status: "aktif", address_line: "" }} cancelUrl="/admin/pemasok" labels={formLabels(locale)} />
      </FiPage>
    </AdminShell>
  );
}
