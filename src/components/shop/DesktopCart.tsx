import { DISABLED_ACTION_CLASSES, OVER_LIMIT_MESSAGE, hasOverLimit, isOverLimit } from '@/lib/purchaseLimit';
import { Link } from '@/lib/inertia';
import DesktopLayout from '@/layouts/DesktopLayout';
import DesktopHeader from './DesktopHeader';
import FlashBanner from './FlashBanner';
import RecentlyViewed from './RecentlyViewed';
import useCartActions from './useCartActions';
import useShopUser from './useShopUser';
import { money } from './data';

/**
 * Desktop cart page: a product table (photo, brand, name, quantity stepper,
 * line total) beside a summary card with the total, an optional promo code and
 * the check-out button.
 */
export default function DesktopCart({ cart }: {
    cart: {
        branch: CartBranch | null;
        items: CartPreviewItem[];
        subtotal: number;
        coupon: CartCoupon | null;
        discount: number;
    };
}) {
    const { signedIn } = useShopUser();
    const { busySku, promo, setPromo, couponError, changeQuantity, removeItem, applyPromo, removePromo }
        = useCartActions();

    const total = Math.max(cart.subtotal - cart.discount, 0);

    return (
        <DesktopLayout title="Keranjang" header={<DesktopHeader />}>
            <h1 className="pb-8 pt-10 font-display text-[28px] text-brand">Keranjang saya</h1>

            <FlashBanner />

            <div className="grid grid-cols-[1fr_360px] items-start gap-8">
                <div className="border border-line bg-white">
                    <div className="grid grid-cols-[1fr_160px_110px] items-center border-b border-line px-6 py-5 text-[12px] text-muted">
                        <span>Produk</span>
                        <span className="text-center">Kuantitas</span>
                        <span className="text-right">Total</span>
                    </div>

                    {cart.items.map((item) => (
                        <div
                            key={item.sku}
                            className="grid grid-cols-[1fr_160px_110px] items-center border-b border-line px-6 py-5 last:border-b-0"
                        >
                            <div className="flex items-center gap-5">
                                <Link href={`/product-detail?id=${item.sku}`} className="h-20 w-20 shrink-0">
                                    <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                                </Link>

                                <div className="min-w-0">
                                    <div className="text-[10px] uppercase text-muted">{item.brand}</div>
                                    <Link
                                        href={`/product-detail?id=${item.sku}`}
                                        className="mt-1 block text-[13px] font-bold leading-5 text-brand"
                                    >
                                        {item.name}
                                    </Link>
                                    <div className="mt-1 text-[12px] font-bold text-success">{money(item.unitPrice)}</div>

                                    {item.quantity > item.available ? (
                                        <div className="mt-1 text-[11px] text-danger">Stok tersisa {item.available}</div>
                                    ) : null}
                                    {isOverLimit(item.quantity, item) ? (
                                        <div role="alert" className="mt-1.5 max-w-sm text-[13px] font-semibold leading-snug text-danger">
                                            {OVER_LIMIT_MESSAGE}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center border border-line text-muted">
                                    <button
                                        type="button"
                                        disabled={busySku === item.sku || item.quantity <= 1}
                                        onClick={() => changeQuantity(item, item.quantity - 1)}
                                        aria-label={`Kurangi jumlah ${item.name}`}
                                        className="flex h-9 w-9 items-center justify-center disabled:opacity-40 enabled:hover:text-brand"
                                    >
                                        &minus;
                                    </button>
                                    <span className="flex h-9 w-10 items-center justify-center text-[13px] text-brand">
                                        {item.quantity}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={busySku === item.sku || item.quantity >= item.available}
                                        onClick={() => changeQuantity(item, item.quantity + 1)}
                                        aria-label={`Tambah jumlah ${item.name}`}
                                        className="flex h-9 w-9 items-center justify-center disabled:opacity-40 enabled:hover:text-brand"
                                    >
                                        +
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    disabled={busySku === item.sku}
                                    onClick={() => removeItem(item)}
                                    className="text-[12px] text-muted hover:text-danger disabled:opacity-40"
                                >
                                    Hapus
                                </button>
                            </div>

                            <div className="text-right text-[13px] text-muted">{money(item.lineTotal)}</div>
                        </div>
                    ))}
                </div>

                <aside>
                    <div className="border border-line bg-white p-6">
                        <div className="flex items-center justify-between text-[16px] font-bold text-brand">
                            <span>Total</span>
                            <span>{money(total)}</span>
                        </div>

                        {cart.discount > 0 ? (
                            <div className="mt-3 flex justify-between text-[12px] text-muted">
                                <span>Subtotal {money(cart.subtotal)}</span>
                                <span className="text-brand">Diskon -{money(cart.discount)}</span>
                            </div>
                        ) : null}

                        <details className="group mt-5 border-t border-line" open={Boolean(cart.coupon)}>
                            <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[13px] text-muted">
                                Kode promo
                                <span className="text-[10px] transition-transform group-open:rotate-180">&#9660;</span>
                            </summary>

                            <div className="pb-4">
                                {signedIn ? (
                                    cart.coupon ? (
                                        <div className="flex h-11 items-center justify-between border border-brand bg-brand/5 px-3.5 text-[12px]">
                                            <span className="font-bold text-brand">{cart.coupon.code}</span>
                                            <button
                                                type="button"
                                                onClick={removePromo}
                                                className="text-[11px] font-bold uppercase text-muted"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-[1fr_auto] gap-2">
                                            <input
                                                value={promo}
                                                onChange={(event) => setPromo(event.target.value)}
                                                placeholder="Masukkan kode promo"
                                                className="h-11 min-w-0 border border-line px-3.5 text-[12px] text-muted placeholder:text-[#bbbbbb] focus:outline-hidden focus:ring-0"
                                            />
                                            <button
                                                type="button"
                                                onClick={applyPromo}
                                                className="h-11 border border-line bg-lilac px-4 text-[12px] font-bold uppercase"
                                            >
                                                Pakai
                                            </button>
                                        </div>
                                    )
                                ) : (
                                    <p className="text-[12px] text-muted">
                                        <Link href="/signin" className="text-brand">Masuk</Link> untuk memakai kode promo.
                                    </p>
                                )}

                                {couponError ? <p className="mt-1 text-[11px] text-danger">{couponError}</p> : null}
                            </div>
                        </details>

                        <p className="border-t border-line pb-5 pt-5 text-[13px] leading-7 text-muted">
                            Pajak dan ongkos kirim dihitung saat pembayaran
                        </p>

                        {hasOverLimit(cart.items) ? (
                            <span
                                aria-disabled="true"
                                className={`flex h-[52px] items-center justify-center text-[14px] font-bold ${DISABLED_ACTION_CLASSES}`}
                            >
                                Check-out
                            </span>
                        ) : (
                            <Link
                                href={'/checkout'}
                                className="flex h-[52px] items-center justify-center bg-success text-[14px] font-bold text-white"
                            >
                                Check-out
                            </Link>
                        )}
                    </div>

                    <p className="mt-6 flex items-center justify-center gap-2 text-[13px] font-medium text-muted">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <rect x="5" y="11" width="14" height="9" rx="1.5" />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                        </svg>
                        Pembayaran 100% Aman
                    </p>
                </aside>
            </div>

            <RecentlyViewed />
        </DesktopLayout>
    );
}
