import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { branches, db, orderItems, orders, products, shipments } from "@/db";
import { iso8601 } from "@/lib/dates";
import { transaction } from "@/lib/queue";
import { updateOrder, type Order } from "@/server/orders/order-updates";
import { BiteshipClient } from "./biteship-client";
import { shippingWeightGrams } from "./quote";

/**
 * One delivery order's relationship with Biteship past the checkout quote, ported from
 * App\Support\Shipping\ShipmentService: booking the courier from the admin
 * (`bookShipment()`), and folding Biteship's word back into the shipment and its order,
 * from the webhook or the admin's "Cek Status Kirim" (`reconcileShipment()`).
 */
export type Shipment = typeof shipments.$inferSelect;

type HistoryEntry = { status: string; at: string | null };

function text(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

/**
 * One webhook event (`order.status`, `order.waybill_id` or `order.price`), or null when
 * it names no shipment this app booked. Safe to repeat: the same status again records
 * the payload but never moves the order a second time.
 */
export async function applyBiteshipWebhookEvent(payload: Record<string, unknown>): Promise<Shipment | null> {
  const biteshipOrderId = text(payload.order_id);

  if (!biteshipOrderId) {
    return null;
  }

  const [shipment] = await db.select().from(shipments).where(eq(shipments.biteshipOrderId, biteshipOrderId)).limit(1);

  if (!shipment) {
    return null;
  }

  return applyShipmentStatus(shipment, text(payload.status) ?? shipment.status, text(payload.courier_waybill_id), text(payload.courier_tracking_id), payload);
}

/** Shared by the webhook and (later) the admin's tracking check: the same transition either way. */
export async function applyShipmentStatus(
  shipment: Pick<Shipment, "id">,
  status: string | null,
  waybillId: string | null,
  trackingId: string | null,
  raw: unknown,
): Promise<Shipment> {
  return transaction(db, async (tx) => {
    const [locked] = await tx.select().from(shipments).where(eq(shipments.id, shipment.id)).limit(1).for("update");

    if (status === null) {
      // nothing to go on (Laravel failed here with a type error); leave the shipment as it is
      return locked;
    }

    const changed = status !== locked.status;
    const now = new Date();
    const history = [...((locked.history as HistoryEntry[] | null) ?? [])];

    if (changed) {
      history.push({ status, at: iso8601(now) });
    }

    const [updated] = await tx
      .update(shipments)
      .set({
        status,
        waybillId: waybillId ?? locked.waybillId,
        trackingId: trackingId ?? locked.trackingId,
        history,
        rawResponse: raw,
        deliveredAt: status === "delivered" ? (locked.deliveredAt ?? now) : locked.deliveredAt,
        updatedAt: now,
      })
      .where(eq(shipments.id, locked.id))
      .returning();

    if (changed && status === "delivered") {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, locked.orderId), isNull(orders.deletedAt))).limit(1).for("update");

      if (order && order.status === "dikirim") {
        await updateOrder(order, { status: "selesai", completedAt: now }, tx);
      }
    }

    return updated;
  });
}

/** A booking or tracking refusal, worded for staff (Laravel's RuntimeException messages). */
export class ShipmentError extends Error {}

/**
 * Books the courier the customer chose at checkout ("Tandai Terpenuhi"), never done
 * automatically: Biteship returns the waybill, and the order becomes "dikirim".
 */
