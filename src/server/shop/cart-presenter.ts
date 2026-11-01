import { asc, inArray } from "drizzle-orm";
import { db, productImages } from "@/db";
import { COUPON_TYPES, toLabel } from "@/lib/admin-options";
import { normalizePhone } from "@/lib/phone";
import { displayUrl } from "@/lib/storage";
import { presentAddress } from "./addresses";
import { fullAddress, isOpenNow } from "./branches";
import { couponDiscount, stocksAt, type Branch, type CartData } from "./cart";
import { PRODUCT_PLACEHOLDER_IMAGE, purchaseLimit } from "./catalog";

/**
 * The cart as the Cart, Checkout and mini-cart screens render it, ported from
 * App\Support\Presenters\CartPresenter. Prices are always live (the branch's override,
 * else the national price): a cart never freezes a price the way an order line does.
 */
export async function presentCart(cart: CartData) {
  const { branch } = cart;
  const ids = cart.lines.map((line) => line.product.id);
  const [stocks, images] = await Promise.all([
    branch ? stocksAt(branch.id, ids) : new Map<number, never>(),
    ids.length
      ? db
          .select({ productId: productImages.productId, path: productImages.path })
          .from(productImages)
          .where(inArray(productImages.productId, ids))
          .orderBy(asc(productImages.position), asc(productImages.id))
      : [],
  ]);

  const items = cart.lines.map(({ product, quantity }) => {
    const stock = stocks.get(product.id);
    const price = stock?.priceOverride ?? product.price;

    return {
      sku: product.sku,
      name: product.name,
      image: displayUrl(images.find((image) => image.productId === product.id)?.path ?? PRODUCT_PLACEHOLDER_IMAGE),
      brand: product.manufacturer || "Inofarma",
      unit: product.unit,
      unitPrice: price,
      quantity,
      lineTotal: price * quantity,
      available: stock ? Math.max(stock.quantity - stock.reservedQuantity, 0) : 0,
      maxQtyPerOrder: product.maxQtyPerOrder,
      purchaseLimit: purchaseLimit(product.maxQtyPerOrder),
      needsWarningLabel: product.drugClass === "bebas terbatas",
      prescription: product.requiresPrescription,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = cart.coupon ? Math.min(subtotal, couponDiscount(cart.coupon, subtotal)) : 0;

  return {
    branch: branch ? presentCartBranch(branch) : null,
    address: cart.address ? presentAddress(cart.address) : null,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    coupon: cart.coupon
      ? {
          code: cart.coupon.code,
          type: toLabel(COUPON_TYPES, cart.coupon.type),
          freeShipping: cart.coupon.type === "ongkir gratis",
          discount,
        }
      : null,
    discount,
  };
}

export function presentCartBranch(branch: Branch) {
  return {
    id: branch.code,
    name: branch.name,
    kota: branch.kota,
    addressLine: branch.addressLine,
    fullAddress: fullAddress(branch),
    phone: branch.phone,
    whatsapp: branch.whatsapp,
    mapsUrl: branch.mapsUrl,
    supportsDelivery: branch.supportsDelivery,
    supportsPickup: branch.supportsPickup,
    deliveryRadiusKm: branch.deliveryRadiusKm,
    isOpenNow: isOpenNow(branch),
    operatingHours: branch.operatingHours,
    // the branch the shopper committed to, so the pharmacist shown is theirs (Fase 9.3)
    apjName: branch.apjName,
    apjWhatsappUrl: branch.whatsapp ? `https://wa.me/${normalizePhone(branch.whatsapp)}` : null,
  };
}
