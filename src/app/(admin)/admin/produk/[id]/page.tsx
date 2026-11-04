import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiBadgeEntry, FiGrid, FiGridCol, FiRepeatableEntry, FiSection, FiTextEntry } from "@/components/admin/filament/Schema";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { DRUG_CLASSES, PRODUCT_STATUSES, toLabel } from "@/lib/admin-options";
import { rupiah } from "@/lib/money";
import { authorizes } from "@/lib/permissions";
import { productImagesSpec } from "@/server/admin/product-images-table";
import { findAdminProduct, PRODUCT_PERMISSIONS, productDetail } from "@/server/admin/products";
import { ProductImagesTable } from "@/views/admin/ProductImagesTable";

export const metadata: Metadata = { title: "Lihat Produk - Inofarma" };

/**
 * GET /admin/produk/{id}: ViewProduct. The product's details, its photos (the Gambar
 * table, read-only here), and its stock per branch when it has any.
 */
export default async function Page({ params }: PageProps<"/admin/produk/[id]">) {
  const context = await adminContext((access) => authorizes(access, PRODUCT_PERMISSIONS, "view"));
  const { staff, access, locale, t } = context;
  const product = await findAdminProduct(Number((await params).id));

  if (!product) {
    notFound();
  }

  const detail = await productDetail(product, staff);
  const drugClass = toLabel(DRUG_CLASSES, product.drugClass);

  return (
    <AdminShell context={context} pathname={`/admin/produk/${product.id}`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Produk"), url: "/admin/produk" }, { label: product.name, url: `/admin/produk/${product.id}` }, { label: t("Lihat") }]}
            heading={t("Lihat :label", { label: product.name })}
            actions={
              authorizes(access, PRODUCT_PERMISSIONS, "update") ? (
                <FiHeaderActions actions={[{ key: "edit", label: t("Ubah"), icon: "", href: `/admin/produk/${product.id}/edit` }]} labels={{ close: t("Tutup"), cancel: t("Batal") }} />
              ) : null
            }
          />
        }
      >
        <FiGrid>
          <FiGridCol>
            <FiGrid lg={2}>
              <FiGridCol span="full">
                <FiSection id="infolist.produk" heading={t("Produk")}>
                  <FiGridCol>
                    <div>
                      <FiGrid lg={3}>
                        <FiGridCol>
                          <FiTextEntry label={t("SKU")} value={product.sku} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Nama")} value={product.name} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Kategori")} value={detail.categoryName} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Penjual")} value={detail.supplierName} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Harga")} value={rupiah(product.price)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Terjual")} value={String(product.soldCount)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiBadgeEntry label={t("Status")} value={t(toLabel(PRODUCT_STATUSES, product.status) ?? product.status)} color="gray" />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Golongan Obat")} value={drugClass ? t(drugClass) : "—"} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Wajib Label Peringatan")} value={product.drugClass === "bebas terbatas" ? t("Ya") : t("Tidak")} />
                        </FiGridCol>
                      </FiGrid>
                    </div>
                  </FiGridCol>
                </FiSection>
              </FiGridCol>
              <FiGridCol span="full">
                <ProductImagesTable spec={productImagesSpec(locale, access, product.id, detail.images, "view")} />
              </FiGridCol>
              {detail.stocks.length ? (
                <FiGridCol span="full">
                  <FiSection id="infolist.stok-per-cabang" heading={t("Stok per Cabang")}>
                    <FiGridCol>
                      <FiRepeatableEntry
                        // RepeatableEntry::make('stocks')->label('') falls back to its name
                        label="Stocks"
                        columns={4}
                        items={detail.stocks.map((stock) => (
                          <>
                            <FiGridCol>
                              <FiTextEntry label={t("Cabang")} value={stock.branchName} />
                            </FiGridCol>
                            <FiGridCol>
                              <FiTextEntry label={t("Jumlah")} value={String(stock.quantity)} />
                            </FiGridCol>
                            <FiGridCol>
                              <FiTextEntry label={t("Dipesan")} value={String(stock.reserved)} />
                            </FiGridCol>
                            <FiGridCol>
                              <FiTextEntry label={t("Tersedia")} value={String(stock.available)} />
                            </FiGridCol>
                          </>
                        ))}
                      />
                    </FiGridCol>
                  </FiSection>
                </FiGridCol>
              ) : null}
            </FiGrid>
          </FiGridCol>
        </FiGrid>
      </FiPage>
    </AdminShell>
  );
}
