import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { attributeFormBlocks, formLabels } from "@/server/admin/catalog-form-specs";
import { CATALOG_PERMISSIONS, findAttribute } from "@/server/admin/catalog-records";
import { deletionActions } from "@/server/admin/list-labels";
import { FormHeaderButtons, ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Ubah Atribut - Inofarma" };

/** GET /admin/atribut/{id}/edit: EditAttribute, with Hapus (or Hapus selamanya / Pulihkan) under the form. */
export default async function Page({ params }: PageProps<"/admin/atribut/[id]/edit">) {
  const context = await adminContext((access) => authorizes(access, CATALOG_PERMISSIONS, "update"));
  const { access, locale, t } = context;
  const record = await findAttribute(Number((await params).id));

  if (!record) {
    notFound();
  }

  const labels = formLabels(locale);
  const deleted = record.deletedAt !== null;

  return (
    <AdminShell context={context} pathname={`/admin/atribut/${record.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Atribut"), url: "/admin/atribut" }, { label: record.name, url: `/admin/atribut/${record.id}/edit` }, { label: t("Ubah") }]}
            heading={t("Ubah :label", { label: record.name })}
            actions={<FormHeaderButtons cancelUrl="/admin/atribut" labels={{ cancel: labels.cancel, save: labels.save }} />}
          />
        }
      >
        <ResourceForm
          mode="edit"
          endpoint={`/admin/atribut/${record.id}/simpan`}
          blocks={attributeFormBlocks(locale)}
          initial={{ name: record.name, type: record.type, values: Array.isArray(record.values) ? (record.values as string[]) : [] }}
          pageActions={
            authorizes(access, CATALOG_PERMISSIONS, "delete")
              ? deletionActions(
                  locale,
                  t("Atribut"),
                  deleted ? { forceDelete: `/admin/atribut/${record.id}/hapus-permanen`, restore: `/admin/atribut/${record.id}/pulihkan` } : { delete: `/admin/atribut/${record.id}/hapus` },
                  false,
                )
              : []
          }
          cancelUrl="/admin/atribut"
          labels={labels}
        />
      </FiPage>
    </AdminShell>
  );
}
