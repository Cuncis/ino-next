'use client';

import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import FlashBanner from '@/components/shop/FlashBanner';
import DesktopTrackOrder from '@/components/shop/DesktopTrackOrder';
import Icon from '@/components/shop/Icon';
import useIsDesktop from '@/components/shop/useIsDesktop';
import { asset } from '@/components/shop/data';

/**
 * Read-only shipment/pickup timeline — no actions here. "Lanjutkan
 * Pembayaran"/"Batalkan Pesanan" live on the order's detail page
 * (`OrderDetail.jsx`), which is what this is reached from.
 */
export default function TrackOrder({ order }: { order: TrackOrderData }) {
    if (useIsDesktop()) {
        return <DesktopTrackOrder order={order} />;
    }

    const cancelled = order.steps.length === 0;

    return (
        <MobileLayout
            title="Lacak Pesanan"
            background="bg-canvas"
            header={<AppBar title="Lacak Pesanan" back={`/pesanan/${order.number}`} tone="brand" />}
        >
            <FlashBanner />

            <div className="flex-1 overflow-y-auto bg-canvas p-[18px]">
                <img
                    src={asset.other('08')}
                    alt=""
                    className="mx-auto mb-3.5 h-40 w-40 object-contain"
                />

                <div className="mb-[3px] text-center font-display text-[17px]">
                    Pesanan Anda:
                </div>
                <div className="mb-[22px] text-center text-[13px] text-muted">
                    #{order.number}
                </div>

                {cancelled ? (
                    <div className="mb-4 border border-line bg-white p-3.5 text-center text-[13px] text-muted">
                        Pesanan ini {order.status.toLowerCase()}.
                    </div>
                ) : (
                    <div className="px-2">
                        {order.steps.map((step, index) => (
                            <div key={step.label} className="flex gap-[18px]">
                                <div className="flex flex-col items-center">
                                    {step.state === 'done' ? (
                                        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-brand bg-brand text-white">
                                            <Icon name="check" size={12} />
                                        </div>
                                    ) : step.state === 'current' ? (
                                        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-brand">
                                            <div className="h-2.5 w-2.5 rounded-full bg-brand" />
                                        </div>
                                    ) : (
                                        <div className="h-[22px] w-[22px] rounded-full border-2 border-[#cccccc]" />
                                    )}

                                    {index < order.steps.length - 1 ? (
                                        <div
                                            className={`my-[3px] h-8 w-0.5 ${
                                                step.state === 'done' ? 'bg-brand' : 'bg-[#dddddd]'
                                            }`}
                                        />
                                    ) : null}
                                </div>

                                <div className="pt-0.5">
                                    <div
                                        className={`mb-0.5 text-[13px] font-semibold ${
                                            step.state === 'pending' ? 'text-[#bbbbbb]' : 'text-ink'
                                        }`}
                                    >
                                        {step.label}
                                    </div>
                                    <div className="text-[11px] text-[#aaaaaa]">
                                        {step.at ?? 'Menunggu'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {order.pickup ? (
                    <div className="mt-4 border border-line bg-white p-3.5 text-center">
                        <p className="mb-2 text-[13px] font-display">Tunjukkan kode ini di kasir</p>
                        {order.pickup.qrSvg ? (
                            <img
                                src={order.pickup.qrSvg}
                                alt={`Kode QR ambil pesanan ${order.number}`}
                                className="mx-auto mb-2 h-32 w-32"
                            />
                        ) : null}
                        <p className="mb-1 text-2xl font-bold tracking-[6px] text-brand">
                            {order.pickup.code}
                        </p>
                        <p className="text-[11px] text-muted">Berlaku sampai {order.pickup.expiresAt}</p>
                    </div>
                ) : null}

                {order.shipment ? (
                    <div className="mt-4 border border-line bg-white p-3.5">
                        <p className="mb-1.5 text-[13px] font-display">
                            {order.shipment.courierName} {order.shipment.serviceName}
                        </p>
                        {order.shipment.statusLabel ? (
                            <p className="mb-1 text-xs text-muted">{order.shipment.statusLabel}</p>
                        ) : null}
                        {order.shipment.waybillId ? (
                            <p className="text-[11px] text-muted">No. Resi: {order.shipment.waybillId}</p>
                        ) : null}
                        {order.shipment.trackingLink ? (
                            <a
                                href={order.shipment.trackingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1.5 inline-block text-[11px] text-brand underline"
                            >
                                Lacak di Biteship →
                            </a>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </MobileLayout>
    );
}
