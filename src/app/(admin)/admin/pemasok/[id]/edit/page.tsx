import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { supplierFormBlocks, formLabels } from "@/server/admin/catalog-form-specs";
import { CATALOG_PERMISSIONS, findSupplier, supplierProductCount } from "@/server/admin/catalog-records";
import { deletionActions } from "@/server/admin/list-labels";
import { FormHeaderButtons, ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Ubah Pemasok - Inofarma" };

/** GET /admin/pemasok/{id}/edit: EditSupplier, with Hapus (or Hapus selamanya / Pulihkan) under the form. */
export default async function Page({ params }: PageProps<"/admin/pemasok/[id]/edit">) {
  const context = await adminContext((access) => authorizes(access, CATALOG_PERMISSIONS, "update"));
  const { access, locale, t } = context;
  const record = await findSupplier(Number((await params).id));

  if (!record) {
    notFound();
  }

  const labels = formLabels(locale);
  const deleted = record.deletedAt !== null;

  return (
    <AdminShell context={context} pathname={`/admin/pemasok/${record.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Pemasok"), url: "/admin/pemasok" }, { label: record.name, url: `/admin/pemasok/${record.id}/edit` }, { label: t("Ubah") }]}
            heading={t("Ubah :label", { label: record.name })}
            actions={<FormHeaderButtons cancelUrl="/admin/pemasok" labels={{ cancel: labels.cancel, save: labels.save }} />}
          />
        }
      >
        <ResourceForm
          mode="edit"
          endpoint={`/admin/pemasok/${record.id}/simpan`}
          blocks={supplierFormBlocks(locale, await supplierProductCount(record.id))}
          initial={{ name: record.name, contact_person: record.contactPerson ?? "", email: record.email ?? "", phone: record.phone ?? "", license_number: record.licenseNumber ?? "", kota: record.kota ?? "", status: record.status, address_line: record.addressLine ?? "" }}
          pageActions={
            authorizes(access, CATALOG_PERMISSIONS, "delete")
              ? deletionActions(
                  locale,
                  t("Pemasok"),
                  deleted ? { forceDelete: `/admin/pemasok/${record.id}/hapus-permanen`, restore: `/admin/pemasok/${record.id}/pulihkan` } : { delete: `/admin/pemasok/${record.id}/hapus` },
                  false,
                )
              : []
          }
          cancelUrl="/admin/pemasok"
          labels={labels}
        />
      </FiPage>
    </AdminShell>
  );
}
