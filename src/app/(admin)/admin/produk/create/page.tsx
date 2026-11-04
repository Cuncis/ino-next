import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { formLabels, PRODUCT_DEFAULTS, productFormBlocks } from "@/server/admin/catalog-form-specs";
import { PRODUCT_PERMISSIONS } from "@/server/admin/products";
import { ResourceForm } from "@/views/admin/ResourceForm";

export const metadata: Metadata = { title: "Buat Produk - Inofarma" };

/** GET /admin/produk/create: CreateProduct, with the photos section. */
export default async function Page() {
  const context = await adminContext((access) => authorizes(access, PRODUCT_PERMISSIONS, "create"));
  const { locale, t } = context;
  const label = t("Produk");

  return (
    <AdminShell context={context} pathname="/admin/produk/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Produk"), url: "/admin/produk" }, { label: t("Buat") }]} heading={t("Buat :label", { label })} />}>
        <ResourceForm
          mode="create"
          endpoint="/admin/produk/buat"
          blocks={await productFormBlocks(locale, "create")}
          initial={{ name: "", category_id: "", supplier_id: "", unit: "", status: "", price: "", old_price: "", blurb: "", ...PRODUCT_DEFAULTS }}
          cancelUrl="/admin/produk"
          labels={formLabels(locale)}
        />
      </FiPage>
    </AdminShell>
  );
}
