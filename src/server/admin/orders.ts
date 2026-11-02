import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { branches, customers, db, orderItems, orders, products, shipments } from "@/db";
import { FULFILMENT_STAGES, PAYMENT_METHODS } from "@/lib/admin-options";
import { branchScope, type ScopedStaff } from "@/lib/branch-scope";
import { nextCode } from "@/lib/code-sequence";
import { authorizes, can, SUPER_ADMIN_ROLE, type ResourcePermissions, type StaffAccess } from "@/lib/permissions";
import { transaction } from "@/lib/queue";
import { auditLog } from "@/server/audit";
import { cancelOrder } from "@/server/orders/order-cancellation";
import { orderCreated, updateOrder, type Order } from "@/server/orders/order-updates";
import { handOverPickup, issuePickupCode } from "@/server/orders/pickup-code";
import { bookShipment, reconcileShipment, type Shipment } from "@/server/shipping/shipment";
import type { FiColor } from "@/components/admin/filament/ui";

/**
 * The admin's orders, ported from App\Filament\Resources\Orders (OrderResource,
 * OrdersTable, OrderInfolist, OrderForm, ViewOrder, CreateOrder, EditOrder). Branch staff
 * see only their own branch's orders (BranchScope); deleted orders can still be opened.
 */
export const ORDER_PERMISSIONS: ResourcePermissions = {
  viewAny: "Pesanan:Lihat",
  create: "Pesanan:Proses",
  update: "Pesanan:Proses",
  // deleting an order removes a financial record
  delete: SUPER_ADMIN_ROLE,
};

export const ORDER_MODEL = "App\\Models\\Order";

/** Status Bayar badge colours. */
export function paymentStatusColor(status: string): FiColor {
  return status === "lunas" ? "success" : status === "gagal" ? "danger" : status === "refund" ? "gray" : "warning";
}

/** Status Pemenuhan badge colours. */
export function orderStatusColor(status: string): FiColor {
  if (status === "dikirim" || status === "selesai") return "success";
  if (status === "siap dikirim" || status === "siap diambil") return "info";
  if (status === "dibatalkan" || status === "kedaluwarsa") return "danger";

  return "warning";
}

/** Status Kirim badge colours (Biteship's statuses). */
export function shipmentStatusColor(status: string): FiColor {
  if (status === "delivered") return "success";
  if (["confirmed", "allocated", "pickingUp", "picked", "inTransit", "droppingOff"].includes(status)) return "info";
  if (status === "onHold") return "warning";
  if (["courierNotFound", "rejected", "returnInTransit", "returned", "cancelled", "disposed"].includes(status)) return "danger";

  return "gray";
}

/**
 * Filament's table search: the search split into words, each of which must appear
 * (case-insensitively) in at least one searchable column.
 */
export function searchWords(search: string | null | undefined, columns: SQL[]): SQL | undefined {
  const words = (search ?? "")
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "");

  if (!words.length) {
    return undefined;
  }

  return and(...words.map((word) => or(...columns.map((column) => sql`lower(${column}::text) like ${`%${word.toLowerCase()}%`}`))));
}

/** "Data yang dihapus": "" without (default), "1" with, "0" only deleted records. */
export function trashedCondition(column: typeof orders.deletedAt, trashed: string | undefined): SQL | undefined {
  return trashed === "1" ? undefined : trashed === "0" ? isNotNull(column) : isNull(column);
}

export type OrderListQuery = {
  search?: string;
  fulfilmentStage?: string;
  paymentStatus?: string;
  trashed?: string;
  page: number;
  perPage: number;
};

