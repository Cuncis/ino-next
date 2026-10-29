'use client';

import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import IconLink from '@/components/shop/IconLink';
import TabBar from '@/components/shop/TabBar';
import { asset } from '@/components/shop/data';

export default function CartEmpty() {
    return (
        <MobileLayout
            title="Keranjang Kosong"
            header={
                <AppBar
                    tone="brand"
                    actions={<IconLink name="history" href="/order-history" label="Riwayat transaksi" />}
                />
            }
            footer={<TabBar active="order" />}
        >
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-7 text-center">
                <img
                    src={asset.other('03')}
                    alt=""
                    className="mx-auto mb-4 h-[190px] w-[190px] object-contain"
                />

                <h2 className="mb-2.5 font-display text-[22px]">Keranjang Anda kosong!</h2>

                <p className="mb-[22px] text-[13px] leading-relaxed text-muted">
                    Sepertinya Anda belum melakukan
                    <br />
                    pemesanan.
                </p>

                <Button href="/shop">Mulai Belanja</Button>
            </div>
        </MobileLayout>
    );
}
