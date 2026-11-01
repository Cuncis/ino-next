import { and, count, eq, isNull, sql } from "drizzle-orm";
import { branches, coupons, customerAddresses, db, orderItems, orders, shipments, type DbExecutor } from "@/db";
import { generateOrderNumber } from "@/lib/order-number";
import { ValidationException } from "@/lib/validation";
import { consumeStock, InsufficientStockError, ORDER_MORPH_CLASS, type BatchManifest } from "@/server/inventory/stock-allocator";
import type { CourierQuote } from "@/server/shipping/quote";
import { provinceOptions } from "./addresses";
import { fullAddress, pickupBranches } from "./branches";
import { cartSubtotal, couponDiscount, couponIsExhausted, deliveryBranch, stocksAt, type Address, type Branch, type CartData } from "./cart";
import { presentCart } from "./cart-presenter";
import type { Customer } from "./customer-auth";
import { shopperCoordinates } from "./location";
import { geocodePostalCode } from "./postal-code-geocoder";

/**
 * Turns a cart into an order, ported from Shop\CheckoutController. Stock is taken at once
 * through the stock allocator (FEFO, batch by batch), not held in `reserved_quantity`.
 * Online payment through DOKU is the only way to pay: no cash on delivery or at pickup.
 */

/** No tax is charged until the PPN decision lands (Fase 0). */
const TAX_RATE = 0;

/** An order waits this long for payment before it expires. */
const PAYMENT_WINDOW_HOURS = 24;

/**
 * An address typed straight into the checkout form, before (or without) being saved.
 * Ported from App\Support\Cart\DraftAddress.
 */
export type DraftAddress = Omit<Address, "id" | "customerId" | "isDefault" | "createdAt" | "updatedAt" | "latitude" | "longitude"> & {
  id?: undefined;
  latitude: string | number | null;
  longitude: string | number | null;
};

export type AddressFields = {
  addressLine?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  provinsi?: string | null;
  postalCode?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
};

/**
 * Courier quotes and the delivery radius need a map point; a shopper who filled in the
 * region but never pinned a spot still has a postal code, so the point comes from that.
 */
export async function makeDraftAddress(fields: AddressFields): Promise<DraftAddress> {
  let latitude = fields.latitude ?? null;
  let longitude = fields.longitude ?? null;
  const postalCode = fields.postalCode ?? null;

  if ((latitude === null || longitude === null) && postalCode) {
    const point = await geocodePostalCode(String(postalCode));

    latitude = point?.lat ?? null;
    longitude = point?.lng ?? null;
  }

  return {
    label: "Rumah",
    recipientName: fields.recipientName ?? "",
    phone: fields.recipientPhone ?? "",
    addressLine: fields.addressLine ?? "",
    kelurahan: fields.kelurahan ?? null,
    kecamatan: fields.kecamatan ?? null,
    kota: fields.kota ?? "",
    provinsi: fields.provinsi ?? "",
    postalCode,
    note: null,
    latitude,
    longitude,
  };
}

export function draftAddressIsComplete(fields: AddressFields): boolean {
  return Boolean(fields.addressLine) && Boolean(fields.kota) && Boolean(fields.provinsi);
}

/** The props of the Checkout page. */
export async function checkoutPageProps(data: CartData & { branch: Branch }, isGuest: boolean) {
  // A location the shopper shared wins; otherwise distances are measured from the saved address.
  const address = data.address;
  const point =
    (await shopperCoordinates()) ??
    (address?.latitude != null && address.longitude != null ? { lat: Number(address.latitude), lng: Number(address.longitude) } : null);

  const [cart, canDeliver, provinces, pickup] = await Promise.all([
    presentCart(data),
    deliveryBranch(data.branch, data.lines).then((branch) => branch !== null),
    provinceOptions(),
    pickupBranches(point),
  ]);

  // the page is only shown for a cart with a branch
  return { cart: { ...cart, branch: cart.branch! }, isGuest, canDeliver, provinces, pickupBranches: pickup };
}

/** A pickup branch picked at checkout, or the 422 Laravel answered with. */
export async function pickupBranchFor(code: string | null): Promise<Branch> {
  const [branch] = code
    ? await db
        .select()
        .from(branches)
        .where(and(eq(branches.code, code), eq(branches.status, "aktif"), eq(branches.supportsPickup, true), isNull(branches.deletedAt)))
        .limit(1)
    : [];

  if (!branch) {
    throw ValidationException.withMessages({ pickupBranchId: "Lokasi pengambilan tidak tersedia. Pilih lokasi lain." });
  }

  return branch;
}

