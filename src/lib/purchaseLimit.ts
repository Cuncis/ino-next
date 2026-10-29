/**
 * The per-order cap on one product. Each product has its own cap, 2 unless
 * staff changed it (the server sends it as `purchaseLimit`), and a cart or product page may go over it so
 * the shopper sees which line is the problem: the message shows in red and the
 * add-to-cart and checkout buttons turn gray until the quantity is back
 * within the limit. The server enforces the same rule at checkout.
 */

/** Same text as `App\Models\Product::OVER_LIMIT_MESSAGE`. */
export const OVER_LIMIT_MESSAGE = 'Produk ini memiliki maksimum jumlah pembelian untuk pemakaian 3 hari';

const DEFAULT_PURCHASE_LIMIT = 2;

type Limited = { purchaseLimit?: number };

export const isOverLimit = (quantity: number, item: Limited): boolean =>
    quantity > (item.purchaseLimit ?? DEFAULT_PURCHASE_LIMIT);

export const hasOverLimit = (items: (Limited & { quantity: number })[]): boolean =>
    items.some((item) => isOverLimit(item.quantity, item));

/** Classes for a button or link that is switched off by the limit. */
export const DISABLED_ACTION_CLASSES = 'pointer-events-none cursor-not-allowed bg-[#c9c9c9]! text-white! opacity-100!';
