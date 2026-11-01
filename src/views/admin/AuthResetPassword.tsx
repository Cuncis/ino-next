'use client';

import type { FormEvent } from 'react';
import { useForm } from '@/lib/inertia';
import AdminAuthLayout from '@/layouts/AdminAuthLayout';
import Button from '@/components/admin/Button';
import { Field, Input } from '@/components/admin/Form';

export default function AuthResetPassword({ email, token }: { email: string, token: string }) {
    const { data, setData, post, processing, errors } = useForm({
        email,
        token,
        password: '',
        password_confirmation: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/admin/atur-ulang-sandi');
    };

    return (
        <AdminAuthLayout
            title="Kata Sandi Baru"
            heading="Kata Sandi Baru"
            subheading="Masukkan kata sandi baru untuk akun Anda."
        >
            <form onSubmit={submit} className="space-y-4">
                <Field label="Email" htmlFor="email" hint={errors.email}>
                    <Input
                        id="email"
                        type="email"
                        value={data.email}
                        onChange={(event) => setData('email', event.target.value)}
                        autoComplete="email"
                    />
                </Field>

                <Field label="Kata Sandi Baru" htmlFor="password" hint={errors.password}>
                    <Input
                        id="password"
                        type="password"
                        value={data.password}
                        onChange={(event) => setData('password', event.target.value)}
                        autoComplete="new-password"
                    />
                </Field>

                <Field label="Ulangi Kata Sandi" htmlFor="password_confirmation">
                    <Input
                        id="password_confirmation"
                        type="password"
                        value={data.password_confirmation}
                        onChange={(event) => setData('password_confirmation', event.target.value)}
                        autoComplete="new-password"
                    />
                </Field>

                <Button type="submit" disabled={processing} className="w-full">
                    {processing ? 'Memproses…' : 'Ubah Kata Sandi'}
                </Button>
            </form>
        </AdminAuthLayout>
    );
}
