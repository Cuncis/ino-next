'use client';

import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import { asset } from '@/components/shop/data';

export default function OrderHistoryEmpty() {
    return (
        <MobileLayout
            title="Riwayat Pesanan Kosong"
            header={<AppBar title="Riwayat Pesanan" back="/profile" tone="ink" />}
        >
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-7 text-center">
                <img
                    src={asset.other('03')}
                    alt=""
                    className="mx-auto mb-4 h-[180px] w-[180px] object-contain"
                />

                <h2 className="mb-2.5 font-display text-[21px] leading-tight">
                    Anda belum memiliki
                    <br />
                    pesanan!
                </h2>

                <p className="mb-[22px] text-[13px] leading-relaxed text-muted">
                    Riwayat pesanan Anda masih kosong.
                    <br />
                    Yuk, mulai belanja!
                </p>

                <Button href="/shop">Mulai Belanja</Button>
            </div>
        </MobileLayout>
    );
}
