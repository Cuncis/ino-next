import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { customerFormBlocks } from "@/server/admin/crm-form-specs";
import { customerAddress, CUSTOMER_PERMISSIONS, findCustomer } from "@/server/admin/customers";
import { deletionActions } from "@/server/admin/list-labels";
import { FormHeaderButtons, ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Ubah Pelanggan - Inofarma" };

/** GET /admin/pelanggan/{id}/edit: EditCustomer, the city and address from the default address. */
export default async function Page({ params }: PageProps<"/admin/pelanggan/[id]/edit">) {
  const context = await adminContext((access) => authorizes(access, CUSTOMER_PERMISSIONS, "update"));
  const { staff, access, locale, t } = context;
  const record = await findCustomer(Number((await params).id), staff);

  if (!record) {
    notFound();
  }

  const address = await customerAddress(record.id);
  const labels = formLabels(locale);
  const deleted = record.deletedAt !== null;

  return (
    <AdminShell context={context} pathname={`/admin/pelanggan/${record.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Pelanggan"), url: "/admin/pelanggan" }, { label: record.name, url: `/admin/pelanggan/${record.id}/edit` }, { label: t("Ubah") }]}
            heading={t("Ubah :label", { label: record.name })}
            actions={<FormHeaderButtons cancelUrl="/admin/pelanggan" labels={{ cancel: labels.cancel, save: labels.save }} />}
          />
        }
      >
        <ResourceForm
          mode="edit"
          endpoint={`/admin/pelanggan/${record.id}/simpan`}
          blocks={customerFormBlocks(locale)}
          initial={{ name: record.name, email: record.email, phone: record.phone ?? "", city: address?.kota ?? "", status: record.status, address: address?.addressLine ?? "" }}
          pageActions={
            authorizes(access, CUSTOMER_PERMISSIONS, "delete")
              ? deletionActions(
                  locale,
                  t("Pelanggan"),
                  deleted ? { forceDelete: `/admin/pelanggan/${record.id}/hapus-permanen`, restore: `/admin/pelanggan/${record.id}/pulihkan` } : { delete: `/admin/pelanggan/${record.id}/hapus` },
                  false,
                )
              : []
          }
          cancelUrl="/admin/pelanggan"
          labels={labels}
        />
      </FiPage>
    </AdminShell>
  );
}
