import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import type { ListAction } from "@/components/admin/filament/ListTable";
import { FiBadgeEntry, FiGrid, FiGridCol, FiSection, FiTextEntry } from "@/components/admin/filament/Schema";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { STOCK_TRANSFER_STATUSES, toLabel } from "@/lib/admin-options";
import { authorizes, can } from "@/lib/permissions";
import { findTransfer, TRANSFER_PERMISSIONS } from "@/server/admin/finance-transfers";
import { adminDate } from "@/server/admin/list-labels";
import { canBeCancelled, canBeReceived, canBeShipped } from "@/server/inventory/stock-transfers";

export const metadata: Metadata = { title: "Lihat Transfer - Inofarma" };

/**
 * GET /admin/inventaris/transfer/{id}: ViewStockTransfer. Kirim and Batalkan belong to
 * the origin's side, Terima to the destination's (central staff are on both).
 */
export default async function Page({ params }: PageProps<"/admin/inventaris/transfer/[id]">) {
  const context = await adminContext((access) => authorizes(access, TRANSFER_PERMISSIONS, "view"));
  const { staff, access, locale, t } = context;
  const transfer = await findTransfer(Number((await params).id), staff);

  if (!transfer) {
    notFound();
  }

  const onSide = (branchId: number) => staff.branchId === null || staff.branchId === branchId;
  const base = `/admin/inventaris/transfer/${transfer.id}`;
  const actions: ListAction[] = [
    ...(canBeShipped(transfer) && onSide(transfer.fromBranchId) && can(access, "Inventaris:Sesuaikan Stok") ? [{ key: "ship", label: t("Kirim"), icon: "o-truck", endpoint: `${base}/kirim` }] : []),
    ...(canBeReceived(transfer) && onSide(transfer.toBranchId) && can(access, "Inventaris:Terima Barang") ? [{ key: "receive", label: t("Terima"), icon: "o-inbox-arrow-down", endpoint: `${base}/terima` }] : []),
    ...(canBeCancelled(transfer) && onSide(transfer.fromBranchId) && can(access, "Inventaris:Sesuaikan Stok")
      ? [
          {
            key: "cancel",
            label: t("Batalkan"),
            icon: "o-x-circle",
            color: "danger" as const,
            endpoint: `${base}/batalkan`,
            confirm: { heading: t("Batalkan"), description: t("Apakah Anda yakin ingin melakukan ini?"), submitLabel: t("Konfirmasi"), color: "danger" as const },
          },
        ]
      : []),
  ];
  const dateTime = (date: Date | null) => adminDate(date, locale, true);

  return (
    <AdminShell context={context} pathname={base}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Transfer"), url: "/admin/inventaris/transfer" }, { label: transfer.code, url: base }, { label: t("Lihat") }]}
            heading={t("Lihat :label", { label: transfer.code })}
            actions={actions.length ? <FiHeaderActions actions={actions} labels={{ close: t("Tutup"), cancel: t("Batal") }} /> : null}
          />
        }
      >
        <FiGrid>
          <FiGridCol>
            <FiGrid lg={2}>
              <FiGridCol>
                <FiSection id="infolist.transfer" heading={t("Transfer")}>
                  <FiGridCol>
                    <div>
                      <FiGrid lg={3}>
                        <FiGridCol>
                          <FiTextEntry label={t("Kode")} value={transfer.code} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Dari")} value={transfer.fromName} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Ke")} value={transfer.toName} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Produk")} value={transfer.productName} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Jumlah")} value={String(transfer.quantity)} />
                        </FiGridCol>
                        <FiGridCol>
                          <FiBadgeEntry label={t("Status")} value={t(toLabel(STOCK_TRANSFER_STATUSES, transfer.status) ?? transfer.status)} color="gray" />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Diminta Oleh")} value={transfer.requestedByName} placeholder="—" />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Dikirim Pada")} value={dateTime(transfer.shippedAt)} placeholder="—" />
                        </FiGridCol>
                        <FiGridCol>
                          <FiTextEntry label={t("Diterima Pada")} value={dateTime(transfer.receivedAt)} placeholder="—" />
                        </FiGridCol>
                        <FiGridCol span="full">
                          <FiTextEntry label={t("Catatan")} value={transfer.note} placeholder="—" />
                        </FiGridCol>
                      </FiGrid>
                    </div>
                  </FiGridCol>
                </FiSection>
              </FiGridCol>
            </FiGrid>
          </FiGridCol>
        </FiGrid>
      </FiPage>
    </AdminShell>
  );
}
