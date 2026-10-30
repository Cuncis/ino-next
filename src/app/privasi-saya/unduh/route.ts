import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { customerAddresses, db, orderItems, orders } from "@/db";
import { iso8601 } from "@/lib/dates";
import { customerForAction } from "@/server/shop/customer-guard";

/**
 * PDP (UU 27/2022) self-service: a JSON download of everything this app holds about the
 * signed-in customer, and nobody else (no id in the route). Ported from
 * Shop\PrivacyController::export().
 */
export async function GET(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const addresses = await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, customer.id)).orderBy(asc(customerAddresses.id));
  const customerOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.customerId, customer.id), isNull(orders.deletedAt)))
    .orderBy(asc(orders.id));
  const items = customerOrders.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, customerOrders.map((order) => order.id))).orderBy(asc(orderItems.id))
    : [];

  const payload = {
    profil: {
      kode: customer.code,
      nama: customer.name,
      email: customer.email,
      telepon: customer.phone,
      bergabung_pada: iso8601(customer.createdAt),
      persetujuan_pada: iso8601(customer.consentAt),
      versi_persetujuan: customer.consentVersion,
    },
    alamat: addresses.map((address) => ({
      label: address.label,
      penerima: address.recipientName,
      telepon: address.phone,
      alamat: address.addressLine,
      kota: address.kota,
      provinsi: address.provinsi,
      koordinat: [address.latitude, address.longitude],
    })),
    pesanan: customerOrders.map((order) => ({
      nomor: order.number,
      tanggal: iso8601(order.createdAt),
      status: order.status,
      total: order.grandTotal,
      item: items.filter((item) => item.orderId === order.id).map((item) => `${item.productName} x${item.quantity}`),
    })),
  };

  return new Response(JSON.stringify(payload, null, 4), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="data-${customer.code}.json"`,
    },
  });
}
