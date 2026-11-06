import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { branchFormBlocks } from "@/server/admin/access-form-specs";
import { BRANCH_PERMISSIONS, findBranch } from "@/server/admin/branches";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { deletionActions } from "@/server/admin/list-labels";
import { storefrontImage } from "@/server/shop/content/image-url";
import { FormHeaderButtons, ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Ubah Cabang - Inofarma" };

/** A stored decimal as the number input shows it (Livewire hands it over as a number). */
const decimal = (value: string | null) => (value === null ? "" : String(Number(value)));

/** GET /admin/cabang/{id}/edit: EditBranch. */
export default async function Page({ params }: PageProps<"/admin/cabang/[id]/edit">) {
  const context = await adminContext((access) => authorizes(access, BRANCH_PERMISSIONS, "update"));
  const { access, locale, t } = context;
  const record = await findBranch(Number((await params).id));

  if (!record) {
    notFound();
  }

  const labels = formLabels(locale);
  const deleted = record.deletedAt !== null;

  return (
    <AdminShell context={context} pathname={`/admin/cabang/${record.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Cabang"), url: "/admin/cabang" }, { label: record.name, url: `/admin/cabang/${record.id}/edit` }, { label: t("Ubah") }]}
            heading={t("Ubah :label", { label: record.name })}
            actions={<FormHeaderButtons cancelUrl="/admin/cabang" labels={{ cancel: labels.cancel, save: labels.save }} />}
          />
        }
      >
        <ResourceForm
          mode="edit"
          endpoint={`/admin/cabang/${record.id}/simpan`}
          blocks={branchFormBlocks(locale, access, record.photoPath ? { url: storefrontImage(record.photoPath) } : null)}
          initial={{
            name: record.name,
            status: record.status,
            phone: record.phone ?? "",
            whatsapp: record.whatsapp ?? "",
            address_line: record.addressLine,
            kelurahan: record.kelurahan ?? "",
            kecamatan: record.kecamatan ?? "",
            kota: record.kota,
            provinsi: record.provinsi,
            postal_code: record.postalCode ?? "",
            latitude: decimal(record.latitude),
            longitude: decimal(record.longitude),
            sia_number: record.siaNumber ?? "",
            apj_name: record.apjName ?? "",
            apj_sipa_number: record.apjSipaNumber ?? "",
            practice_schedule: record.practiceSchedule ?? "",
            store_schedule: record.storeSchedule ?? "",
            supports_delivery: record.supportsDelivery ? "1" : "0",
            supports_pickup: record.supportsPickup ? "1" : "0",
            delivery_radius_km: String(record.deliveryRadiusKm),
          }}
          pageActions={
            authorizes(access, BRANCH_PERMISSIONS, "delete")
              ? deletionActions(locale, t("Cabang"), deleted ? { forceDelete: `/admin/cabang/${record.id}/hapus-permanen`, restore: `/admin/cabang/${record.id}/pulihkan` } : { delete: `/admin/cabang/${record.id}/hapus` }, false)
              : []
          }
          cancelUrl="/admin/cabang"
          labels={labels}
        />
      </FiPage>
    </AdminShell>
  );
}
