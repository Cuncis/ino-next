import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { roleFormBlocks } from "@/server/admin/access-form-specs";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Peran - Inofarma" };

/** GET /admin/peran/create: CreateRole. */
export default async function Page() {
  const context = await adminContext((access) => can(access, "Peran:Lihat") && can(access, "Peran:Ubah"));
  const { locale, t } = context;

  return (
    <AdminShell context={context} pathname="/admin/peran/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Peran"), url: "/admin/peran" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Peran") })} />}>
        <ResourceForm mode="create" endpoint="/admin/peran/buat" blocks={await roleFormBlocks(locale)} initial={{ name: "", description: "", permissions: [] }} cancelUrl="/admin/peran" labels={formLabels(locale)} />
      </FiPage>
    </AdminShell>
  );
}
