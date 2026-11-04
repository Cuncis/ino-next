import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiBadgeEntry, FiGrid, FiGridCol, FiRepeatableEntry, FiSection, FiTextEntry } from "@/components/admin/filament/Schema";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { rupiah } from "@/lib/money";
import { can } from "@/lib/permissions";
import { findInvoice, invoiceStatus, invoiceStatusColor } from "@/server/admin/finance-transfers";
import { adminDate } from "@/server/admin/list-labels";

export const metadata: Metadata = { title: "Lihat Faktur - Inofarma" };

const ucfirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** GET /admin/faktur/{id}: ViewInvoice, with "Catat Refund" for a paid one. */
export default async function Page({ params }: PageProps<"/admin/faktur/[id]">) {
  const context = await adminContext((access) => can(access, "Pesanan:Lihat"));
  const { staff, access, locale, t } = context;
  const invoice = await findInvoice(Number((await params).id), staff);

  if (!invoice) {
    notFound();
  }

  const status = invoiceStatus(invoice);
  const refund =
    invoice.paymentStatus === "lunas" && can(access, "Pesanan:Refund")
      ? [
          {
            key: "refund",
            label: t("Catat Refund"),
            icon: "o-arrow-uturn-left",
            color: "danger" as const,
            endpoint: `/admin/faktur/${invoice.id}/refund`,
            form: {
              heading: t("Catat Refund"),
              fields: [{ kind: "textarea" as const, name: "note", label: t("Catatan"), required: true, maxLength: 500 }],
              submitLabel: t("Kirim"),
              cancelLabel: t("Batal"),
            },
          },
        ]
      : [];

  return (
    <AdminShell context={context} pathname={`/admin/faktur/${invoice.id}`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Faktur"), url: "/admin/faktur" }, { label: invoice.number, url: `/admin/faktur/${invoice.id}` }, { label: t("Lihat") }]}
            heading={t("Lihat :label", { label: invoice.number })}
            actions={refund.length ? <FiHeaderActions actions={refund} labels={{ close: t("Tutup"), cancel: t("Batal") }} /> : null}
          />
        }
      >
        <FiGrid>
          <FiGridCol>
            <FiGrid lg={2}>
              <FiGridCol>
                <FiSection id="infolist.faktur" heading={t("Faktur")}>
                  <FiGridCol>
                    <div>
                      <FiGrid lg={3}>
                        <FiGridCol>
                          <FiTextEntry label={t("Nomor")} value={invoice.number} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Pelanggan")} value={invoice.customerName} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Cabang")} value={invoice.branchName} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Diterbitkan")} value={adminDate(invoice.createdAt, locale)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Jatuh Tempo")} value={adminDate(invoice.expiresAt, locale)} placeholder="—" />
                        </FiGridCol>
                        <FiGridCol>
                          <FiBadgeEntry label={t("Status")} value={t(status)} color={invoiceStatusColor(status)} />
                        </FiGridCol>
                      </FiGrid>
                    </div>
                  </FiGridCol>
                </FiSection>
              </FiGridCol>
              <FiGridCol>
                <FiSection id="infolist.rincian" heading={t("Rincian")}>
                  <FiGridCol>
                    <FiRepeatableEntry
                      label={t("Item")}
                      columns={3}
                      items={invoice.items.map((item) => (
                        <>
                          <FiGridCol>
                            <FiTextEntry label={t("Produk")} value={item.productName} />
                          </FiGridCol>
                          <FiGridCol>
                            <FiTextEntry label={t("Qty")} value={String(item.quantity)} />
                          </FiGridCol>
                          <FiGridCol>
                            <FiTextEntry label={t("Harga")} value={rupiah(item.unitPrice)} />
                          </FiGridCol>
                        </>
                      ))}
                    />
                  </FiGridCol>
                  <FiGridCol>
                    <div>
                      <FiGrid lg={4}>
                        <FiGridCol>
                          <FiTextEntry label="Subtotal" value={rupiah(invoice.subtotal)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Diskon")} value={rupiah(invoice.discountTotal)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Ongkir")} value={rupiah(invoice.shippingTotal)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Pajak")} value={rupiah(invoice.taxTotal)} />
                        </FiGridCol>
                      </FiGrid>
                    </div>
                  </FiGridCol>
                  <FiGridCol>
                    <FiTextEntry label={t("Total")} value={rupiah(invoice.grandTotal)} weight="bold" />
                  </FiGridCol>
                </FiSection>
              </FiGridCol>
              {invoice.payments.length ? (
                <FiGridCol>
                  <FiSection id="infolist.riwayat-pembayaran" heading={t("Riwayat Pembayaran")}>
                    <FiGridCol>
                      <FiRepeatableEntry
                        // RepeatableEntry::make('payments')->label('') falls back to its name
                        label="Payments"
                        columns={3}
                        items={invoice.payments.map((payment) => (
                          <>
                            <FiGridCol>
                              <FiTextEntry label={t("No. Invoice")} value={payment.invoiceNumber} />
                            </FiGridCol>
                            <FiGridCol>
                              <FiBadgeEntry label={t("Status")} value={t(ucfirst(payment.status))} color="gray" />
                            </FiGridCol>
                            <FiGridCol>
                              <FiTextEntry label={t("Kanal")} value={payment.channel} />
                            </FiGridCol>
                            <FiGridCol>
                              <FiTextEntry label={t("Jumlah")} value={rupiah(payment.amount)} />
                            </FiGridCol>
                            <FiGridCol>
                              <FiTextEntry label={t("Dibuat")} value={adminDate(payment.createdAt, locale, true)} />
                            </FiGridCol>
                            <FiGridCol>
                              <FiTextEntry label={t("Dibayar")} value={adminDate(payment.paidAt, locale, true)} placeholder="—" />
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
