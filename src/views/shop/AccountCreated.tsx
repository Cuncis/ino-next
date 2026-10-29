'use client';

import MobileLayout from '@/layouts/MobileLayout';
import Button from '@/components/shop/Button';
import { asset } from '@/components/shop/data';

export default function AccountCreated() {
    return (
        <MobileLayout title="Akun Berhasil Dibuat" background="bg-canvas">
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-7 text-center">
                <img src={asset.logo('white')} alt="Inofarma" className="mb-[18px] h-8 w-auto" />

                <img
                    src={asset.other('01')}
                    alt=""
                    className="mx-auto mb-4 h-[180px] w-[180px] object-contain"
                />

                <h2 className="mb-2.5 font-display text-[22px]">Akun Berhasil Dibuat!</h2>

                <p className="mb-[22px] text-[13px] leading-relaxed text-muted">
                    Akun Anda telah berhasil
                    <br />
                    didaftarkan.
                </p>

                <Button href="/">Mulai Belanja</Button>
            </div>
        </MobileLayout>
    );
}
