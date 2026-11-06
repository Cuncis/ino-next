import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { staffFormBlocks } from "@/server/admin/access-form-specs";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { deletionActions } from "@/server/admin/list-labels";
import { findStaffAccount, staffRoleIds } from "@/server/admin/staff-accounts";
import { FormHeaderButtons, ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Ubah Staf - Inofarma" };

/** GET /admin/staf/{id}/edit: EditStaff; the password fields start empty and only a typed one is saved. */
export default async function Page({ params }: PageProps<"/admin/staf/[id]/edit">) {
  const context = await adminContext((access) => can(access, "Pengaturan:Ubah"));
  const { locale, t } = context;
  const record = await findStaffAccount(Number((await params).id));

  if (!record) {
    notFound();
  }

  const labels = formLabels(locale);
  const deleted = record.deletedAt !== null;

  return (
    <AdminShell context={context} pathname={`/admin/staf/${record.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Staf"), url: "/admin/staf" }, { label: record.name, url: `/admin/staf/${record.id}/edit` }, { label: t("Ubah") }]}
            heading={t("Ubah :label", { label: record.name })}
            actions={<FormHeaderButtons cancelUrl="/admin/staf" labels={{ cancel: labels.cancel, save: labels.save }} />}
          />
        }
      >
        <ResourceForm
          mode="edit"
          endpoint={`/admin/staf/${record.id}/simpan`}
          blocks={await staffFormBlocks(locale, "edit")}
          initial={{
            name: record.name,
            email: record.email,
            phone: record.phone ?? "",
            branch_id: record.branchId === null ? "" : String(record.branchId),
            password: "",
            password_confirmation: "",
            is_active: record.isActive ? "1" : "0",
            roles: await staffRoleIds(record.id),
          }}
          pageActions={deletionActions(locale, t("Staf"), deleted ? { forceDelete: `/admin/staf/${record.id}/hapus-permanen`, restore: `/admin/staf/${record.id}/pulihkan` } : { delete: `/admin/staf/${record.id}/hapus` }, false)}
          cancelUrl="/admin/staf"
          labels={labels}
        />
      </FiPage>
    </AdminShell>
  );
}
