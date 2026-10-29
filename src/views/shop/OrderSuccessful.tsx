'use client';

import { Link } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import Button from '@/components/shop/Button';
import DesktopCheckoutShell, { CheckoutSummary } from '@/components/shop/DesktopCheckoutShell';
import Icon from '@/components/shop/Icon';
import useIsDesktop from '@/components/shop/useIsDesktop';
import { asset } from '@/components/shop/data';

interface OrderRecap {
    items: { sku: string; name: string; image: string | null; quantity: number; lineTotal: number }[];
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    fulfilment: string;
}

export default function OrderSuccessful({ orderNumber, order }: {
    orderNumber?: string | null;
    order?: OrderRecap | null;
}) {
    const isDesktop = useIsDesktop();
    const trackHref = orderNumber ? `/track-order/${orderNumber}` : '/order-history';

    if (isDesktop) {
        return (
            <DesktopCheckoutShell
                title="Pesanan Berhasil"
                summary={
                    order ? (
                        <CheckoutSummary
                            items={order.items.map((item) => ({ ...item, image: item.image ?? '' }))}
                            subtotal={order.subtotal}
                            discount={order.discount}
                            shippingLabel={order.shipping > 0 ? `Rp ${order.shipping.toLocaleString('id-ID')}` : 'Gratis'}
                            total={order.total}
                        />
                    ) : null
                }
            >
                <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-success text-success">
                        <Icon name="check" size={26} />
                    </span>

                    <div>
                        {orderNumber ? <div className="text-[13px] text-muted">Pesanan #{orderNumber}</div> : null}
                        <h1 className="font-display text-[24px] leading-tight">Pesanan Anda diterima!</h1>
                    </div>
                </div>

                <div className="mt-8 border border-line p-5">
                    <h2 className="mb-2 font-display text-[18px]">Pesanan sedang diproses</h2>
                    <p className="text-[13px] leading-relaxed text-muted">
                        {orderNumber ? (
                            <>Pesanan <strong>#{orderNumber}</strong> telah kami terima dan sedang diproses.</>
                        ) : (
                            <>Pesanan Anda telah kami terima dan sedang diproses.</>
                        )}{' '}
                        Anda bisa memantau statusnya kapan saja dari halaman pelacakan pesanan.
                    </p>
                </div>

                <div className="mt-8 flex items-center justify-between">
                    <Link href="/shop" className="text-[13px] text-link">&lsaquo; Lanjut belanja</Link>

                    <Link
                        href={trackHref}
                        className="flex h-[52px] items-center bg-success px-8 text-[14px] font-bold text-white"
                    >
                        Lacak Pesanan
                    </Link>
                </div>
            </DesktopCheckoutShell>
        );
    }

    return (
        <MobileLayout title="Pesanan Berhasil" background="bg-canvas">
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-7 text-center">
                <img src={asset.logo('white')} alt="Inofarma" className="mb-[18px] h-8 w-auto" />

                <img
                    src={asset.other('02')}
                    alt=""
                    className="mx-auto mb-4 h-[175px] w-[175px] object-contain"
                />

                <h2 className="mb-2.5 font-display text-[22px]">Pesanan Anda diterima!</h2>

                <p className="mb-[22px] text-[13px] leading-relaxed text-muted">
                    {orderNumber ? (
                        <>
                            Pesanan <strong>#{orderNumber}</strong> telah kami terima dan
                            <br />
                            sedang diproses.
                        </>
                    ) : (
                        <>
                            Pesanan Anda telah kami terima dan
                            <br />
                            sedang diproses.
                        </>
                    )}
                </p>

                <Button href={trackHref} className="mb-2">
                    Lacak Pesanan
                </Button>

                <Button href="/profile" variant="outline">
                    Buka Profil Saya
                </Button>
            </div>
        </MobileLayout>
    );
}
