import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import type { ListAction } from "@/components/admin/filament/ListTable";
import { FiBadgeEntry, FiGrid, FiGridCol, FiRepeatableEntry, FiSection, FiTextEntry } from "@/components/admin/filament/Schema";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { FULFILMENTS, fulfilmentStageFor, PAYMENT_STATUSES, SHIPMENT_STATUSES, toLabel } from "@/lib/admin-options";
import { rupiah } from "@/lib/money";
import { adminDate } from "@/server/admin/list-labels";
import { authorizes, findAdminOrder, ORDER_PERMISSIONS, orderDetail, orderStatusColor, paymentStatusColor, shipmentStatusColor, visibleOrderActions, type OrderActionKey } from "@/server/admin/orders";

export async function generateMetadata({ params }: PageProps<"/admin/pesanan/[id]">): Promise<Metadata> {
  return { title: `Lihat ${(await params).id} - Inofarma` };
}

/** GET /admin/pesanan/{id}: ViewOrder with OrderInfolist and its header actions. */
export default async function Page({ params }: PageProps<"/admin/pesanan/[id]">) {
  const context = await adminContext((access) => authorizes(access, ORDER_PERMISSIONS, "view"));
  const { staff, access, locale, t } = context;
  const order = await findAdminOrder(Number((await params).id), staff);

  if (!order) {
    notFound();
  }

  const { customerName, branchName, items, shipment } = await orderDetail(order);
  const close = { close: t("Tutup"), cancel: t("Batal") };
  const endpoint = (key: OrderActionKey) => `/admin/pesanan/${order.id}/aksi/${key}`;
  const confirm = (heading: string, description: string, color: "primary" | "danger" = "primary") => ({ heading, description, submitLabel: t("Konfirmasi"), color });
  const definitions: Record<OrderActionKey, ListAction> = {
    markPaid: { key: "markPaid", label: t("Tandai Lunas"), icon: "o-banknotes", endpoint: endpoint("markPaid"), confirm: confirm(t("Tandai Lunas"), t("Pastikan pembayaran pesanan ini sudah benar-benar diterima.")) },
    markReadyToShip: { key: "markReadyToShip", label: t("Tandai Sedang Diproses"), icon: "o-archive-box", endpoint: endpoint("markReadyToShip") },
    markReady: { key: "markReady", label: t("Tandai Sedang Diproses"), icon: "o-archive-box", endpoint: endpoint("markReady") },
    ship: { key: "ship", label: t("Tandai Terpenuhi"), icon: "o-truck", endpoint: endpoint("ship"), confirm: confirm(t("Tandai Terpenuhi"), t("Resi akan dibuat di kurir dan pesanan berstatus Dikirim untuk pelanggan.")) },
    handOver: {
      key: "handOver",
      label: t("Tandai Terpenuhi"),
      icon: "o-check-badge",
      endpoint: endpoint("handOver"),
      form: { heading: t("Tandai Terpenuhi"), fields: [{ kind: "text", name: "code", label: t("Kode Ambil"), required: true, maxLength: 10 }], submitLabel: t("Kirim"), cancelLabel: t("Batal") },
    },
    cancel: {
      key: "cancel",
      label: t("Batalkan Pesanan"),
      icon: "o-x-circle",
      color: "danger",
      endpoint: endpoint("cancel"),
      confirm: confirm(t("Batalkan Pesanan"), t("Stok dikembalikan ke cabang. Pesanan yang sudah lunas perlu dicatat refund-nya di Faktur."), "danger"),
    },
    checkShipmentStatus: { key: "checkShipmentStatus", label: t("Cek Status Kirim"), icon: "o-arrow-path", endpoint: endpoint("checkShipmentStatus") },
  };
  const actions = visibleOrderActions(order, shipment, access).map((key) => definitions[key]);
  const money = (amount: number) => rupiah(amount);

  return (
    <AdminShell context={context} pathname={`/admin/pesanan/${order.id}`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Pesanan"), url: "/admin/pesanan" }, { label: order.number, url: `/admin/pesanan/${order.id}` }, { label: t("Lihat") }]}
            heading={`${t("Lihat")} ${order.number}`}
            actions={actions.length ? <FiHeaderActions actions={actions} labels={close} /> : null}
          />
        }
      >
        <FiGrid>
          <FiGridCol>
            <FiGrid lg={2}>
              <FiGridCol>
                <FiSection id="infolist.ringkasan" heading={t("Ringkasan")}>
                  <FiGridCol>
                    <div>
                      <FiGrid lg={3}>
                        <FiGridCol>
                          <FiTextEntry label={t("No. Pesanan")} value={order.number} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Pelanggan")} value={customerName} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Cabang")} value={branchName} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Cara Terima")} value={t(toLabel(FULFILMENTS, order.fulfilment) ?? "")} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Pembayaran")} value={order.paymentMethod ? t(order.paymentMethod) : null} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiBadgeEntry label={t("Status Bayar")} value={t(toLabel(PAYMENT_STATUSES, order.paymentStatus) ?? order.paymentStatus)} color={paymentStatusColor(order.paymentStatus)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiBadgeEntry label={t("Status Pemenuhan")} value={t(fulfilmentStageFor(order.status) ?? "")} color={orderStatusColor(order.status)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Tanggal")} value={adminDate(order.createdAt, locale)} />
                        </FiGridCol>
                        <FiGridCol span={2}>
                          <FiTextEntry label={t("Catatan")} value={order.note} placeholder="—" />
                        </FiGridCol>
                      </FiGrid>
                    </div>
                  </FiGridCol>
                </FiSection>
              </FiGridCol>
              <FiGridCol>
                <FiSection id="infolist.item-pesanan" heading={t("Item Pesanan")}>
                  <FiGridCol>
                    <FiRepeatableEntry
                      label={locale === "en" ? "Items" : "Items"}
                      columns={4}
                      items={items.map((item) => (
                        <>
                          <FiGridCol>
                            <FiTextEntry label={t("Produk")} value={item.productName} />
                          </FiGridCol>
                          <FiGridCol>
                            <FiTextEntry label={t("Qty")} value={String(item.quantity)} />
                          </FiGridCol>
                          <FiGridCol>
                            <FiTextEntry label={t("Harga")} value={money(item.unitPrice)} />
                          </FiGridCol>
                          <FiGridCol>
                            <FiTextEntry label={t("Subtotal")} value={money(item.lineTotal)} />
                          </FiGridCol>
                        </>
                      ))}
                    />
                  </FiGridCol>
                  <FiGridCol>
                    <div>
                      <FiGrid lg={3}>
                        <FiGridCol>
                          <FiTextEntry label={t("Subtotal")} value={money(order.subtotal)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Ongkos Kirim")} value={money(order.shippingTotal)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Total")} value={money(order.grandTotal)} weight="bold" />
                        </FiGridCol>
                      </FiGrid>
                    </div>
                  </FiGridCol>
                </FiSection>
              </FiGridCol>
              {order.fulfilment === "antar" && shipment ? (
                <FiGridCol>
                  <FiSection id="infolist.pengiriman" heading={t("Pengiriman")}>
                    <FiGridCol>
                      <div>
                        <FiGrid lg={3}>
                          <FiGridCol>
                            <FiTextEntry label={t("Kurir")} value={shipment.courierName} placeholder="—" />
                          </FiGridCol>
                          <FiGridCol>
                            <FiTextEntry label={t("Layanan")} value={shipment.courierServiceName} placeholder="—" />
                          </FiGridCol>
                          <FiGridCol>
                            <FiTextEntry label={t("No. Resi")} value={shipment.waybillId} placeholder={t("Belum dibuat")} />
                          </FiGridCol>
                          <FiGridCol>
                            <FiBadgeEntry
                              label={t("Status Kirim")}
                              value={shipment.status ? (toLabel(SHIPMENT_STATUSES, shipment.status) ? t(toLabel(SHIPMENT_STATUSES, shipment.status)!) : shipment.status) : null}
                              color={shipmentStatusColor(shipment.status ?? "")}
                              placeholder="—"
                            />
                          </FiGridCol>
                        </FiGrid>
                      </div>
                    </FiGridCol>
                  </FiSection>
                </FiGridCol>
              ) : null}
              {order.fulfilment === "ambil" ? (
                <FiGridCol>
                  <FiSection id="infolist.pengambilan" heading={t("Pengambilan")}>
                    <FiGridCol>
                      <div>
                        <FiGrid lg={3}>
                          <FiGridCol>
                            <FiTextEntry label={t("Kode Ambil")} value={order.pickupCode} placeholder={t("Belum diterbitkan")} />
                          </FiGridCol>
                          <FiGridCol>
                            <FiTextEntry label={t("Berlaku Sampai")} value={adminDate(order.pickupCodeExpiresAt, locale, true)} placeholder="—" />
                          </FiGridCol>
                          <FiGridCol>
                            <FiTextEntry label={t("Diambil Pada")} value={adminDate(order.pickedUpAt, locale, true)} placeholder={t("Belum diambil")} />
                          </FiGridCol>
                        </FiGrid>
                      </div>
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
