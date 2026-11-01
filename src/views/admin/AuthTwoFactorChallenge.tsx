'use client';

import type { FormEvent } from 'react';
import { useForm } from '@/lib/inertia';
import AdminAuthLayout from '@/layouts/AdminAuthLayout';
import Button from '@/components/admin/Button';
import { Field, Input } from '@/components/admin/Form';

export default function AuthTwoFactorChallenge() {
    const { data, setData, post, processing, errors } = useForm({ code: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/admin/dua-faktor');
    };

    return (
        <AdminAuthLayout
            title="Verifikasi Dua Faktor"
            heading="Verifikasi Dua Faktor"
            subheading="Masukkan kode dari aplikasi authenticator Anda, atau salah satu kode pemulihan."
        >
            <form onSubmit={submit} className="space-y-4">
                <Field label="Kode" htmlFor="code" hint={errors.code}>
                    <Input
                        id="code"
                        value={data.code}
                        onChange={(event) => setData('code', event.target.value)}
                        placeholder="123456"
                        autoComplete="one-time-code"
                        autoFocus
                    />
                </Field>

                <Button type="submit" disabled={processing} className="w-full">
                    {processing ? 'Memverifikasi…' : 'Verifikasi'}
                </Button>
            </form>
        </AdminAuthLayout>
    );
}
