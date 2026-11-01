import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { branches, branchStocks, cartItems, carts, couponBranch, coupons, customerAddresses, db, orders, products, type DbExecutor } from "@/db";
import { redis } from "@/lib/redis";
import { SESSION_MINUTES } from "@/lib/session";
import { ValidationException } from "@/lib/validation";
import { purchaseLimit } from "./catalog";
import { currentCustomer, type Customer } from "./customer-auth";

/**
 * The one place that knows how a shopper's cart is stored, ported from
 * App\Support\Cart\CartManager: a `carts` row (+ `cart_items`) for a signed-in customer,
 * and for a guest what Laravel kept in the session, here a small record in Redis behind
 * its own cookie that lasts as long as a Laravel session (120 minutes, renewed on use).
 *
 * A guest's cart only holds a branch and products: the address and coupon are picked at
 * checkout, so applyCoupon(), removeCoupon() and setAddress() need a signed-in customer.
 *
 * Soft-deleted products, branches and coupons drop out of a cart, as Eloquent's
 * relations hid them.
 */
export type Product = typeof products.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type Address = typeof customerAddresses.$inferSelect;
export type Coupon = typeof coupons.$inferSelect & { branchIds: number[] };
export type CartLine = { product: Product; quantity: number };
export type CartData = { branch: Branch | null; address: Address | null; coupon: Coupon | null; lines: CartLine[] };

export const OVER_LIMIT_MESSAGE = "Produk ini memiliki maksimum jumlah pembelian untuk pemakaian 3 hari";

/** A product from another branch was about to go into a cart that isn't empty: one cart, one branch. */
export class CartBranchConflict extends Error {
  constructor(readonly currentBranch: Branch) {
    super(`Keranjang Anda berisi produk dari ${currentBranch.name}.`);
  }
}

export const GUEST_CART_COOKIE = "inofarma_guest_cart";

const GUEST_CART_SECONDS = SESSION_MINUTES * 60;

/** Products in the order they were added (Laravel's session array kept that order). */
type GuestCart = { branch_id: number | null; items: [productId: number, quantity: number][] };

export function guestCartCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production", maxAge: GUEST_CART_SECONDS };
}

function guestCartKey(token: string): string {
  return `guest_cart:${createHash("sha256").update(token).digest("hex")}`;
}

/** Ends a guest cart for good (Laravel's session()->invalidate() on sign-out did the same). */
export async function forgetGuestCart(): Promise<void> {
  const store = await cookies();
  const token = store.get(GUEST_CART_COOKIE)?.value;

  if (token) {
    await redis.del(guestCartKey(token));
    store.delete(GUEST_CART_COOKIE);
  }
}

const liveProduct = isNull(products.deletedAt);
const liveBranch = isNull(branches.deletedAt);

async function findBranch(id: number | null, executor: DbExecutor = db): Promise<Branch | null> {
  if (id === null) {
    return null;
  }

  const [branch] = await executor
    .select()
    .from(branches)
    .where(and(eq(branches.id, id), liveBranch))
    .limit(1);

  return branch ?? null;
}

/** The product's stock row at a branch (Product::stockAt). */
export async function stockAt(productId: number, branchId: number, executor: DbExecutor = db) {
  const [stock] = await executor
    .select()
    .from(branchStocks)
    .where(and(eq(branchStocks.productId, productId), eq(branchStocks.branchId, branchId)))
    .limit(1);

  return stock ?? null;
}

/** Stock rows of several products at one branch, by product id. */
export async function stocksAt(branchId: number, productIds: number[], executor: DbExecutor = db) {
  const rows = productIds.length
    ? await executor
        .select()
        .from(branchStocks)
        .where(and(eq(branchStocks.branchId, branchId), inArray(branchStocks.productId, productIds)))
    : [];

  return new Map(rows.map((row) => [row.productId, row]));
}

function availableOf(stock: { quantity: number; reservedQuantity: number } | null | undefined): number {
  return stock ? Math.max(stock.quantity - stock.reservedQuantity, 0) : 0;
}

/** A coupon with the branches it is limited to (none means every branch). */
async function withBranches(coupon: typeof coupons.$inferSelect | undefined, executor: DbExecutor = db): Promise<Coupon | null> {
  if (!coupon) {
    return null;
  }

  const rows = await executor.select({ branchId: couponBranch.branchId }).from(couponBranch).where(eq(couponBranch.couponId, coupon.id));

  return { ...coupon, branchIds: rows.map((row) => row.branchId) };
}

