'use client';

import { Link, router } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import FlashBanner from '@/components/shop/FlashBanner';
import Icon from '@/components/shop/Icon';
import DesktopOrderDetail from '@/components/shop/DesktopOrderDetail';
import useIsDesktop from '@/components/shop/useIsDesktop';
import { money } from '@/components/shop/data';

/**
 * Items, total, and the Bayar/Batalkan actions for one of the customer's own
 * orders — split from Lacak Pesanan (`TrackOrder.jsx`), which stays a
 * read-only shipment/pickup timeline with no actions of its own.
 */
export default function OrderDetail({ order }: { order: OrderDetailData }) {
    const isDesktop = useIsDesktop();

    if (isDesktop) {
        return <DesktopOrderDetail order={order} />;
    }

    const cancel = () => {
        if (! window.confirm(`Batalkan pesanan #${order.number}?`)) {
            return;
        }

        router.post(`/pesanan/${order.number}/batalkan`);
    };

    const pay = () => {
        router.post(`/pesanan/${order.number}/bayar`);
    };

    return (
        <MobileLayout
            title="Detail Pesanan"
            header={<AppBar title="Detail Pesanan" back="/order-history" tone="brand" />}
        >
            <FlashBanner />

            <div className="flex-1 overflow-y-auto p-3.5">
                <div className="mb-3.5 flex items-center justify-between rounded-[2px] border border-line bg-white p-3.5">
                    <div>
                        <div className="font-display text-sm">#{order.number}</div>
                        <div className="mt-0.5 text-[11px] text-muted">{order.date}</div>
                    </div>

                    <span className="px-2.5 py-[3px] text-[11px] font-bold text-brand">
                        {order.status}
                    </span>
                </div>

                {order.steps.length > 0 ? (
                    <Link
                        href={`/track-order/${order.number}`}
                        className="mb-3.5 flex items-center justify-between rounded-[2px] border border-line bg-white p-3.5 text-xs"
                    >
                        <span className="flex items-center gap-2">
                            <Icon name="navigation" size={15} className="text-brand" />
                            Lacak Pesanan
                        </span>
                        <Icon name="chevronRight" size={15} className="text-faint" />
                    </Link>
                ) : null}

                {order.fulfilment === 'Antar' && order.shippingAddress ? (
                    <div className="mb-3.5 rounded-[2px] border border-line bg-white p-3.5">
                        <div className="mb-1.5 text-[13px] font-display">Dikirim ke</div>
                        <p className="text-xs text-muted">
                            {order.recipientName} · {order.recipientPhone}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{order.shippingAddress}</p>
                    </div>
                ) : null}

                <div className="mb-3.5 rounded-[2px] border border-line bg-white p-3.5">
                    <div className="mb-2 border-b border-line pb-2 font-display text-[13px]">
                        Produk
                    </div>

                    {order.items.map((item) => (
                        <div key={item.sku} className="mb-1.5 flex justify-between text-xs text-muted">
                            <span>{item.name} x{item.quantity}</span>
                            <span>{money(item.lineTotal)}</span>
                        </div>
                    ))}
                </div>

                <div className="mb-3.5 rounded-[2px] border border-line bg-white p-3.5">
                    <div className="mb-1.5 flex justify-between text-[13px]">
                        <span>Subtotal</span>
                        <span>{money(order.subtotal)}</span>
                    </div>

                    {order.discount > 0 ? (
                        <div className="mb-1.5 flex justify-between text-[13px] text-brand">
                            <span>Diskon</span>
                            <span>-{money(order.discount)}</span>
                        </div>
                    ) : null}

                    <div className="mb-1.5 flex justify-between text-[13px]">
                        <span>Ongkir</span>
                        <span>{order.shipping > 0 ? money(order.shipping) : 'Gratis'}</span>
                    </div>

                    <div className="mb-1.5 flex justify-between border-b border-line pb-1.5 text-[13px] text-muted">
                        <span>Metode pembayaran</span>
                        <span>{order.paymentMethod === 'online' ? 'Online (DOKU)' : order.paymentMethod}</span>
                    </div>

                    <div className="flex justify-between text-[13px]">
                        <span className="font-bold">Total</span>
                        <span className="font-bold">{money(order.total)}</span>
                    </div>
                </div>

                {order.note ? (
                    <div className="mb-3.5 rounded-[2px] border border-line bg-white p-3.5">
                        <div className="mb-1 text-[13px] font-display">Catatan</div>
                        <p className="text-xs text-muted">{order.note}</p>
                    </div>
                ) : null}

                {order.canPay ? (
                    <Button onClick={pay} className="mb-2">
                        Lanjutkan Pembayaran
                    </Button>
                ) : null}

                {order.isCancellable ? (
                    <Button variant="outline" onClick={cancel} className="mb-2">
                        Batalkan Pesanan
                    </Button>
                ) : null}
            </div>
        </MobileLayout>
    );
}
