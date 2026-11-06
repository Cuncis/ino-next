import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { BRANCH_DEFAULTS, branchFormBlocks } from "@/server/admin/access-form-specs";
import { BRANCH_PERMISSIONS } from "@/server/admin/branches";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Cabang - Inofarma" };

/** GET /admin/cabang/create: CreateBranch. */
export default async function Page() {
  const context = await adminContext((access) => authorizes(access, BRANCH_PERMISSIONS, "create"));
  const { access, locale, t } = context;

  return (
    <AdminShell context={context} pathname="/admin/cabang/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Cabang"), url: "/admin/cabang" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Cabang") })} />}>
        <ResourceForm mode="create" endpoint="/admin/cabang/buat" blocks={branchFormBlocks(locale, access)} initial={BRANCH_DEFAULTS} cancelUrl="/admin/cabang" labels={formLabels(locale)} />
      </FiPage>
    </AdminShell>
  );
}
