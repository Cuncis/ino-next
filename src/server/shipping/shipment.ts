import { and, eq, isNull } from "drizzle-orm";
import { db, orders, shipments } from "@/db";
import { iso8601 } from "@/lib/dates";
import { updateOrder } from "@/server/orders/order-updates";

/**
 * Folds Biteship's word on a booked shipment into it and its order, ported from
 * App\Support\Shipping\ShipmentService::applyWebhookEvent() and applyStatus(). Booking a
 * courier and the manual tracking check are admin actions and come with the admin panel.
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
  return db.transaction(async (tx) => {
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
