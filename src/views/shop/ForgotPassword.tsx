'use client';

import type { FormEvent } from 'react';
import { useForm } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import Field from '@/components/shop/Field';

export default function ForgotPassword() {
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/lupa-sandi');
    };

    return (
        <MobileLayout
            title="Lupa Kata Sandi"
            background="bg-canvas"
            header={<AppBar title="Lupa Kata Sandi" back="/signin" tone="brand" />}
        >
            <form
                onSubmit={submit}
                className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-[22px] py-6"
            >
                <div className="w-full">
                    <p className="mb-5 text-center text-sm text-muted">
                        Masukkan alamat email yang terdaftar pada akun Anda, lalu kami
                        akan mengirimkan tautan untuk mengatur ulang kata sandi.
                    </p>

                    <Field
                        type="email"
                        name="email"
                        value={data.email}
                        onChange={(event) => setData('email', event.target.value)}
                        placeholder="kirana.wijaya@mail.com"
                        error={errors.email}
                        className="mb-2.5"
                    />

                    <Button type="submit" disabled={processing}>
                        {processing ? 'Mengirim…' : 'Kirim'}
                    </Button>
                </div>
            </form>
        </MobileLayout>
    );
}
