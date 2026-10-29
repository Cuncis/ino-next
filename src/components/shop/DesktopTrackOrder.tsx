import DesktopPage from './DesktopPage';
import Icon from './Icon';

/**
 * Desktop order tracking: the status timeline on the left, the pickup code
 * or courier details on the right.
 */
export default function DesktopTrackOrder({ order }: { order: TrackOrderData }) {
    const cancelled = order.steps.length === 0;

    return (
        <DesktopPage
            title="Lacak Pesanan"
            heading={`Lacak Pesanan #${order.number}`}
            breadcrumb={[
                { label: 'Riwayat pesanan', href: '/order-history' },
                { label: `#${order.number}`, href: `/pesanan/${order.number}` },
                { label: 'Lacak' },
            ]}
        >
            <div className="grid grid-cols-[1fr_360px] items-start gap-8">
                <section className="border border-line bg-white p-8">
                    <h2 className="mb-6 font-display text-[16px]">Status pesanan</h2>

                    {cancelled ? (
                        <p className="text-[13px] text-muted">Pesanan ini {order.status.toLowerCase()}.</p>
                    ) : (
                        <ol>
                            {order.steps.map((step, index) => (
                                <li key={step.label} className="flex gap-5">
                                    <div className="flex flex-col items-center">
                                        {step.state === 'done' ? (
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand bg-brand text-white">
                                                <Icon name="check" size={13} />
                                            </span>
                                        ) : step.state === 'current' ? (
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand">
                                                <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                                            </span>
                                        ) : (
                                            <span className="h-6 w-6 rounded-full border-2 border-[#cccccc]" />
                                        )}

                                        {index < order.steps.length - 1 ? (
                                            <span
                                                className={`my-1 h-10 w-0.5 ${step.state === 'done' ? 'bg-brand' : 'bg-[#dddddd]'}`}
                                            />
                                        ) : null}
                                    </div>

                                    <div className="pb-6 pt-0.5">
                                        <div
                                            className={`text-[14px] font-semibold ${
                                                step.state === 'pending' ? 'text-[#bbbbbb]' : 'text-ink'
                                            }`}
                                        >
                                            {step.label}
                                        </div>
                                        <div className="mt-0.5 text-[12px] text-[#aaaaaa]">{step.at ?? 'Menunggu'}</div>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>

                <aside className="space-y-4">
                    {order.pickup ? (
                        <section className="border border-line bg-white p-6 text-center">
                            <h2 className="mb-3 font-display text-[16px]">Tunjukkan kode ini di kasir</h2>
                            {order.pickup.qrSvg ? (
                                <img
                                    src={order.pickup.qrSvg}
                                    alt={`Kode QR ambil pesanan ${order.number}`}
                                    className="mx-auto mb-3 h-40 w-40"
                                />
                            ) : null}
                            <p className="mb-1 text-[26px] font-bold tracking-[6px] text-brand">{order.pickup.code}</p>
                            <p className="text-[12px] text-muted">Berlaku sampai {order.pickup.expiresAt}</p>
                        </section>
                    ) : null}

                    {order.shipment ? (
                        <section className="border border-line bg-white p-6">
                            <h2 className="mb-2 font-display text-[16px]">
                                {order.shipment.courierName} {order.shipment.serviceName}
                            </h2>
                            {order.shipment.statusLabel ? (
                                <p className="mb-1 text-[13px] text-muted">{order.shipment.statusLabel}</p>
                            ) : null}
                            {order.shipment.waybillId ? (
                                <p className="text-[12px] text-muted">No. Resi: {order.shipment.waybillId}</p>
                            ) : null}
                            {order.shipment.trackingLink ? (
                                <a
                                    href={order.shipment.trackingLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-block text-[12px] text-link underline"
                                >
                                    Lacak di Biteship &rarr;
                                </a>
                            ) : null}
                        </section>
                    ) : null}
                </aside>
            </div>
        </DesktopPage>
    );
}
