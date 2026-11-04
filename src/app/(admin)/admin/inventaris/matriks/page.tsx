import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { FiWidgets, FiWidgetTable, textCell } from "@/components/admin/filament/WidgetTable";
import { can } from "@/lib/permissions";
import { stockMatrix } from "@/server/admin/stock";

export const metadata: Metadata = { title: "Matriks Stok - Inofarma" };

/**
 * GET /admin/inventaris/matriks: StockMatrix, every product against every active branch.
 * Each cell's state is Laravel's [quantity, isLow] pair, which Filament draws as two
 * badges (the count, then an empty one) and never in red; this keeps that.
 */
export default async function Page() {
  const context = await adminContext((access) => can(access, "Inventaris:Lihat"));
  const { staff, t } = context;
  const { branches, rows } = await stockMatrix(staff);
  const pair = (quantity: number) => (
    <ul className="fi-ta-text fi-align-right fi-ta-text-has-badges">
      <li className="fi-ta-text-item">
        <span className="fi-badge fi-size-sm">{quantity}</span>
      </li>
      <li className="fi-ta-text-item">
        <span className="fi-badge fi-size-sm" />
      </li>
    </ul>
  );

  return (
    <AdminShell context={context} pathname="/admin/inventaris/matriks">
      <FiPage header={<FiPageHeader heading={t("Matriks Stok")} />}>
        <FiWidgets>
          <FiWidgetTable
            heading={t("Matriks Stok")}
            columns={[
              { name: "productName", className: "product-name", label: t("Produk") },
              { name: "category", className: "category", label: t("Kategori") },
              ...branches.map((branch) => ({ name: `branch_${branch.id}`, className: `branch${branch.id}`, label: branch.name, alignRight: true })),
            ]}
            rows={rows.map((product) => ({
              key: String(product.id),
              cells: {
                productName: textCell(product.name),
                category: product.category ? textCell(product.category) : (
                  <div className="fi-ta-text">
                    <p className="fi-ta-placeholder">—</p>
                  </div>
                ),
                ...Object.fromEntries(branches.map((branch, index) => [`branch_${branch.id}`, pair(product.quantities[index])])),
              },
            }))}
            emptyHeading={t("Belum ada produk.")}
          />
        </FiWidgets>
      </FiPage>
    </AdminShell>
  );
}
