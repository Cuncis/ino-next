import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { DateRangeFilters } from "@/components/admin/filament/DateRangeFilters";
import { FiTable, FiTextCell } from "@/components/admin/filament/Table";
import { FiBadge, FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { rupiah } from "@/lib/money";
import { dailyReconciliation, jakartaDay, reconciliationRange, shortDate, stockMatrix } from "@/server/admin/dashboard";

export const metadata: Metadata = { title: "Dasbor - Inofarma" };

/** GET /admin: Filament's dashboard with the app's two widgets. */
export default async function Page({ searchParams }: PageProps<"/admin">) {
  const context = await adminContext();
  const { staff, locale, t } = context;
  const query = await searchParams;
  const range = reconciliationRange(query.dari, query.sampai);
  const [daily, matrix] = await Promise.all([dailyReconciliation(range, staff), stockMatrix(staff)]);
  const total = daily.reduce((sum, row) => sum + row.total, 0);

  return (
    <AdminShell context={context} pathname="/admin">
      <FiPage header={<FiPageHeader heading={t("Dasbor")} />}>
        <div className="fi-grid fi-sc fi-sc-has-gap" style={{ "--cols-default": "repeat(1, minmax(0, 1fr))" } as React.CSSProperties}>
          <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as React.CSSProperties}>
            <div className="fi-sc-component">
              <div>
                <div className="fi-grid lg:fi-grid-cols fi-sc fi-sc-has-gap" style={{ "--cols-lg": "repeat(2, minmax(0, 1fr))", "--cols-default": "repeat(1, minmax(0, 1fr))" } as React.CSSProperties}>
                  <div className="fi-sc-liberated">
                    <div style={{ "--col-span-lg": "1 / -1" } as React.CSSProperties} className="fi-wi-widget fi-grid-col lg:fi-grid-col-span fi-wi-table">
                      <FiTable
                        heading={t("Terkumpul per Cabang per Hari")}
                        description={t("Total periode ini: :total", { total: rupiah(total) })}
                        filters={
                          <DateRangeFilters
                            value={range}
                            defaults={{ dari: jakartaDay(-6), sampai: jakartaDay() }}
                            labels={{ heading: t("Filter"), reset: t("Atur ulang filter"), apply: t("Terapkan filter"), dari: t("Dari"), sampai: t("Sampai") }}
                          />
                        }
                        columns={[
                          { name: "tanggal", label: t("Tanggal"), render: (row) => <FiTextCell>{shortDate(row.tanggal, locale)}</FiTextCell> },
                          { name: "branch", label: t("Cabang"), render: (row) => <FiTextCell>{row.branch}</FiTextCell> },
                          { name: "jumlah_pesanan", label: t("Jumlah Pesanan"), alignRight: true, render: (row) => <FiTextCell>{row.jumlahPesanan}</FiTextCell> },
                          {
                            name: "total",
                            label: t("Total Terkumpul"),
                            alignRight: true,
                            render: (row) => (
                              <div className="fi-ta-text fi-ta-text-item fi-size-sm fi-font-bold">{rupiah(row.total)}</div>
                            ),
                          },
                        ]}
                        rows={daily}
                        rowKey={(row) => `${row.tanggal}-${row.branch}`}
                        emptyHeading={t("Belum ada pembayaran lunas pada rentang tanggal ini.")}
                      />
                    </div>
                  </div>
                  <div className="fi-sc-liberated">
                    <div style={{ "--col-span-lg": "1 / -1" } as React.CSSProperties} className="fi-wi-widget fi-grid-col lg:fi-grid-col-span fi-wi-table">
                      <FiTable
                        heading={t("Matriks Stok")}
                        columns={[
                          { name: "productName", label: t("Produk"), render: (row) => <FiTextCell>{row.productName}</FiTextCell> },
                          { name: "category", label: t("Kategori"), render: (row) => <FiTextCell>{row.category ?? "—"}</FiTextCell> },
                          ...matrix.branches.map((branch, index) => ({
                            name: `branch_${branch.id}`,
                            label: branch.name,
                            alignRight: true,
                            render: (row: (typeof matrix.rows)[number]) => (
                              <div className="fi-ta-text fi-align-right fi-ta-text-has-badges">
                                <FiBadge color={row.cells[index].isLow ? "danger" : "gray"}>{row.cells[index].quantity}</FiBadge>
                              </div>
                            ),
                          })),
                        ]}
                        rows={matrix.rows}
                        rowKey={(row, index) => `${index}-${row.productName}`}
                        emptyHeading={t("Belum ada produk.")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FiPage>
    </AdminShell>
  );
}