export async function bookShipment(order: Order, client = BiteshipClient.fromConfig()): Promise<Shipment> {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.orderId, order.id)).orderBy(asc(shipments.id)).limit(1);

  if (!shipment) {
    throw new ShipmentError(`Pesanan #${order.number} tidak punya kurir yang dipilih.`);
  }

  if (shipment.biteshipOrderId !== null) {
    throw new ShipmentError(`Resi untuk pesanan #${order.number} sudah dibuat.`);
  }

  const [branch] = await db.select().from(branches).where(eq(branches.id, order.branchId)).limit(1);

  assertBookable(order, branch);

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id));
  const productIds = items.flatMap((item) => (item.productId === null ? [] : [item.productId]));
  const productRows = productIds.length
    ? await db
        .select()
        .from(products)
        .where(and(inArray(products.id, productIds), isNull(products.deletedAt)))
    : [];
  const productById = new Map(productRows.map((product) => [product.id, product]));

  const response = await client.createOrder({
    origin_contact_name: branch.name,
    origin_contact_phone: branch.phone || branch.whatsapp,
    origin_address: branch.addressLine,
    origin_postal_code: branch.postalCode,
    origin_coordinate: { latitude: Number(branch.latitude), longitude: Number(branch.longitude) },
    destination_contact_name: order.recipientName,
    destination_contact_phone: order.recipientPhone,
    destination_address: order.shippingAddress,
    destination_coordinate: { latitude: Number(order.shippingLatitude), longitude: Number(order.shippingLongitude) },
    courier_company: shipment.courierCompany,
    courier_type: shipment.courierType,
    delivery_type: "now",
    order_note: order.note,
    reference_id: order.number,
    items: items.map((item) => {
      const product = item.productId === null ? undefined : productById.get(item.productId);

      return {
        name: item.productName,
        value: item.unitPrice,
        quantity: item.quantity,
        weight: shippingWeightGrams(product?.weightGrams ?? 0),
        height: product?.heightCm ?? 0,
        length: product?.lengthCm ?? 0,
        width: product?.widthCm ?? 0,
      };
    }),
  });

  const courier = (response.courier ?? {}) as Record<string, unknown>;
  const status = text(response.status) ?? "confirmed";
  const now = new Date();

  return transaction(db, async (tx) => {
    const [booked] = await tx
      .update(shipments)
      .set({
        biteshipOrderId: text(response.id),
        trackingId: text(courier.tracking_id),
        waybillId: text(courier.waybill_id),
        courierLink: text(courier.link),
        status,
        history: [{ status, at: iso8601(now) }],
        rawResponse: response,
        shippedAt: now,
        updatedAt: now,
      })
      .where(eq(shipments.id, shipment.id))
      .returning();

    await updateOrder(order, { status: "dikirim", readyAt: now }, tx);

    return booked;
  });
}

/**
 * Biteship answers a missing pickup or drop-off point with "invalid or missing postal
 * code", which tells staff nothing, so what is sent is checked first.
 */
function assertBookable(order: Order, branch: typeof branches.$inferSelect | undefined): asserts branch is typeof branches.$inferSelect {
  if (!branch) {
    throw new ShipmentError(`Cabang pesanan #${order.number} tidak ditemukan.`);
  }

  const problems: string[] = [];

  if (branch.latitude === null || branch.longitude === null) {
    problems.push(`koordinat ${branch.name} belum diisi`);
  }

  if (!branch.addressLine?.trim() || branch.addressLine.startsWith("Alamat belum diisi")) {
    problems.push(`alamat ${branch.name} belum diisi`);
  }

  if (!(branch.phone || branch.whatsapp)?.trim()) {
    problems.push(`telepon ${branch.name} belum diisi`);
  }

  if (order.shippingLatitude === null || order.shippingLongitude === null) {
    problems.push("alamat pelanggan tidak punya titik peta");
  }

  if (problems.length) {
    const reason = problems.join(", ");

    throw new ShipmentError(`Resi pesanan #${order.number} belum bisa dibuat: ${reason[0].toUpperCase()}${reason.slice(1)}. Lengkapi di admin (Cabang > Ubah).`);
  }
}

/**
 * Pulls Biteship's tracking record for a booked shipment and folds it in as the webhook
 * would: for a webhook that is late, lost, or (in development) never coming.
 */
export async function reconcileShipment(shipment: Shipment, orderNumber: string, client = BiteshipClient.fromConfig()): Promise<Shipment> {
  if (!shipment.trackingId) {
    throw new ShipmentError(`Pesanan #${orderNumber} belum punya resi untuk dilacak.`);
  }

  const response = await client.track(shipment.trackingId);
  const courier = (response.courier ?? {}) as Record<string, unknown>;

  return applyShipmentStatus(
    shipment,
    text(response.status) ?? shipment.status,
    text(response.waybill_id) ?? text(courier.waybill_id),
    text(response.tracking_id) ?? text(courier.tracking_id),
    response,
  );
}
