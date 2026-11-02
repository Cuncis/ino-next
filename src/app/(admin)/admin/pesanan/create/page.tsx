import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { orderFormProps } from "@/server/admin/order-form-props";
import { authorizes, ORDER_PERMISSIONS } from "@/server/admin/orders";
import OrderForm from "@/views/admin/OrderForm";

export const metadata: Metadata = { title: "Buat Pesanan - Inofarma" };

/** GET /admin/pesanan/create: CreateOrder. */
export default async function Page() {
  const context = await adminContext((access) => authorizes(access, ORDER_PERMISSIONS, "create"));
  const { locale, t } = context;
  const props = await orderFormProps(locale);

  return (
    <AdminShell context={context} pathname="/admin/pesanan/create">
      <FiPage header={<FiPageHeader breadcrumbs={[{ label: t("plural:Pesanan"), url: "/admin/pesanan" }, { label: t("Buat") }]} heading={t("Buat :label", { label: t("Pesanan") })} />}>
        <OrderForm
          mode="create"
          endpoint="/admin/pesanan/buat"
          initial={{ customer_id: "", branch_id: "", fulfilment: "", payment_method: "", shipping_total: "0", note: "", items: [{ key: "new-0", product_id: "", quantity: "1" }] }}
          fulfilmentEditable
          pageActions={[]}
          cancelUrl="/admin/pesanan"
          {...props}
        />
      </FiPage>
    </AdminShell>
  );
}
