'use client';

import type { FormEvent } from 'react';
import { useForm } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import Field from '@/components/shop/Field';
import FlashBanner from '@/components/shop/FlashBanner';

/**
 * "Privasi Saya" — the two PDP self-service actions ROADMAP.md Fase 9.2
 * asks for: download my data, delete my account. See `Shop\PrivacyController`.
 */
export default function PrivacyCenter() {
    const { data, setData, delete: destroy, processing, errors } = useForm({ password: '' });

    const confirmDelete = (event: FormEvent) => {
        event.preventDefault();

        if (! window.confirm('Hapus akun Anda? Tindakan ini tidak bisa dibatalkan sendiri.')) {
            return;
        }

        destroy('/privasi-saya', { preserveScroll: true });
    };

    return (
        <MobileLayout
            title="Privasi Saya"
            header={<AppBar title="Privasi Saya" back="/profile" tone="brand" />}
        >
            <FlashBanner />

            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-5 border border-line p-3.5">
                    <div className="mb-2 font-display text-[15px]">Unduh Data Saya</div>
                    <p className="mb-3 text-xs leading-relaxed text-muted">
                        Berkas JSON berisi profil, alamat tersimpan, dan riwayat pesanan Anda,
                        sesuai hak akses data pribadi Anda menurut UU PDP.
                    </p>
                    <a
                        href="/privasi-saya/unduh"
                        className="inline-block bg-ink px-4 py-2.5 text-[13px] font-bold text-white"
                    >
                        Unduh sebagai JSON
                    </a>
                </div>

                <form onSubmit={confirmDelete} className="border border-danger/40 p-3.5">
                    <div className="mb-2 font-display text-[15px] text-danger">Hapus Akun</div>
                    <p className="mb-3 text-xs leading-relaxed text-muted">
                        Profil, alamat, dan keranjang Anda akan dihapus. Riwayat pesanan tetap
                        disimpan sebagai catatan transaksi (kewajiban pembukuan), tapi tidak lagi
                        terhubung ke identitas Anda. Masukkan kata sandi untuk konfirmasi.
                    </p>

                    <Field
                        type="password"
                        name="password"
                        value={data.password}
                        onChange={(event) => setData('password', event.target.value)}
                        placeholder="Kata sandi Anda"
                        error={errors.password}
                        className="mb-3"
                    />

                    <Button type="submit" disabled={processing} className="bg-danger!">
                        {processing ? 'Menghapus…' : 'Hapus Akun Saya'}
                    </Button>
                </form>
            </div>
        </MobileLayout>
    );
}
