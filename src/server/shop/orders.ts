import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import QRCode from "qrcode";
import { branches, db, orderItems, orders, productImages, products, shipments } from "@/db";
import { FULFILMENTS, ORDER_STATUSES, toLabel } from "@/lib/admin-options";
import { indonesianDate } from "@/lib/dates";
import { displayUrl } from "@/lib/storage";
import type { Order } from "@/server/orders/order-updates";
import { PRODUCT_PLACEHOLDER_IMAGE } from "./catalog";
import { presentCartBranch } from "./cart-presenter";

/**
 * A signed-in customer's own orders, ported from Shop\OrderController's queries and
 * App\Support\Presenters\ShopOrderPresenter. Every lookup is scoped to the customer, so
 * nobody can load someone else's order by guessing its number.
 */
type OrderItem = typeof orderItems.$inferSelect;

/** One of the customer's orders by its number (not deleted), or null. */
export async function findCustomerOrder(customerId: number, number: string): Promise<Order | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.customerId, customerId), eq(orders.number, number), isNull(orders.deletedAt)))
    .limit(1);

  return order ?? null;
}

async function itemsOf(orderIds: number[]): Promise<OrderItem[]> {
  return orderIds.length ? db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).orderBy(asc(orderItems.id)) : [];
}

async function branchesById(ids: number[]) {
  const rows = ids.length
    ? await db
        .select()
        .from(branches)
        .where(and(inArray(branches.id, ids), isNull(branches.deletedAt)))
    : [];

  return new Map(rows.map((branch) => [branch.id, branch]));
}

/**
 * Each line's product photo (Product::image_path: the first photo, else the placeholder),
 * by product id. A product deleted since shows none, as Eloquent hid it.
 */
export async function orderItemImages(items: Pick<OrderItem, "productId">[]): Promise<Map<number, string>> {
  const ids = [...new Set(items.flatMap((item) => (item.productId === null ? [] : [item.productId])))];
  const live = ids.length
    ? await db
        .select({ id: products.id })
        .from(products)
        .where(and(inArray(products.id, ids), isNull(products.deletedAt)))
    : [];
  const productIds = live.map((product) => product.id);
  const images = productIds.length
    ? await db
        .select({ productId: productImages.productId, path: productImages.path })
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.position), asc(productImages.id))
    : [];

  return new Map(productIds.map((id) => [id, displayUrl(images.find((image) => image.productId === id)?.path ?? PRODUCT_PLACEHOLDER_IMAGE)]));
}

function summary(order: Order, items: OrderItem[], branchName: string | null) {
  // every stored status, fulfilment and creation time has a label and a date
  return {
    number: order.number,
    status: toLabel(ORDER_STATUSES, order.status)!,
    fulfilment: toLabel(FULFILMENTS, order.fulfilment)!,
    date: indonesianDate(order.createdAt)!,
    total: order.grandTotal,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    branchName: branchName!,
  };
}

/** The order history (newest first), ShopOrderPresenter::collection(). */
export async function customerOrderHistory(customerId: number) {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.customerId, customerId), isNull(orders.deletedAt)))
    .orderBy(desc(orders.createdAt));
  const [items, branchMap] = await Promise.all([itemsOf(rows.map((order) => order.id)), branchesById([...new Set(rows.map((order) => order.branchId))])]);

  return rows.map((order) =>
    summary(
      order,
      items.filter((item) => item.orderId === order.id),
      branchMap.get(order.branchId)?.name ?? null,
    ),
  );
}

