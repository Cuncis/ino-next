import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { attributeFormBlocks, formLabels } from "@/server/admin/catalog-form-specs";
import { CATALOG_PERMISSIONS } from "@/server/admin/catalog-records";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Atribut - Inofarma" };

/** GET /admin/atribut/create: CreateAttribute. */
export default async function Page() {
  const context = await adminContext((access) => authorizes(access, CATALOG_PERMISSIONS, "create"));
  const { locale, t } = context;

  return (
    <AdminShell context={context} pathname="/admin/atribut/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Atribut"), url: "/admin/atribut" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Atribut") })} />}>
        <ResourceForm mode="create" endpoint="/admin/atribut/buat" blocks={attributeFormBlocks(locale)} initial={{ name: "", type: "pilihan", values: [] }} cancelUrl="/admin/atribut" labels={formLabels(locale)} />
      </FiPage>
    </AdminShell>
  );
}
