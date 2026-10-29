import { Link, router } from '@/lib/inertia';
import DesktopPage, { statusTone } from './DesktopPage';
import { money } from './data';

/**
 * Desktop order detail: the products, delivery or pickup details and the
 * note on the left; the payment summary and the Bayar/Batalkan actions on
 * the right.
 */
export default function DesktopOrderDetail({ order }: { order: OrderDetailData }) {
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
        <DesktopPage
            title="Detail Pesanan"
            breadcrumb={[{ label: 'Riwayat pesanan', href: '/order-history' }, { label: `#${order.number}` }]}
            heading={
                <span className="flex items-center gap-4">
                    Pesanan #{order.number}
                    <span className={`px-3 py-1 font-sans text-[11px] font-bold ${statusTone(order.status)}`}>
                        {order.status}
                    </span>
                </span>
            }
            actions={
                order.steps.length > 0 ? (
                    <Link
                        href={`/track-order/${order.number}`}
                        className="flex h-10 items-center border border-line bg-white px-5 text-[13px] font-bold text-brand"
                    >
                        Lacak Pesanan
                    </Link>
                ) : null
            }
        >
            <p className="-mt-4 mb-6 text-[12px] text-muted">Dipesan pada {order.date}</p>

            <div className="grid grid-cols-[1fr_360px] items-start gap-8">
                <div className="space-y-6">
                    <section className="border border-line bg-white">
                        <h2 className="border-b border-line px-6 py-4 font-display text-[16px]">Produk</h2>

                        <ul>
                            {order.items.map((item) => (
                                <li
                                    key={item.sku}
                                    className="flex items-center gap-5 border-b border-line px-6 py-5 last:border-b-0"
                                >
                                    <Link href={`/product-detail?id=${item.sku}`} className="h-16 w-16 shrink-0">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                                        ) : null}
                                    </Link>

                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={`/product-detail?id=${item.sku}`}
                                            className="text-[13px] font-bold leading-5 text-brand"
                                        >
                                            {item.name}
                                        </Link>
                                        <div className="mt-1 text-[12px] text-muted">
                                            {item.unitPrice ? `${money(item.unitPrice)} × ` : '× '}
                                            {item.quantity}
                                        </div>
                                    </div>

                                    <div className="text-[13px]">{money(item.lineTotal)}</div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <div className="grid grid-cols-2 gap-6">
                        {order.fulfilment === 'Antar' && order.shippingAddress ? (
                            <section className="border border-line bg-white p-6">
                                <h2 className="mb-3 font-display text-[16px]">Dikirim ke</h2>
                                <p className="text-[13px] font-bold">{order.recipientName}</p>
                                <p className="mt-0.5 text-[13px] text-muted">{order.recipientPhone}</p>
                                <p className="mt-2 text-[13px] leading-6 text-muted">{order.shippingAddress}</p>
                            </section>
                        ) : order.branch ? (
                            <section className="border border-line bg-white p-6">
                                <h2 className="mb-3 font-display text-[16px]">Ambil di toko</h2>
                                <p className="text-[13px] font-bold">{order.branch.name}</p>
                                <p className="mt-2 text-[13px] leading-6 text-muted">{order.branch.fullAddress}</p>
                            </section>
                        ) : null}

                        {order.note ? (
                            <section className="border border-line bg-white p-6">
                                <h2 className="mb-3 font-display text-[16px]">Catatan</h2>
                                <p className="text-[13px] leading-6 text-muted">{order.note}</p>
                            </section>
                        ) : null}
                    </div>
                </div>

                <aside className="space-y-4">
                    <div className="border border-line bg-white p-6">
                        <dl className="space-y-3 text-[13px]">
                            <div className="flex justify-between">
                                <dt>Subtotal</dt>
                                <dd>{money(order.subtotal)}</dd>
                            </div>

                            {order.discount > 0 ? (
                                <div className="flex justify-between text-brand">
                                    <dt>Diskon</dt>
                                    <dd>-{money(order.discount)}</dd>
                                </div>
                            ) : null}

                            <div className="flex justify-between">
                                <dt>Ongkir</dt>
                                <dd>{order.shipping > 0 ? money(order.shipping) : 'Gratis'}</dd>
                            </div>

                            <div className="flex justify-between border-b border-line pb-3 text-muted">
                                <dt>Metode pembayaran</dt>
                                <dd>{order.paymentMethod === 'online' ? 'Online (DOKU)' : order.paymentMethod}</dd>
                            </div>

                            <div className="flex items-baseline justify-between pt-1 text-[16px] font-bold text-brand">
                                <dt>Total</dt>
                                <dd>{money(order.total)}</dd>
                            </div>
                        </dl>

                        {order.canPay ? (
                            <button
                                type="button"
                                onClick={pay}
                                className="mt-6 flex h-[52px] w-full items-center justify-center bg-success text-[14px] font-bold text-white"
                            >
                                Lanjutkan Pembayaran
                            </button>
                        ) : null}

                        {order.isCancellable ? (
                            <button
                                type="button"
                                onClick={cancel}
                                className="mt-3 flex h-11 w-full items-center justify-center border border-line text-[13px] font-bold text-muted hover:text-danger"
                            >
                                Batalkan Pesanan
                            </button>
                        ) : null}
                    </div>
                </aside>
            </div>
        </DesktopPage>
    );
}
