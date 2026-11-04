import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { formLabels } from "@/server/admin/catalog-form-specs";
import { TRANSFER_PERMISSIONS, transferFormOptions } from "@/server/admin/finance-transfers";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Transfer - Inofarma" };

/** GET /admin/inventaris/transfer/create: CreateStockTransfer (a request; nothing moves yet). */
export default async function Page() {
  const context = await adminContext((access) => authorizes(access, TRANSFER_PERMISSIONS, "create"));
  const { locale, t } = context;
  const choices = await transferFormOptions();

  return (
    <AdminShell context={context} pathname="/admin/inventaris/transfer/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Transfer"), url: "/admin/inventaris/transfer" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Transfer") })} />}>
        <ResourceForm
          mode="create"
          endpoint="/admin/inventaris/transfer/buat"
          blocks={[
            {
              columns: 2,
              fields: [
                { kind: "searchable", name: "from_branch_id", label: t("Cabang Asal"), required: true, options: choices.branches },
                { kind: "searchable", name: "to_branch_id", label: t("Cabang Tujuan"), required: true, options: choices.branches },
                { kind: "searchable", name: "product_id", label: t("Produk"), required: true, options: choices.products },
                { kind: "number", name: "quantity", label: t("Jumlah"), required: true, integer: true, min: 1, max: 100000 },
                { kind: "textarea", name: "note", label: t("Catatan"), maxLength: 255, full: true },
              ],
            },
          ]}
          initial={{ from_branch_id: "", to_branch_id: "", product_id: "", quantity: "", note: "" }}
          cancelUrl="/admin/inventaris/transfer"
          labels={formLabels(locale)}
        />
      </FiPage>
    </AdminShell>
  );
}
