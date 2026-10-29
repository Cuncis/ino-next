'use client';

import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import Field from '@/components/shop/Field';
import { asset } from '@/components/shop/data';

export default function PromocodesEmpty() {
    return (
        <MobileLayout
            title="Kode Promo Kosong"
            header={<AppBar title="Tambah Kode Promo" back="/profile" tone="brand" />}
        >
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center">
                <img
                    src={asset.other('06')}
                    alt=""
                    className="mx-auto mb-3.5 h-[180px] w-[180px] object-contain"
                />

                <h2 className="mb-2.5 font-display text-[21px] leading-tight">
                    Anda belum memiliki
                    <br />
                    kode promo!
                </h2>

                <p className="mb-[18px] text-xs leading-relaxed text-muted">
                    Punya kode promo? Masukkan di bawah ini
                    <br />
                    untuk mendapatkan potongan harga.
                </p>

                <div className="mb-3 w-full">
                    <Field name="promocode" placeholder="HEMAT15" />
                </div>

                <Button href="/my-promocodes">Tambah Kode Promo</Button>
            </div>
        </MobileLayout>
    );
}