export function couponIsExhausted(coupon: Pick<Coupon, "quota" | "usedCount">): boolean {
  return coupon.quota !== null && coupon.usedCount >= coupon.quota;
}

/**
 * The discount a subtotal earns, in rupiah, never more than the subtotal. "Gratis Ongkir"
 * gives no product discount; it zeroes the shipping instead. (Coupon::discountFor)
 */
export function couponDiscount(coupon: Pick<Coupon, "type" | "value">, subtotal: number): number {
  switch (coupon.type) {
    case "persentase":
      return Math.min(subtotal, phpRound((subtotal * coupon.value) / 100));
    case "nominal":
      return Math.min(subtotal, coupon.value);
    default:
      return 0;
  }
}

/** PHP's round(): halves away from zero. */
function phpRound(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export class CartManager {
  /**
   * @param guestToken the guest cart cookie's value, for src/proxy.ts (which reads cookies
   *                   itself); elsewhere it is read from the request
   */
  constructor(
    private readonly customer: Customer | null,
    private readonly guestToken?: string | null,
  ) {}

  /** The cart of whoever is making this request. */
  static async current(): Promise<CartManager> {
    return new CartManager(await currentCustomer());
  }

  async current(): Promise<CartData> {
    return this.customer ? this.fromCart(await this.cartRow()) : this.fromGuest();
  }

  /** Units in the cart: the badge on the "Pesanan" tab. */
  async count(): Promise<number> {
    if (this.customer) {
      const [row] = await db
        .select({ total: sql<string | null>`sum(${cartItems.quantity})` })
        .from(cartItems)
        .innerJoin(carts, eq(carts.id, cartItems.cartId))
        .innerJoin(products, and(eq(products.id, cartItems.productId), liveProduct))
        .where(eq(carts.customerId, this.customer.id));

      return Number(row?.total ?? 0);
    }

    return (await this.fromGuest()).lines.reduce((sum, line) => sum + line.quantity, 0);
  }

  /** @throws CartBranchConflict, ValidationException */
  async addItem(product: Product, branch: Branch, quantity: number, switchBranch = false): Promise<void> {
    quantity = Math.max(quantity, 1);

    if (this.customer) {
      const customerId = this.customer.id;

      await db.transaction(async (tx) => {
        const cart = await this.cartRow(tx, customerId);
        const [anyItem] = await tx.select({ id: cartItems.id }).from(cartItems).where(eq(cartItems.cartId, cart.id)).limit(1);

        if (cart.branchId && cart.branchId !== branch.id && anyItem) {
          if (!switchBranch) {
            const current = await findBranch(cart.branchId, tx);

            // Eloquent would load a soft-deleted cart branch as null and fail; treat it as gone
            if (current) {
              throw new CartBranchConflict(current);
            }
          }

          await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
          await tx.update(carts).set({ couponId: null, customerAddressId: null, updatedAt: new Date() }).where(eq(carts.id, cart.id));
        }

        await tx.update(carts).set({ branchId: branch.id, updatedAt: new Date() }).where(eq(carts.id, cart.id));

        const [existing] = await tx
          .select({ quantity: cartItems.quantity })
          .from(cartItems)
          .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, product.id)))
          .limit(1);
        const total = (existing?.quantity ?? 0) + quantity;

        await assertPurchasable(product, branch, total, tx);
        await upsertItem(tx, cart.id, product.id, total);
      });

      return;
    }

    const guest = await this.guestCart();

    if (guest.branch_id && guest.branch_id !== branch.id && guest.items.length > 0) {
      if (!switchBranch) {
        const current = await findBranch(guest.branch_id);

        if (current) {
          throw new CartBranchConflict(current);
        }
      }

      guest.items = [];
    }

    guest.branch_id = branch.id;

    const index = guest.items.findIndex(([productId]) => productId === product.id);
    const total = (index === -1 ? 0 : guest.items[index][1]) + quantity;

    await assertPurchasable(product, branch, total);

    if (index === -1) {
      guest.items.push([product.id, total]);
    } else {
      guest.items[index][1] = total;
    }

    await this.putGuestCart(guest);
  }

  /** @throws ValidationException */
  async updateItem(product: Product, quantity: number): Promise<void> {
    if (quantity < 1) {
      return this.removeItem(product);
    }

    if (this.customer) {
      const cart = await this.cartRow();
      const branch = await findBranch(cart.branchId);

      if (branch) {
        await assertPurchasable(product, branch, quantity);
      }

      await db
        .update(cartItems)
        .set({ quantity, updatedAt: new Date() })
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, product.id)));

      return;
    }

    const guest = await this.guestCart();
    const line = guest.items.find(([productId]) => productId === product.id);

    if (!line) {
      return;
    }

    const branch = await findBranch(guest.branch_id);

    if (branch) {
      await assertPurchasable(product, branch, quantity);
    }

    line[1] = quantity;
    await this.putGuestCart(guest);
  }

  async removeItem(product: Product): Promise<void> {
    if (this.customer) {
      const cart = await this.cartRow();

      await db.delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, product.id)));

      const [anyItem] = await db.select({ id: cartItems.id }).from(cartItems).where(eq(cartItems.cartId, cart.id)).limit(1);

      if (!anyItem) {
        await db.update(carts).set({ branchId: null, couponId: null, customerAddressId: null, updatedAt: new Date() }).where(eq(carts.id, cart.id));
      }

      return;
    }

    const guest = await this.guestCart();

    guest.items = guest.items.filter(([productId]) => productId !== product.id);

    if (guest.items.length === 0) {
      guest.branch_id = null;
    }

    await this.putGuestCart(guest);
  }

  async setAddress(address: Pick<Address, "id">): Promise<void> {
    const cart = await this.cartRow();

    await db.update(carts).set({ customerAddressId: address.id, updatedAt: new Date() }).where(eq(carts.id, cart.id));
  }

  /** @throws ValidationException */
  async applyCoupon(code: string): Promise<void> {
    const cart = await this.cartRow();
    const data = await this.fromCart(cart);

    if (!data.branch) {
      throw ValidationException.withMessages({ code: "Keranjang Anda masih kosong." });
    }

    const [row] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, code.toUpperCase()), isNull(coupons.deletedAt)))
      .limit(1);
    const coupon = await withBranches(row);

    await this.assertCouponUsable(coupon, data.branch, await cartSubtotal(data.branch, data.lines));

    await db.update(carts).set({ couponId: coupon!.id, updatedAt: new Date() }).where(eq(carts.id, cart.id));
  }

  async removeCoupon(): Promise<void> {
    const cart = await this.cartRow();

    await db.update(carts).set({ couponId: null, updatedAt: new Date() }).where(eq(carts.id, cart.id));
  }

  async clear(): Promise<void> {
    if (this.customer) {
      const cart = await this.cartRow();

      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      await db.update(carts).set({ branchId: null, couponId: null, customerAddressId: null, updatedAt: new Date() }).where(eq(carts.id, cart.id));

      return;
    }

    await forgetGuestCart();
  }

  /**
   * Folds a just-signed-in guest's cart into the customer's saved one. When the saved cart
   * already holds items from another branch, it wins and the guest's items are dropped:
   * signing in must never wipe a cart built on another device. Quantities are capped at
   * what is in stock rather than failing the sign-in.
   */
  async mergeGuestIntoCustomer(customer: Customer): Promise<void> {
    const guest = await this.guestCart();

    await forgetGuestCart();

    if (guest.items.length === 0) {
      return;
    }

    const cart = await this.cartRow(db, customer.id);
    const [anyItem] = await db.select({ id: cartItems.id }).from(cartItems).where(eq(cartItems.cartId, cart.id)).limit(1);

    if (cart.branchId && guest.branch_id && cart.branchId !== guest.branch_id && anyItem) {
      return;
    }

    const branchId = cart.branchId ?? guest.branch_id;

    await db.update(carts).set({ branchId, updatedAt: new Date() }).where(eq(carts.id, cart.id));

    const branch = await findBranch(branchId);

    if (!branch) {
      return;
    }

    for (const [productId, quantity] of guest.items) {
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, productId), liveProduct))
        .limit(1);

      if (!product) {
        continue;
      }

      const [existing] = await db
        .select({ quantity: cartItems.quantity })
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId)))
        .limit(1);
      const total = Math.min((existing?.quantity ?? 0) + quantity, availableOf(await stockAt(productId, branch.id)));

      if (total > 0) {
        await upsertItem(db, cart.id, productId, total);
      }
    }
  }

  /**
   * Checks the cart's coupon again at checkout, against the branch the order is placed at
   * and the cart as it is now (it may have dropped below the minimum, been switched off,
   * used up, or pickup moved the order to a branch it doesn't cover). One that no longer
   * applies is taken off the cart, so the next submit goes through without it.
   */
  async assertCouponStillUsable(coupon: Coupon | null, branch: Branch, lines: CartLine[]): Promise<void> {
    if (!coupon) {
      return;
    }

    // like Eloquent's fresh(): read again, soft-deleted or not
    const [row] = await db.select().from(coupons).where(eq(coupons.id, coupon.id)).limit(1);

    try {
      await this.assertCouponUsable(await withBranches(row), branch, await cartSubtotal(branch, lines));
    } catch (error) {
      if (!(error instanceof ValidationException)) {
        throw error;
      }

      await this.removeCoupon();

      throw ValidationException.withMessages({ code: `${error.errors.code[0]} Kode promo dilepas dari pesanan, periksa lagi totalnya.` });
    }
  }

  private async assertCouponUsable(coupon: Coupon | null, branch: Branch, subtotal: number): Promise<void> {
    const now = Date.now();

    if (!coupon || coupon.status !== "aktif") {
      throw ValidationException.withMessages({ code: "Kode promo tidak ditemukan." });
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() < now) {
      throw ValidationException.withMessages({ code: "Kode promo sudah kedaluwarsa." });
    }

    if (coupon.startsAt && coupon.startsAt.getTime() > now) {
      throw ValidationException.withMessages({ code: "Kode promo belum berlaku." });
    }

    if (couponIsExhausted(coupon)) {
      throw ValidationException.withMessages({ code: "Kuota kode promo sudah habis." });
    }

    if (coupon.branchIds.length > 0 && !coupon.branchIds.includes(branch.id)) {
      throw ValidationException.withMessages({ code: `Kode promo ini tidak berlaku di ${branch.name}.` });
    }

    if (coupon.minimumPurchase && subtotal < coupon.minimumPurchase) {
      throw ValidationException.withMessages({ code: "Belanja minimum untuk kode promo ini belum tercapai." });
    }

    if (this.customer) {
      // soft-deleted orders count too (Laravel queried withoutGlobalScopes)
      const [used] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.couponId, coupon.id), eq(orders.customerId, this.customer.id), notInArray(orders.status, ["dibatalkan", "kedaluwarsa"])))
        .limit(1);

      if (used) {
        throw ValidationException.withMessages({ code: "Anda sudah pernah memakai kode promo ini." });
      }
    }
  }

  /** The customer's cart row, created the first time it is needed (Cart::firstOrCreate). */
  private async cartRow(executor: DbExecutor = db, customerId = this.customer?.id): Promise<typeof carts.$inferSelect> {
    if (customerId === undefined) {
      throw new Error("CartManager: no signed-in customer.");
    }

    const now = new Date();

    await executor.insert(carts).values({ customerId, createdAt: now, updatedAt: now }).onConflictDoNothing({ target: carts.customerId });

    const [cart] = await executor.select().from(carts).where(eq(carts.customerId, customerId)).limit(1);

    return cart;
  }

  private async fromCart(cart: typeof carts.$inferSelect): Promise<CartData> {
    const [branch, address, coupon, items] = await Promise.all([
      findBranch(cart.branchId),
      cart.customerAddressId
        ? db.select().from(customerAddresses).where(eq(customerAddresses.id, cart.customerAddressId)).limit(1).then(([row]) => row ?? null)
        : null,
      cart.couponId
        ? db
            .select()
            .from(coupons)
            .where(and(eq(coupons.id, cart.couponId), isNull(coupons.deletedAt)))
            .limit(1)
            .then(([row]) => withBranches(row))
        : null,
      db
        .select({ product: products, quantity: cartItems.quantity })
        .from(cartItems)
        .innerJoin(products, and(eq(products.id, cartItems.productId), liveProduct))
        .where(eq(cartItems.cartId, cart.id))
        .orderBy(asc(cartItems.id)),
    ]);

    return { branch, address, coupon, lines: items };
  }

  private async fromGuest(): Promise<CartData> {
    const guest = await this.guestCart();
    const branch = await findBranch(guest.branch_id);
    const ids = guest.items.map(([productId]) => productId);
    const rows = ids.length
      ? await db
          .select()
          .from(products)
          .where(and(inArray(products.id, ids), liveProduct))
      : [];
    const byId = new Map(rows.map((product) => [product.id, product]));

    return {
      branch,
      address: null,
      coupon: null,
      lines: guest.items.flatMap(([productId, quantity]) => {
        const product = byId.get(productId);

        return product ? [{ product, quantity }] : [];
      }),
    };
  }

  private async guestCart(): Promise<GuestCart> {
    const token = this.guestToken !== undefined ? this.guestToken : (await cookies()).get(GUEST_CART_COOKIE)?.value;
    const stored = token ? await redis.get(guestCartKey(token)) : null;

    if (!token || !stored) {
      return { branch_id: null, items: [] };
    }

    await redis.expire(guestCartKey(token), GUEST_CART_SECONDS);

    return JSON.parse(stored) as GuestCart;
  }

  private async putGuestCart(guest: GuestCart): Promise<void> {
    const store = await cookies();
    let token = store.get(GUEST_CART_COOKIE)?.value;

    if (!token) {
      token = randomBytes(32).toString("base64url");
      store.set(GUEST_CART_COOKIE, token, guestCartCookieOptions());
    }

    await redis.set(guestCartKey(token), JSON.stringify(guest), "EX", GUEST_CART_SECONDS);
  }
}