/** The Pesanan list: newest first (then by id), with the item count and customer. */
export async function listOrders(query: OrderListQuery, staff: ScopedStaff) {
  const customerName = sql`(select ${customers.name} from ${customers} where ${customers.id} = ${orders.customerId} and ${customers.deletedAt} is null)`;
  const stage = query.fulfilmentStage ? FULFILMENT_STAGES[query.fulfilmentStage] : undefined;
  const where = and(
    branchScope(orders.branchId, staff),
    trashedCondition(orders.deletedAt, query.trashed),
    searchWords(query.search, [sql`${orders.number}`, customerName]),
    stage ? inArray(orders.status, [...stage]) : undefined,
    query.paymentStatus ? eq(orders.paymentStatus, query.paymentStatus) : undefined,
  );

  const [{ total }] = await db.select({ total: count() }).from(orders).where(where);
  const rows = await db
    .select({
      order: orders,
      customerName: sql<string | null>`${customerName}`,
      itemCount: sql<string>`coalesce((select sum(${orderItems.quantity}) from ${orderItems} where ${orderItems.orderId} = ${orders.id}), 0)`,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.order, customerName: row.customerName, itemCount: Number(row.itemCount) })) };
}

/** One order an admin may open: in their branch, deleted or not. */
export async function findAdminOrder(id: number, staff: ScopedStaff): Promise<Order | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), branchScope(orders.branchId, staff)))
    .limit(1);

  return order ?? null;
}

/** Everything the order's page shows. */
export async function orderDetail(order: Order) {
  const [[customer], [branch], items, [shipment]] = await Promise.all([
    db
      .select({ name: customers.name })
      .from(customers)
      .where(and(eq(customers.id, order.customerId), isNull(customers.deletedAt)))
      .limit(1),
    db
      .select({ name: branches.name })
      .from(branches)
      .where(and(eq(branches.id, order.branchId), isNull(branches.deletedAt)))
      .limit(1),
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id)),
    db.select().from(shipments).where(eq(shipments.orderId, order.id)).orderBy(asc(shipments.id)).limit(1),
  ]);

  return { customerName: customer?.name ?? null, branchName: branch?.name ?? null, items, shipment: shipment ?? null };
}

export type OrderActionKey = "markPaid" | "markReadyToShip" | "markReady" | "ship" | "handOver" | "cancel" | "checkShipmentStatus";

/** ViewOrder's header actions this staff member sees for this order, in Laravel's order. */
export function visibleOrderActions(order: Order, shipment: Shipment | null, access: StaffAccess): OrderActionKey[] {
  if (!can(access, "Pesanan:Proses")) {
    return [];
  }

  const visible: OrderActionKey[] = [];

  // a manual order never hears from DOKU, so staff confirm its payment themselves
  if (order.status === "menunggu pembayaran" && order.paymentMethod !== "online") visible.push("markPaid");
  if (order.fulfilment === "antar" && order.status === "pembayaran diterima") visible.push("markReadyToShip");
  if (order.fulfilment === "ambil" && order.status === "pembayaran diterima") visible.push("markReady");
  if (order.fulfilment === "antar" && order.status === "siap dikirim" && shipment && shipment.biteshipOrderId === null) visible.push("ship");
  if (order.fulfilment === "ambil" && order.status === "siap diambil") visible.push("handOver");
  if (["menunggu pembayaran", "pembayaran diterima", "siap dikirim", "siap diambil"].includes(order.status)) visible.push("cancel");
  if (shipment?.biteshipOrderId) visible.push("checkShipmentStatus");

  return visible;
}

export type ActionOutcome = { status: "success" | "danger"; title: string; replace?: Record<string, string>; body?: string };

