import { Link } from '@/lib/inertia';
import DesktopPage, { statusTone } from './DesktopPage';
import { money } from './data';

/** Desktop order history: one table row per order, the whole row opens it. */
export default function DesktopOrderHistory({ orders }: { orders: OrderListItem[] }) {
    return (
        <DesktopPage title="Riwayat Pesanan" heading="Riwayat Pesanan" breadcrumb={[{ label: 'Riwayat pesanan' }]}>
            {orders.length === 0 ? (
                <div className="border border-line bg-white px-6 py-16 text-center">
                    <p className="mb-4 text-[14px] text-muted">Anda belum pernah memesan.</p>
                    <Link href="/shop" className="inline-flex h-11 items-center bg-success px-6 text-[13px] font-bold text-white">
                        Mulai belanja
                    </Link>
                </div>
            ) : (
                <div className="border border-line bg-white">
                    <div className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr_1fr_1fr] border-b border-line px-6 py-4 text-[12px] text-muted">
                        <span>Pesanan</span>
                        <span>Tanggal</span>
                        <span>Cara terima</span>
                        <span>Cabang</span>
                        <span>Status</span>
                        <span className="text-right">Total</span>
                    </div>

                    {orders.map((order) => (
                        <Link
                            key={order.number}
                            href={`/pesanan/${order.number}`}
                            className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr_1fr_1fr] items-center border-b border-line px-6 py-5 text-[13px] last:border-b-0 hover:bg-lilac"
                        >
                            <span className="font-bold text-brand">#{order.number}</span>
                            <span className="text-muted">{order.date}</span>
                            <span className="text-muted">{order.fulfilment}</span>
                            <span className="text-muted">{order.branchName}</span>
                            <span>
                                <span className={`px-2.5 py-[3px] text-[11px] font-bold ${statusTone(order.status)}`}>
                                    {order.status}
                                </span>
                            </span>
                            <span className="text-right font-bold">{money(order.total)}</span>
                        </Link>
                    ))}
                </div>
            )}
        </DesktopPage>
    );
}
