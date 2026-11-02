import { randomInt, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { iso8601 } from "@/lib/dates";
import { transaction } from "@/lib/queue";
import { auditLog } from "@/server/audit";
import { updateOrder, type Order } from "./order-updates";

/**
 * The pickup code a customer shows at the counter, ported from
 * App\Support\Pickup\PickupCodeService: issued when staff mark a paid pickup order
 * ready, checked at the handover, valid for 48 hours (the expiry sweep returns the stock
 * after that).
 */
const WINDOW_HOURS = 48;

/** A handover refused for a reason the counter should read as it is. */
export class PickupCodeError extends Error {}

/** A 6-digit code no other order waiting at a counter holds. */
async function generateCode(): Promise<string> {
  for (;;) {
    const code = String(randomInt(100000, 1000000));
    const [taken] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.pickupCode, code), eq(orders.status, "siap diambil")))
      .limit(1);

    if (!taken) {
      return code;
    }
  }
}

/** "Tandai Sedang Diproses" on a paid pickup order: ready at the counter, with its code. */
export async function issuePickupCode(order: Order): Promise<Order> {
  const now = new Date();
  const code = await generateCode();

  return transaction(db, (tx) =>
    updateOrder(order, { status: "siap diambil", readyAt: now, pickupCode: code, pickupCodeExpiresAt: new Date(now.getTime() + WINDOW_HOURS * 3600_000) }, tx),
  );
}

/** The counter hands the order over: the code must match and still be valid. */
export async function handOverPickup(order: Order, code: string, staff: { id: number; branchId: number | null }): Promise<Order> {
  if (order.status !== "siap diambil") {
    throw new PickupCodeError(`Pesanan #${order.number} belum siap diambil.`);
  }

  if (order.pickupCodeExpiresAt !== null && order.pickupCodeExpiresAt.getTime() < Date.now()) {
    throw new PickupCodeError(`Kode ambil pesanan #${order.number} sudah kedaluwarsa.`);
  }

  const matches = order.pickupCode !== null && order.pickupCode.length === code.length && timingSafeEqual(Buffer.from(order.pickupCode), Buffer.from(code));

  if (!matches) {
    throw new PickupCodeError("Kode ambil tidak cocok.");
  }

  const now = new Date();

  return transaction(db, async (tx) => {
    const updated = await updateOrder(order, { status: "selesai", completedAt: now, pickedUpAt: now, handedOverBy: staff.id }, tx);

    // the staff member is the actor, and (as Laravel did) their own branch is recorded
    await auditLog({
      action: "pesanan.serahkan",
      auditable: { type: "App\\Models\\Order", id: order.id },
      newValues: { picked_up_at: iso8601(now), handed_over_by: staff.id },
      userId: staff.id,
      branchId: staff.branchId,
      executor: tx,
    });

    return updated;
  });
}