/** Runs one header action; its toast, with the Indonesian text Laravel used (translated by the caller). */
export async function runOrderAction(
  key: OrderActionKey,
  order: Order,
  staff: { id: number; branchId: number | null },
  data: Record<string, unknown>,
  shipmentStatusLabel: (status: string) => string,
): Promise<ActionOutcome> {
  const number = order.number;

  switch (key) {
    case "markPaid":
      await transaction(db, async (tx) => {
        await updateOrder(order, { status: "pembayaran diterima", paymentStatus: "lunas", paidAt: new Date() }, tx);
        await auditLog({
          action: "pesanan.lunas",
          auditable: { type: ORDER_MODEL, id: order.id },
          oldValues: { payment_status: "belum bayar" },
          newValues: { payment_status: "lunas" },
          userId: staff.id,
          branchId: order.branchId,
          executor: tx,
        });
      });

      return { status: "success", title: "Pesanan #:number ditandai lunas.", replace: { number } };
    case "markReadyToShip":
      await transaction(db, (tx) => updateOrder(order, { status: "siap dikirim" }, tx));

      return { status: "success", title: "Pesanan #:number sedang diproses.", replace: { number } };
    case "markReady": {
      const ready = await issuePickupCode(order);

      return { status: "success", title: "Pesanan #:number siap diambil. Kode: :pickup_code.", replace: { number, pickup_code: ready.pickupCode ?? "" } };
    }
    case "ship":
      try {
        await bookShipment(order);
      } catch (error) {
        return { status: "danger", title: "Gagal membuat resi", body: error instanceof Error ? error.message : String(error) };
      }

      return { status: "success", title: "Resi untuk pesanan #:number berhasil dibuat.", replace: { number } };
    case "handOver":
      try {
        await handOverPickup(order, String(data.code ?? ""), staff);
      } catch (error) {
        return { status: "danger", title: error instanceof Error ? error.message : String(error) };
      }

      return { status: "success", title: "Pesanan #:number berhasil diserahkan.", replace: { number } };
    case "cancel":
      await cancelOrder(order, "dibatalkan");

      return { status: "success", title: "Pesanan #:number dibatalkan.", replace: { number } };
    case "checkShipmentStatus": {
      const [shipment] = await db.select().from(shipments).where(eq(shipments.orderId, order.id)).orderBy(asc(shipments.id)).limit(1);

      try {
        const result = await reconcileShipment(shipment, number);

        return { status: "success", title: "Status pengiriman #:number diperbarui: :status.", replace: { number, status: shipmentStatusLabel(result.status ?? "") } };
      } catch (error) {
        return { status: "danger", title: error instanceof Error ? error.message : String(error) };
      }
    }
  }
}

/** Order::is_deletable: a completed order is a financial record; cancel it instead. */
export const isDeletable = (order: Pick<Order, "status">) => order.status !== "selesai";

export async function softDeleteOrders(ids: number[]): Promise<void> {
  if (ids.length) {
    await db.update(orders).set({ deletedAt: new Date(), updatedAt: new Date() }).where(inArray(orders.id, ids));
  }
}

export async function restoreOrders(ids: number[]): Promise<void> {
  if (ids.length) {
    await db.update(orders).set({ deletedAt: null, updatedAt: new Date() }).where(inArray(orders.id, ids));
  }
}

/** Removes orders for good; false when the database refuses (payments or a shipment still point at it). */
export async function forceDeleteOrders(ids: number[]): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(orderItems).where(inArray(orderItems.orderId, ids));
      await tx.delete(orders).where(inArray(orders.id, ids));
    });

    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------- the form ------------------------------------- */

export type OrderFormData = {
  customer_id: number;
  branch_id: number;
  fulfilment: string;
  payment_method: string;
  shipping_total: number;
  note: string | null;
  items: { id?: number; product_id: number; quantity: number }[];
};

/** Choices for the form's selects: customers and branches by name, products by name. */
export async function orderFormOptions() {
  const [customerRows, branchRows, productRows] = await Promise.all([
    db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.deletedAt)).orderBy(asc(customers.name)),
    db.select({ id: branches.id, name: branches.name }).from(branches).where(isNull(branches.deletedAt)).orderBy(asc(branches.name)),
    db.select({ id: products.id, name: products.name }).from(products).where(isNull(products.deletedAt)).orderBy(asc(products.name)),
  ]);

  return { customers: customerRows, branches: branchRows, products: productRows, paymentMethods: [...PAYMENT_METHODS] };
}

/** The way of receiving can change only before processing starts. */
export const fulfilmentEditable = (order: Pick<Order, "status"> | null) => order === null || ["menunggu pembayaran", "pembayaran diterima"].includes(order.status);

/**
 * A line snapshots the product's name, SKU and price when saved: repricing or deleting a
 * product later never rewrites what someone was charged. (Saving the form snapshots every
 * line again, as Filament's repeater did.)
 */
async function snapshot(items: OrderFormData["items"]) {
  const productRows = await db
    .select()
    .from(products)
    .where(
      inArray(
        products.id,
        items.map((item) => item.product_id),
      ),
    );
  const byId = new Map(productRows.map((product) => [product.id, product]));

  return items.map((item) => {
    const product = byId.get(item.product_id)!;

    return { id: item.id, productId: product.id, productName: product.name, sku: product.sku, unitPrice: product.price, quantity: item.quantity, lineTotal: product.price * item.quantity };
  });
}