async function upsertItem(executor: DbExecutor, cartId: number, productId: number, quantity: number): Promise<void> {
  const now = new Date();

  await executor
    .insert(cartItems)
    .values({ cartId, productId, quantity, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.productId], set: { quantity, updatedAt: now } });
}

/**
 * Refuses more than the branch has. The per-order limit is not checked here on purpose: a
 * cart may hold more so the shopper sees which line is over and why; checkout enforces it.
 */
async function assertPurchasable(product: Product, branch: Branch, totalRequested: number, executor: DbExecutor = db): Promise<void> {
  const available = availableOf(await stockAt(product.id, branch.id, executor));

  if (totalRequested > available) {
    throw ValidationException.withMessages({ quantity: `Stok ${product.name} di ${branch.name} hanya tersisa ${available}.` });
  }
}

export function exceedsPurchaseLimit(lines: CartLine[]): boolean {
  return lines.some((line) => line.quantity > purchaseLimit(line.product.maxQtyPerOrder));
}

/** Refuses an order holding more of any product than its limit. */
export function assertWithinPurchaseLimit(lines: CartLine[]): void {
  if (exceedsPurchaseLimit(lines)) {
    throw ValidationException.withMessages({ quantity: OVER_LIMIT_MESSAGE });
  }
}

/** Live prices at a branch: its price override when it has one, else the national price. */
export async function cartSubtotal(branch: Pick<Branch, "id">, lines: CartLine[], executor: DbExecutor = db): Promise<number> {
  const stocks = await stocksAt(branch.id, lines.map((line) => line.product.id), executor);

  return lines.reduce((sum, line) => sum + (stocks.get(line.product.id)?.priceOverride ?? line.product.price) * line.quantity, 0);
}

/**
 * The branch a delivery order ships from: the cart's own branch when it delivers, else
 * the first active delivering branch that lists every line with enough stock (a cart
 * started at a pickup-only branch can still be delivered). Null when none can.
 */
export async function deliveryBranch(cartBranch: Branch, lines: CartLine[]): Promise<Branch | null> {
  if (cartBranch.supportsDelivery) {
    return cartBranch;
  }

  const candidates = await db
    .select()
    .from(branches)
    .where(and(eq(branches.status, "aktif"), eq(branches.supportsDelivery, true), liveBranch))
    .orderBy(asc(branches.id));

  for (const candidate of candidates) {
    const stocks = await stocksAt(candidate.id, lines.map((line) => line.product.id));
    const fits = lines.every((line) => {
      const stock = stocks.get(line.product.id);

      return stock !== undefined && stock.isListed && availableOf(stock) >= line.quantity;
    });

    if (fits) {
      return candidate;
    }
  }

  return null;
}