/** One order for its detail and tracking pages, ShopOrderPresenter::toArray(). */
export async function presentCustomerOrder(order: Order) {
  const [items, branchMap, [shipment]] = await Promise.all([
    itemsOf([order.id]),
    branchesById([order.branchId]),
    db.select().from(shipments).where(eq(shipments.orderId, order.id)).orderBy(asc(shipments.id)).limit(1),
  ]);
  const branch = branchMap.get(order.branchId) ?? null;
  const images = await orderItemImages(items);

  return {
    ...summary(order, items, branch?.name ?? null),
    branch: branch ? presentCartBranch(branch) : null,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    shippingAddress: order.shippingAddress,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    discount: order.discountTotal,
    shipping: order.shippingTotal,
    tax: order.taxTotal,
    note: order.note,
    isCancellable: isCancellableByCustomer(order),
    // "online" is the only payment method that goes through DOKU; an order staff
    // entered by hand never opens a payment session
    canPay: canPay(order),
    items: items.map((item) => ({
      name: item.productName,
      sku: item.sku ?? "",
      image: item.productId === null ? null : (images.get(item.productId) ?? null),
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    steps: orderSteps(order),
    shipment: shipment
      ? {
          courierName: shipment.courierName ?? "",
          serviceName: shipment.courierServiceName ?? "",
          waybillId: shipment.waybillId,
          trackingLink: shipment.courierLink,
          statusLabel: shipmentStatusLabel(shipment.status),
        }
      : null,
    pickup: await pickup(order),
  };
}

/** Order::is_cancellable_by_customer: only until the pharmacy starts on it, i.e. before payment. */
export function isCancellableByCustomer(order: Pick<Order, "status">): boolean {
  return order.status === "menunggu pembayaran";
}

export function canPay(order: Pick<Order, "status" | "paymentStatus" | "paymentMethod">): boolean {
  return order.status === "menunggu pembayaran" && order.paymentStatus === "belum bayar" && order.paymentMethod === "online";
}

/** Biteship's status words, in Indonesian, for a customer who has never heard "droppingOff". */
export function shipmentStatusLabel(status: string | null): string | null {
  const labels: Record<string, string> = {
    confirmed: "Pesanan dikonfirmasi, mencari kurir",
    allocated: "Kurir ditugaskan",
    pickingUp: "Kurir menuju cabang",
    picked: "Barang diambil kurir",
    inTransit: "Dalam perjalanan",
    droppingOff: "Menuju alamat Anda",
    delivered: "Terkirim",
    onHold: "Tertahan sementara",
    returnInTransit: "Dikembalikan ke cabang",
    returned: "Dikembalikan ke cabang",
    rejected: "Ditolak kurir",
    courierNotFound: "Kurir tidak tersedia",
    cancelled: "Dibatalkan",
    disposed: "Dimusnahkan",
  };

  return status !== null && Object.hasOwn(labels, status) ? labels[status] : null;
}

/**
 * The code and QR shown at the counter while an order waits to be collected. The QR
 * opens the admin's Pengambilan page with the order and code filled in.
 */
async function pickup(order: Order) {
  if (!order.pickupCode || order.status !== "siap diambil") {
    return null;
  }

  const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/admin/pengambilan?${new URLSearchParams({ order: order.number, kode: order.pickupCode })}`;
  const svg = await QRCode.toString(url, { type: "svg", width: 220, margin: 1 });

  return {
    code: order.pickupCode,
    qrSvg: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    expiresAt: indonesianDate(order.pickupCodeExpiresAt, true),
  };
}

export type OrderStep = { label: string; state: "done" | "current" | "pending"; at: string | null };

/**
 * The tracking timeline. Empty for a cancelled or expired order: those get a banner
 * instead of a progress bar that suggests the order is moving.
 */
export function orderSteps(
  order: Pick<Order, "status" | "fulfilment" | "createdAt" | "paidAt" | "readyAt" | "completedAt">,
): OrderStep[] {
  if (order.status === "dibatalkan" || order.status === "kedaluwarsa") {
    return [];
  }

  const definitions: { status: string; label: string; at: Date | null }[] =
    order.fulfilment === "ambil"
      ? [
          { status: "menunggu pembayaran", label: "Pesanan Dibuat", at: order.createdAt },
          { status: "pembayaran diterima", label: "Pembayaran Diterima", at: order.paidAt },
          { status: "siap diambil", label: "Siap Diambil", at: order.readyAt },
          { status: "selesai", label: "Diambil", at: order.completedAt },
        ]
      : [
          { status: "menunggu pembayaran", label: "Pesanan Dibuat", at: order.createdAt },
          { status: "pembayaran diterima", label: "Pembayaran Diterima", at: order.paidAt },
          { status: "siap dikirim", label: "Siap Dikirim", at: null },
          { status: "dikirim", label: "Dikirim", at: order.readyAt },
          { status: "selesai", label: "Diterima", at: order.completedAt },
        ];

  const found = definitions.findIndex((step) => step.status === order.status);
  const current = found === -1 ? 0 : found;
  const last = definitions.length - 1;

  return definitions.map((step, index) => ({
    label: step.label,
    // the last step reached means the order is finished: a check mark, not a ring
    state: index < current || (index === current && index === last) ? "done" : index === current ? "current" : "pending",
    at: indonesianDate(step.at, true),
  }));
}
