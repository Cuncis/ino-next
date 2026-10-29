'use client';

import { DISABLED_ACTION_CLASSES, OVER_LIMIT_MESSAGE, hasOverLimit, isOverLimit } from '@/lib/purchaseLimit';
import { Link } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import FlashBanner from '@/components/shop/FlashBanner';
import Icon from '@/components/shop/Icon';
import IconLink from '@/components/shop/IconLink';
import TabBar from '@/components/shop/TabBar';
import DesktopCart from '@/components/shop/DesktopCart';
import useCartActions from '@/components/shop/useCartActions';
import useIsDesktop from '@/components/shop/useIsDesktop';
import useShopUser from '@/components/shop/useShopUser';
import { money } from '@/components/shop/data';

export default function Cart({ cart }: { cart: {
  branch: CartBranch | null, address: SavedAddress | null, items: CartPreviewItem[], itemCount: number,
  subtotal: number, coupon: CartCoupon | null, discount: number,
} }) {
    const { signedIn } = useShopUser();
    const { busySku, promo, setPromo, couponError, changeQuantity, removeItem, applyPromo, removePromo }
        = useCartActions();
    const isDesktop = useIsDesktop();

    const total = Math.max(cart.subtotal - cart.discount, 0);

    if (isDesktop) {
        return <DesktopCart cart={cart} />;
    }

    return (
        <MobileLayout
            title="Keranjang"
            header={
                <AppBar
                    title="Pesanan"
                    tone="brand"
                    actions={
                        <IconLink name="history" href="/order-history" label="Riwayat transaksi" />
                    }
                />
            }
            footer={<TabBar active="order" />}
        >
            <FlashBanner />

            <div className="flex-1 overflow-y-auto px-3.5 pt-3.5">
                {cart.branch ? (
                    <div className="mb-3 rounded-[2px] border border-line bg-white p-2.5 text-[11px]">
                        <div className="flex items-center gap-2">
                            <Icon name="pin" size={14} className="shrink-0 text-brand" />
                            <span>
                                Belanja dari <strong>{cart.branch.name}</strong> ({cart.branch.kota})
                            </span>
                        </div>

                        {cart.branch.apjName && cart.branch.apjWhatsappUrl ? (
                            <a
                                href={cart.branch.apjWhatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1.5 flex items-center gap-2 text-brand"
                            >
                                <Icon name="phone" size={14} className="shrink-0" />
                                Tanya Apoteker {cart.branch.apjName} di WhatsApp
                            </a>
                        ) : null}
                    </div>
                ) : null}

                {cart.items.map((item) => (
                    <div
                        key={item.sku}
                        className="mb-2 flex min-h-[88px] gap-2.5 overflow-hidden rounded-[2px] border border-line bg-white p-2.5"
                    >
                        <Link
                            href={`/product-detail?id=${item.sku}`}
                            className="relative w-[68px] shrink-0"
                        >
                            <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-[68px] object-cover"
                            />
                        </Link>

                        <Link
                            href={`/product-detail?id=${item.sku}`}
                            className="flex flex-1 flex-col justify-center"
                        >
                            <div className="mb-1 text-[13px] font-semibold text-ink">
                                {item.name}
                            </div>
                            <div className="text-xs font-bold text-muted">
                                {money(item.unitPrice)}
                            </div>
                            {item.quantity > item.available ? (
                                <div className="mt-1 text-[10px] font-semibold text-danger">
                                    Stok tersisa {item.available}
                                </div>
                            ) : null}
                            {isOverLimit(item.quantity, item) ? (
                                <div role="alert" className="mt-1 text-[12px] font-semibold leading-snug text-danger">
                                    {OVER_LIMIT_MESSAGE}
                                </div>
                            ) : null}
                        </Link>

                        <div className="flex min-w-[24px] flex-col items-center justify-between py-1">
                            <button
                                type="button"
                                disabled={busySku === item.sku}
                                onClick={() => changeQuantity(item, item.quantity + 1)}
                                aria-label={`Tambah jumlah ${item.name}`}
                                className="flex h-[22px] w-[22px] items-center justify-center border border-line text-sm leading-none disabled:opacity-40 enabled:hover:text-brand"
                            >
                                +
                            </button>

                            <span className="text-xs text-brand">{item.quantity}</span>

                            <button
                                type="button"
                                disabled={busySku === item.sku}
                                onClick={() =>
                                    item.quantity <= 1
                                        ? removeItem(item)
                                        : changeQuantity(item, item.quantity - 1)
                                }
                                aria-label={`Kurangi jumlah ${item.name}`}
                                className="flex h-[22px] w-[22px] items-center justify-center border border-line text-sm leading-none disabled:opacity-40 enabled:hover:text-brand"
                            >
                                −
                            </button>
                        </div>
                    </div>
                ))}

                {signedIn ? (
                    <div className="mb-[18px]">
                        {cart.coupon ? (
                            <div className="flex h-[50px] items-center justify-between border border-brand bg-brand/5 px-3.5 text-xs">
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
                            <div className="grid grid-cols-[1.5fr_1fr] gap-2">
                                <input
                                    value={promo}
                                    onChange={(event) => setPromo(event.target.value)}
                                    placeholder="Masukkan kode promo"
                                    className="h-[50px] border border-blush px-3.5 text-xs text-muted placeholder:text-[#bbbbbb] focus:outline-hidden focus:ring-0"
                                />

                                <button
                                    type="button"
                                    onClick={applyPromo}
                                    className="flex h-[50px] items-center justify-center border border-line bg-lilac text-xs font-bold uppercase"
                                >
                                    Pakai
                                </button>
                            </div>
                        )}

                        {couponError ? (
                            <p className="mt-1 text-[11px] text-danger">{couponError}</p>
                        ) : null}
                    </div>
                ) : (
                    <p className="mb-[18px] text-[11px] text-muted">
                        <Link href="/signin" className="text-brand">
                            Masuk
                        </Link>{' '}
                        untuk memakai kode promo.
                    </p>
                )}

                <div className="mb-3.5 rounded-[2px] border border-line bg-white p-3.5">
                    <div className="mb-1.5 flex justify-between text-[13px]">
                        <span>Subtotal</span>
                        <span className="font-bold">{money(cart.subtotal)}</span>
                    </div>

                    {cart.discount > 0 ? (
                        <div className="mb-1.5 flex justify-between text-[13px]">
                            <span>Diskon</span>
                            <span className="text-brand">-{money(cart.discount)}</span>
                        </div>
                    ) : null}

                    <div className="mb-1.5 flex justify-between border-b border-line pb-1.5 text-[13px] text-muted">
                        <span>Ongkir &amp; pajak</span>
                        <span>Dihitung saat checkout</span>
                    </div>

                    <div className="flex justify-between text-[13px]">
                        <span className="font-bold">Total</span>
                        <span className="font-bold">{money(total)}</span>
                    </div>
                </div>

                {hasOverLimit(cart.items) ? (
                    <Button disabled className={`mb-2 ${DISABLED_ACTION_CLASSES}`}>
                        Lanjut ke Pembayaran
                    </Button>
                ) : (
                    <Button href={'/checkout'} className="mb-2">
                        Lanjut ke Pembayaran
                    </Button>
                )}
            </div>
        </MobileLayout>
    );
}
