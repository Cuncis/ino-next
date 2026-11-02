import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { isSuperAdmin } from "@/lib/permissions";
import { deletionActions } from "@/server/admin/list-labels";
import { orderFormProps } from "@/server/admin/order-form-props";
import { authorizes, findAdminOrder, fulfilmentEditable, ORDER_PERMISSIONS, orderDetail } from "@/server/admin/orders";
import OrderForm, { EditHeaderButtons } from "@/views/admin/OrderForm";

export const metadata: Metadata = { title: "Ubah Pesanan - Inofarma" };

/** GET /admin/pesanan/{id}/edit: EditOrder. */
export default async function Page({ params }: PageProps<"/admin/pesanan/[id]/edit">) {
  const context = await adminContext((access) => authorizes(access, ORDER_PERMISSIONS, "update"));
  const { staff, access, locale, t } = context;
  const order = await findAdminOrder(Number((await params).id), staff);

  if (!order) {
    notFound();
  }

  const { items } = await orderDetail(order);
  const props = await orderFormProps(locale);
  const label = t("Pesanan");
  const deleted = order.deletedAt !== null;
  // a line whose product was deleted since shows no product, as the select can't offer it
  const known = new Set(props.options.products.map((product) => product.value));

  return (
    <AdminShell context={context} pathname={`/admin/pesanan/${order.id}/edit`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Pesanan"), url: "/admin/pesanan" }, { label: order.number, url: `/admin/pesanan/${order.id}` }, { label: t("Ubah") }]}
            heading={`${t("Ubah")} ${order.number}`}
            actions={<EditHeaderButtons cancelUrl={`/admin/pesanan/${order.id}`} labels={{ cancel: props.labels.cancel, save: props.labels.save }} />}
          />
        }
      >
        <OrderForm
          mode="edit"
          endpoint={`/admin/pesanan/${order.id}/simpan`}
          initial={{
            customer_id: String(order.customerId),
            branch_id: String(order.branchId),
            fulfilment: order.fulfilment,
            payment_method: order.paymentMethod ?? "",
            shipping_total: String(order.shippingTotal),
            note: order.note ?? "",
            items: items.map((item) => ({ key: `record-${item.id}`, id: item.id, product_id: item.productId !== null && known.has(String(item.productId)) ? String(item.productId) : "", quantity: String(item.quantity) })),
          }}
          fulfilmentEditable={fulfilmentEditable(order)}
          pageActions={
            isSuperAdmin(access)
              ? deletionActions(
                  locale,
                  label,
                  deleted
                    ? { forceDelete: `/admin/pesanan/${order.id}/hapus-permanen`, restore: `/admin/pesanan/${order.id}/pulihkan` }
                    : { delete: `/admin/pesanan/${order.id}/hapus` },
                  false,
                )
              : []
          }
          cancelUrl={`/admin/pesanan/${order.id}`}
          {...props}
        />
      </FiPage>
    </AdminShell>
  );
}
