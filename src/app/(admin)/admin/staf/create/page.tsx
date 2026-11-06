import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { staffFormBlocks } from "@/server/admin/access-form-specs";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Staf - Inofarma" };

/** GET /admin/staf/create: CreateStaff. */
export default async function Page() {
  const context = await adminContext((access) => can(access, "Pengaturan:Ubah"));
  const { locale, t } = context;

  return (
    <AdminShell context={context} pathname="/admin/staf/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Staf"), url: "/admin/staf" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Staf") })} />}>
        <ResourceForm
          mode="create"
          endpoint="/admin/staf/buat"
          blocks={await staffFormBlocks(locale, "create")}
          initial={{ name: "", email: "", phone: "", branch_id: "", password: "", password_confirmation: "", is_active: "1", roles: [] }}
          cancelUrl="/admin/staf"
          labels={formLabels(locale)}
        />
      </FiPage>
    </AdminShell>
  );
}
