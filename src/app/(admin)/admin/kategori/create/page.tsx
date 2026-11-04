import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { categoryFormBlocks, formLabels } from "@/server/admin/catalog-form-specs";
import { CATALOG_PERMISSIONS } from "@/server/admin/catalog-records";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Kategori - Inofarma" };

/** GET /admin/kategori/create: CreateCategory. */
export default async function Page() {
  const context = await adminContext((access) => authorizes(access, CATALOG_PERMISSIONS, "create"));
  const { locale, t } = context;

  return (
    <AdminShell context={context} pathname="/admin/kategori/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Kategori"), url: "/admin/kategori" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Kategori") })} />}>
        <ResourceForm mode="create" endpoint="/admin/kategori/buat" blocks={categoryFormBlocks(locale)} initial={{ name: "", slug: "", status: "", description: "" }} cancelUrl="/admin/kategori" labels={formLabels(locale)} />
      </FiPage>
    </AdminShell>
  );
}
