'use client';

import { useState } from 'react';
import { Link, router } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import Radio from '@/components/shop/Radio';

export default function ShippingDetails({ addresses }: { addresses: SavedAddress[] }) {
    const [selected, setSelected] = useState<SavedAddress['id'] | null>(
        addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? null,
    );
    const [submitting, setSubmitting] = useState(false);

    const submit = () => {
        if (! selected) {
            return;
        }

        setSubmitting(true);

        router.post(
            '/shipping-details',
            { addressId: selected },
            { onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <MobileLayout
            title="Pengiriman"
            header={<AppBar title="Detail Pengiriman" back="/checkout" tone="brand" />}
            footer={
                <div className="border-t border-line p-3.5">
                    <Button onClick={submit} disabled={! selected || submitting}>
                        Kirim ke Sini
                    </Button>
                </div>
            }
        >
            <div className="flex-1 overflow-y-auto p-3.5">
                {addresses.map((address) => (
                    <button
                        key={address.id}
                        type="button"
                        onClick={() => setSelected(address.id)}
                        className={`mb-2 flex w-full items-center gap-3 p-3.5 text-left ${
                            selected === address.id
                                ? 'border border-brand'
                                : 'border border-line'
                        }`}
                    >
                        <div className="flex-1">
                            <div className="mb-0.5 text-sm font-bold">{address.label}</div>
                            <div className="text-xs text-muted">{address.fullAddress}</div>
                        </div>

                        <Radio checked={selected === address.id} />
                    </button>
                ))}

                {addresses.length === 0 ? (
                    <p className="mt-6 text-center text-[13px] text-muted">
                        Belum ada alamat tersimpan.
                    </p>
                ) : null}

                <Link href="/add-new-address" className="mt-2 block text-center text-xs text-brand">
                    + Tambah alamat baru
                </Link>
            </div>
        </MobileLayout>
    );
}
