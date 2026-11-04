import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { authorizes } from "@/lib/permissions";
import { formLabels, productFormBlocks } from "@/server/admin/catalog-form-specs";
import { deletionActions } from "@/server/admin/list-labels";
import { findAdminProduct, PRODUCT_PERMISSIONS, productPhotos } from "@/server/admin/products";
import { productImagesSpec } from "@/server/admin/product-images-table";
import { FormHeaderButtons, ResourceForm } from "@/views/admin/ResourceForm";
import { ProductImagesTable } from "@/views/admin/ProductImagesTable";

export const metadata: Metadata = { title: "Ubah Produk - Inofarma" };

/** GET /admin/produk/{id}/edit: EditProduct, then the Gambar relation manager. */
export default async function Page({ params }: PageProps<"/admin/produk/[id]/edit">) {
  const context = await adminContext((access) => authorizes(access, PRODUCT_PERMISSIONS, "update"));
  const { access, locale, t } = context;
  const product = await findAdminProduct(Number((await params).id));

  if (!product) {
    notFound();
  }

  const label = t("Produk");
  const labels = formLabels(locale);
  const canDelete = authorizes(access, PRODUCT_PERMISSIONS, "delete");
  const deleted = product.deletedAt !== null;

  return (
    <AdminShell context={context} pathname={`/admin/produk/${product.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Produk"), url: "/admin/produk" }, { label: product.name, url: `/admin/produk/${product.id}` }, { label: t("Ubah") }]}
            heading={t("Ubah :label", { label: product.name })}
            actions={
              <>
                <FiHeaderActions actions={[{ key: "view", label: t("Lihat"), icon: "", color: "gray", href: `/admin/produk/${product.id}` }]} labels={{ close: labels.close, cancel: labels.cancel }} />
                <FormHeaderButtons cancelUrl={`/admin/produk/${product.id}`} labels={{ cancel: labels.cancel, save: labels.save }} />
              </>
            }
          />
        }
      >
        <ResourceForm
          mode="edit"
          endpoint={`/admin/produk/${product.id}/simpan`}
          blocks={await productFormBlocks(locale, "edit")}
          initial={{
            name: product.name,
            category_id: String(product.categoryId),
            supplier_id: product.supplierId === null ? "" : String(product.supplierId),
            unit: product.unit,
            status: product.status,
            drug_class: product.drugClass,
            price: String(product.price),
            old_price: product.oldPrice === null ? "" : String(product.oldPrice),
            max_qty_per_order: product.maxQtyPerOrder === null ? "" : String(product.maxQtyPerOrder),
            blurb: product.blurb ?? "",
          }}
          pageActions={
            canDelete
              ? deletionActions(
                  locale,
                  label,
                  deleted ? { forceDelete: `/admin/produk/${product.id}/hapus-permanen`, restore: `/admin/produk/${product.id}/pulihkan` } : { delete: `/admin/produk/${product.id}/hapus` },
                  false,
                )
              : []
          }
          cancelUrl={`/admin/produk/${product.id}`}
          labels={labels}
          after={<ProductImagesTable spec={productImagesSpec(locale, access, product.id, await productPhotos(product.id), "edit")} />}
        />
      </FiPage>
    </AdminShell>
  );
}
