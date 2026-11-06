import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { roleFormBlocks } from "@/server/admin/access-form-specs";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { deletionActions } from "@/server/admin/list-labels";
import { findRole, rolePermissionIds } from "@/server/admin/roles";
import { FormHeaderButtons, ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Ubah Peran - Inofarma" };

/** GET /admin/peran/{id}/edit: EditRole. */
export default async function Page({ params }: PageProps<"/admin/peran/[id]/edit">) {
  const context = await adminContext((access) => can(access, "Peran:Lihat") && can(access, "Peran:Ubah"));
  const { locale, t } = context;
  const record = await findRole(Number((await params).id));

  if (!record) {
    notFound();
  }

  const labels = formLabels(locale);

  return (
    <AdminShell context={context} pathname={`/admin/peran/${record.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Peran"), url: "/admin/peran" }, { label: record.name, url: `/admin/peran/${record.id}/edit` }, { label: t("Ubah") }]}
            heading={t("Ubah :label", { label: record.name })}
            actions={<FormHeaderButtons cancelUrl="/admin/peran" labels={{ cancel: labels.cancel, save: labels.save }} />}
          />
        }
      >
        <ResourceForm
          mode="edit"
          endpoint={`/admin/peran/${record.id}/simpan`}
          blocks={await roleFormBlocks(locale)}
          initial={{ name: record.name, description: record.description ?? "", permissions: await rolePermissionIds(record.id) }}
          pageActions={deletionActions(locale, t("Peran"), { delete: `/admin/peran/${record.id}/hapus` }, false)}
          cancelUrl="/admin/peran"
          labels={labels}
        />
      </FiPage>
    </AdminShell>
  );
}
