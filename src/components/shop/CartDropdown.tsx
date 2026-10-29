import { DISABLED_ACTION_CLASSES, OVER_LIMIT_MESSAGE, hasOverLimit, isOverLimit } from '@/lib/purchaseLimit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, router } from '@/lib/inertia';
import Icon from './Icon';
import useCartCount from './useCartCount';
import { money } from './data';

/**
 * Header cart button with a Shopify-style dropdown: the lines in the cart with
 * a quantity stepper and remove link, the total, and the two ways onward.
 *
 * The lines are fetched from the JSON summary endpoint each time the panel
 * opens and whenever the cart count changes, so adding a product anywhere on
 * the page refreshes it. Quantity and removal use the same endpoints as the
 * Cart page.
 */
export default function CartDropdown() {
    const cartCount = useCartCount();
    const [open, setOpen] = useState(false);
    const [cart, setCart] = useState<CartPreview | null>(null);
    const [busySku, setBusySku] = useState<string | null>(null);
    const wrapper = useRef<HTMLDivElement>(null);

    const load = useCallback(() => {
        fetch('/keranjang/ringkas', { headers: { Accept: 'application/json' } })
            .then((response) => (response.ok ? response.json() : Promise.reject()))
            .then((body: CartPreview) => setCart(body))
            .catch(() => setCart((current) => current));
    }, []);

    useEffect(() => {
        if (open) {
            load();
        }
    }, [open, cartCount, load]);

    useEffect(() => {
        if (! open) {
            return;
        }

        const onPointerDown = (event: MouseEvent) => {
            if (wrapper.current && ! wrapper.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    useEffect(() => router.on('navigate', () => setOpen(false)), []);

    const changeQuantity = (item: CartPreviewItem, quantity: number) => {
        setBusySku(item.sku);

        router.patch(
            `/keranjang/${item.sku}`,
            { quantity },
            { preserveScroll: true, preserveState: true, onFinish: () => { setBusySku(null); load(); } },
        );
    };

    const removeItem = (item: CartPreviewItem) => {
        setBusySku(item.sku);

        router.delete(`/keranjang/${item.sku}`, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => { setBusySku(null); load(); },
        });
    };

    const items = cart?.items ?? [];

    return (
        <div ref={wrapper} className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => ! current)}
                aria-expanded={open}
                aria-haspopup="true"
                className="flex shrink-0 items-center gap-2 text-[13px] font-bold"
            >
                <span id="cart-icon-target" className="relative flex items-center">
                    <Icon name="cart" size={22} />

                    <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-success px-1 text-[9px] font-bold text-white">
                        {cartCount}
                    </span>
                </span>
                Keranjang
            </button>

            {open ? (
                <>
                    {/* The little tail joining the panel to the cart icon. It is centred under
                        the icon (11px in from the button's left edge) and sits over the panel's
                        top edge, so the two read as one bubble. */}
                    <span
                        aria-hidden="true"
                        className="absolute left-[5px] top-[calc(100%+6px)] z-[60] h-3 w-3 rotate-45 border-l border-t border-black/10 bg-white"
                    />

                <div className="absolute right-0 top-full z-50 mt-3 w-[440px] rounded-[4px] bg-white text-ink shadow-pop ring-1 ring-black/5">
                    {items.length === 0 ? (
                        <p className="px-6 py-10 text-center text-[13px] text-muted">Keranjang kamu masih kosong.</p>
                    ) : (
                        <>
                            <ul className="max-h-[320px] overflow-y-auto px-6 py-4">
                                {items.map((item) => (
                                    <li key={item.sku} className="flex gap-4 border-b border-line py-4 last:border-b-0">
                                        <Link
                                            href={`/product-detail?id=${item.sku}`}
                                            className="h-16 w-16 shrink-0"
                                        >
                                            <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                                        </Link>

                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] uppercase text-muted">{item.brand}</div>
                                            <Link
                                                href={`/product-detail?id=${item.sku}`}
                                                className="mt-1 line-clamp-2 text-[13px] font-bold leading-5 text-brand"
                                            >
                                                {item.name}
                                            </Link>
                                            <div className="mt-1 text-[12px] text-success">{money(item.unitPrice)}</div>
                                            {isOverLimit(item.quantity, item) ? (
                                                <div role="alert" className="mt-1.5 text-[12px] font-semibold leading-snug text-danger">
                                                    {OVER_LIMIT_MESSAGE}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="flex shrink-0 flex-col items-center gap-2">
                                            <div className="flex items-center border border-line text-muted">
                                                <button
                                                    type="button"
                                                    disabled={busySku === item.sku || item.quantity <= 1}
                                                    onClick={() => changeQuantity(item, item.quantity - 1)}
                                                    aria-label={`Kurangi jumlah ${item.name}`}
                                                    className="flex h-8 w-8 items-center justify-center disabled:opacity-40 enabled:hover:text-brand"
                                                >
                                                    &minus;
                                                </button>
                                                <span className="flex h-8 w-9 items-center justify-center text-[13px] text-brand">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={busySku === item.sku || item.quantity >= item.available}
                                                    onClick={() => changeQuantity(item, item.quantity + 1)}
                                                    aria-label={`Tambah jumlah ${item.name}`}
                                                    className="flex h-8 w-8 items-center justify-center disabled:opacity-40 enabled:hover:text-brand"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                disabled={busySku === item.sku}
                                                onClick={() => removeItem(item)}
                                                className="text-[11px] text-muted hover:text-danger disabled:opacity-40"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="border-t border-line px-6 pb-6 pt-5">
                                <div className="flex items-center justify-between text-[14px] font-bold text-brand">
                                    <span>Total</span>
                                    <span>{money(cart?.subtotal ?? 0)}</span>
                                </div>

                                <p className="mt-4 text-[13px] text-danger">
                                    Mohon maaf, saat ini pembelian belum dapat diproses.
                                </p>

                                <div className="mt-5 grid grid-cols-2 gap-4">
                                    <Link
                                        href="/cart"
                                        className="flex h-11 items-center justify-center bg-brand text-[13px] font-bold text-white"
                                    >
                                        Lihat keranjang
                                    </Link>
                                    {hasOverLimit(cart?.items ?? []) ? (
                                        <span
                                            aria-disabled="true"
                                            className={`flex h-11 items-center justify-center text-[13px] font-bold ${DISABLED_ACTION_CLASSES}`}
                                        >
                                            Check-out
                                        </span>
                                    ) : (
                                        <Link
                                            href={'/checkout'}
                                            className="flex h-11 items-center justify-center bg-success text-[13px] font-bold text-white"
                                        >
                                            Check-out
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                </>
            ) : null}
        </div>
    );
}
