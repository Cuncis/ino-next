import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { categoryFormBlocks, formLabels } from "@/server/admin/catalog-form-specs";
import { CATALOG_PERMISSIONS, findCategory } from "@/server/admin/catalog-records";
import { deletionActions } from "@/server/admin/list-labels";
import { FormHeaderButtons, ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Ubah Kategori - Inofarma" };

/** GET /admin/kategori/{id}/edit: EditCategory, with Hapus (or Hapus selamanya / Pulihkan) under the form. */
export default async function Page({ params }: PageProps<"/admin/kategori/[id]/edit">) {
  const context = await adminContext((access) => authorizes(access, CATALOG_PERMISSIONS, "update"));
  const { access, locale, t } = context;
  const record = await findCategory(Number((await params).id));

  if (!record) {
    notFound();
  }

  const labels = formLabels(locale);
  const deleted = record.deletedAt !== null;

  return (
    <AdminShell context={context} pathname={`/admin/kategori/${record.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Kategori"), url: "/admin/kategori" }, { label: record.name, url: `/admin/kategori/${record.id}/edit` }, { label: t("Ubah") }]}
            heading={t("Ubah :label", { label: record.name })}
            actions={<FormHeaderButtons cancelUrl="/admin/kategori" labels={{ cancel: labels.cancel, save: labels.save }} />}
          />
        }
      >
        <ResourceForm
          mode="edit"
          endpoint={`/admin/kategori/${record.id}/simpan`}
          blocks={categoryFormBlocks(locale)}
          initial={{ name: record.name, slug: record.slug, status: record.status, description: record.description ?? "" }}
          pageActions={
            authorizes(access, CATALOG_PERMISSIONS, "delete")
              ? deletionActions(
                  locale,
                  t("Kategori"),
                  deleted ? { forceDelete: `/admin/kategori/${record.id}/hapus-permanen`, restore: `/admin/kategori/${record.id}/pulihkan` } : { delete: `/admin/kategori/${record.id}/hapus` },
                  false,
                )
              : []
          }
          cancelUrl="/admin/kategori"
          labels={labels}
        />
      </FiPage>
    </AdminShell>
  );
}
