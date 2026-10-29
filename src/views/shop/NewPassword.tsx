'use client';

import type { FormEvent } from 'react';
import { useForm } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import Field from '@/components/shop/Field';

/**
 * Reached from the reset-password email link, `?token=...&email=...` — an
 * Inertia GET visit keeps the query string in the browser URL even though
 * this route renders through the generic `$beShopScreens` loop, so it's read
 * client-side rather than passed as a prop.
 */
export default function NewPassword() {
    const params = new URLSearchParams(window.location.search);

    const { data, setData, post, processing, errors } = useForm({
        token: params.get('token') ?? '',
        email: params.get('email') ?? '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/atur-ulang-sandi');
    };

    return (
        <MobileLayout
            title="Kata Sandi Baru"
            header={<AppBar title="Atur Ulang Sandi" back="/email-sent" tone="white" />}
        >
            <form onSubmit={submit} className="flex-1 overflow-y-auto p-[18px]">
                <p className="mb-4 text-[13px] leading-relaxed text-muted">
                    Masukkan kata sandi baru lalu konfirmasi.
                </p>

                <Field
                    type="password"
                    name="password"
                    value={data.password}
                    onChange={(event) => setData('password', event.target.value)}
                    placeholder="Kata sandi baru"
                    error={errors.password}
                    className="mb-2.5"
                />
                <Field
                    type="password"
                    name="password_confirmation"
                    value={data.password_confirmation}
                    onChange={(event) => setData('password_confirmation', event.target.value)}
                    placeholder="Ulangi kata sandi baru"
                    className="mb-2.5"
                />

                <Button type="submit" disabled={processing}>
                    {processing ? 'Memproses…' : 'Ubah Kata Sandi'}
                </Button>
            </form>
        </MobileLayout>
    );
}