/** Saves an address typed at checkout to the account (the first one becomes the default). */
export async function saveDraftAddress(customer: Customer, draft: DraftAddress): Promise<Address> {
  const [{ existing }] = await db.select({ existing: count() }).from(customerAddresses).where(eq(customerAddresses.customerId, customer.id));
  const now = new Date();
  const [saved] = await db
    .insert(customerAddresses)
    .values({
      ...draft,
      customerId: customer.id,
      recipientName: customer.name,
      phone: customer.phone ?? "",
      latitude: draft.latitude === null ? null : String(draft.latitude),
      longitude: draft.longitude === null ? null : String(draft.longitude),
      isDefault: existing === 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return saved;
}

type OrderAddress = Pick<Address, "recipientName" | "phone" | "addressLine" | "kelurahan" | "kecamatan" | "kota" | "provinsi" | "postalCode"> & {
  latitude: string | number | null;
  longitude: string | number | null;
};

/**
 * Writes the order, its shipment and its lines, takes the stock and uses up the coupon,
 * all in one transaction: anything refused here leaves nothing behind.
 */
export async function placeOrder(options: {
  customer: Customer;
  data: Omit<CartData, "address"> & { address: OrderAddress | null };
  branch: Branch;
  fulfilment: "antar" | "ambil";
  paymentMethod: string;
  note: string | null;
  courierQuote?: CourierQuote;
}): Promise<typeof orders.$inferSelect> {
  const { customer, data, branch, fulfilment, paymentMethod, courierQuote } = options;

  return db.transaction(async (tx) => {
    // locked, so two orders racing for a coupon's last use can't both get it
    const [coupon] = data.coupon ? await tx.select().from(coupons).where(eq(coupons.id, data.coupon.id)).limit(1).for("update") : [];

    if (coupon && couponIsExhausted(coupon)) {
      throw ValidationException.withMessages({ code: "Kuota kode promo sudah habis." });
    }

    const subtotal = await cartSubtotal(branch, data.lines, tx);
    const discount = coupon ? couponDiscount(coupon, subtotal) : 0;
    const freeShipping = coupon?.type === "ongkir gratis";
    const shipping = fulfilment === "antar" && !freeShipping ? courierQuote!.price : 0;
    const tax = Math.round((subtotal - discount) * TAX_RATE);
    const grandTotal = Math.max(subtotal - discount + shipping + tax, 0);
    const address = data.address;
    const note = (options.note ?? "").trim();
    const now = new Date();

    const [order] = await tx
      .insert(orders)
      .values({
        number: await generateOrderNumber(branch.code, tx),
        branchId: branch.id,
        customerId: customer.id,
        couponId: coupon?.id ?? null,
        fulfilment,
        status: "menunggu pembayaran",
        paymentMethod,
        paymentStatus: "belum bayar",
        subtotal,
        discountTotal: discount,
        shippingTotal: shipping,
        taxTotal: tax,
        grandTotal,
        recipientName: address?.recipientName ?? customer.name,
        recipientPhone: address?.phone ?? customer.phone,
        shippingAddress: address ? fullAddress(address) : null,
        shippingLatitude: address?.latitude == null ? null : String(address.latitude),
        shippingLongitude: address?.longitude == null ? null : String(address.longitude),
        note: note !== "" ? note : null,
        expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (fulfilment === "antar" && courierQuote) {
      await tx.insert(shipments).values({
        orderId: order.id,
        courierCompany: courierQuote.courierCompany,
        courierType: courierQuote.courierType,
        courierName: courierQuote.courierName,
        courierServiceName: courierQuote.serviceName,
        price: courierQuote.price,
        createdAt: now,
        updatedAt: now,
      });
    }

    const stocks = await stocksAt(branch.id, data.lines.map((line) => line.product.id), tx);

    for (const { product, quantity } of data.lines) {
      const price = stocks.get(product.id)?.priceOverride ?? product.price;
      let manifest: BatchManifest;

      try {
        manifest = await consumeStock({ branch, product, quantity, type: "penjualan", reference: { type: ORDER_MORPH_CLASS, id: order.id }, executor: tx });
      } catch (error) {
        if (!(error instanceof InsufficientStockError)) {
          throw error;
        }

        if (fulfilment !== "ambil") {
          throw ValidationException.withMessages({
            quantity: `Stok ${product.name} baru saja berubah: tersisa ${error.available}, diminta ${error.requested}.`,
          });
        }

        // Pickup is open at every branch whatever its stock; the company covers the gap,
        // so nothing is taken here.
        manifest = [];
      }

      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: price,
        quantity,
        lineTotal: price * quantity,
        batchesConsumed: manifest,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (coupon) {
      await incrementCouponUse(tx, coupon.id);
    }

    return order;
  });
}

async function incrementCouponUse(executor: DbExecutor, couponId: number): Promise<void> {
  await executor
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: new Date() })
    .where(eq(coupons.id, couponId));
}