/** CreateOrder: number INO-2451 onwards, unpaid, then its lines and totals. */
export async function createAdminOrder(data: OrderFormData, staff: { id: number }): Promise<Order> {
  const lines = await snapshot(data.items);

  return transaction(db, async (tx) => {
    const now = new Date();
    const [created] = await tx
      .insert(orders)
      .values({
        number: await nextCode({ table: orders, column: orders.number, prefix: "INO-", pad: 0, floor: 2450, executor: tx }),
        customerId: data.customer_id,
        branchId: data.branch_id,
        fulfilment: data.fulfilment,
        paymentMethod: data.payment_method,
        shippingTotal: data.shipping_total,
        note: data.note,
        status: "menunggu pembayaran",
        paymentStatus: "belum bayar",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // OrderObserver::created() runs on the model as filled by the form: grand_total was never
    // set on it (the column's 0 default stays in the database), so Laravel's audit records null
    await orderCreated({ ...created, grandTotal: null as unknown as number }, tx, staff.id);
    // new lines: the form's (absent) row ids aren't stored
    await tx.insert(orderItems).values(
      lines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        sku: line.sku,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
        orderId: created.id,
        createdAt: now,
        updatedAt: now,
      })),
    );

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

    return updateOrder(created, { subtotal, grandTotal: subtotal + created.shippingTotal }, tx);
  });
}

/** EditOrder: the order's own fields, its lines kept, changed, added or removed, then the totals. */
export async function updateAdminOrder(order: Order, data: OrderFormData): Promise<Order> {
  const lines = await snapshot(data.items);

  return transaction(db, async (tx) => {
    const now = new Date();
    const saved = await updateOrder(
      order,
      {
        customerId: data.customer_id,
        branchId: data.branch_id,
        ...(fulfilmentEditable(order) ? { fulfilment: data.fulfilment } : {}),
        paymentMethod: data.payment_method,
        shippingTotal: data.shipping_total,
        note: data.note,
      },
      tx,
    );
    const existing = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, order.id));
    const kept = new Set(lines.flatMap((line) => (line.id ? [line.id] : [])));
    const removed = existing.map((item) => item.id).filter((id) => !kept.has(id));

    if (removed.length) {
      await tx.delete(orderItems).where(inArray(orderItems.id, removed));
    }

    for (const { id, ...line } of lines) {
      if (id && existing.some((item) => item.id === id)) {
        await tx
          .update(orderItems)
          .set({ ...line, updatedAt: now })
          .where(eq(orderItems.id, id));
      } else {
        await tx.insert(orderItems).values({ ...line, orderId: order.id, createdAt: now, updatedAt: now });
      }
    }

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

    return updateOrder(saved, { subtotal, grandTotal: subtotal + saved.shippingTotal }, tx);
  });
}

export { authorizes };

/**
 * The counter's queue (PickupsTable): every order waiting to be collected, the longest
 * waiting first (then by id).
 */
export async function listPickups(query: { search?: string; page: number; perPage: number }, staff: ScopedStaff) {
  const customerName = sql`(select ${customers.name} from ${customers} where ${customers.id} = ${orders.customerId} and ${customers.deletedAt} is null)`;
  const branchName = sql<string | null>`(select ${branches.name} from ${branches} where ${branches.id} = ${orders.branchId} and ${branches.deletedAt} is null)`;
  const where = and(eq(orders.status, "siap diambil"), isNull(orders.deletedAt), branchScope(orders.branchId, staff), searchWords(query.search, [sql`${orders.number}`, customerName]));
  const [{ total }] = await db.select({ total: count() }).from(orders).where(where);
  const rows = await db
    .select({ order: orders, customerName: sql<string | null>`${customerName}`, branchName })
    .from(orders)
    .where(where)
    .orderBy(asc(orders.readyAt), asc(orders.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.order, customerName: row.customerName, branchName: row.branchName })) };
}
