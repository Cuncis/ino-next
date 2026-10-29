'use client';

import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import { asset } from '@/components/shop/data';

export default function OrderFailed() {
    return (
        <MobileLayout
            title="Pesanan Gagal"
            header={<AppBar back="/checkout" tone="white" />}
        >
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-7 text-center">
                <img
                    src={asset.other('05')}
                    alt=""
                    className="mx-auto mb-4 h-[175px] w-[175px] object-contain"
                />

                <h2 className="mb-2.5 font-display text-[22px]">
                    Maaf! Pesanan Anda
                    <br />
                    gagal diproses!
                </h2>

                <p className="mb-[22px] text-[13px] leading-relaxed text-muted">
                    Terjadi kesalahan. Silakan coba lagi
                    <br />
                    untuk melanjutkan pesanan Anda.
                </p>

                <Button href="/checkout" className="mb-2">
                    Coba Lagi
                </Button>

                <Button href="/profile" variant="outline">
                    Buka Profil Saya
                </Button>
            </div>
        </MobileLayout>
    );
}
