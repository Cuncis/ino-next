import { notFound } from "next/navigation";
import TrackOrder from "@/views/shop/TrackOrder";
import { requireCustomer } from "@/server/shop/require-customer";
import { findCustomerOrder, presentCustomerOrder } from "@/server/shop/orders";
import { ShopPage } from "../../shop-page";

/** The shipment or pickup timeline, read-only. Ported from Shop\OrderController::track(). */
export default async function Page({ params }: PageProps<"/track-order/[order]">) {
  const customer = await requireCustomer();
  const order = await findCustomerOrder(customer.id, (await params).order);

  if (!order) {
    notFound();
  }

  return (
    <ShopPage>
      <TrackOrder order={await presentCustomerOrder(order)} />
    </ShopPage>
  );
}
