'use client';

import type { FormEvent } from 'react';
import { Link, useForm } from '@/lib/inertia';
import AdminAuthLayout from '@/layouts/AdminAuthLayout';
import Button from '@/components/admin/Button';
import { Field, Input } from '@/components/admin/Form';

export default function AuthSignIn() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/admin/masuk');
    };

    return (
        <AdminAuthLayout
            title="Masuk Admin"
            heading="Masuk"
            subheading="Masukkan email dan kata sandi untuk mengakses panel admin."
        >
            <form onSubmit={submit} className="space-y-4">
                <Field label="Email" htmlFor="email" hint={errors.email}>
                    <Input
                        id="email"
                        type="email"
                        value={data.email}
                        onChange={(event) => setData('email', event.target.value)}
                        placeholder="admin@inofarma.co.id"
                        autoComplete="email"
                        aria-invalid={Boolean(errors.email)}
                        className={errors.email ? 'border-danger' : ''}
                    />
                </Field>

                <Field label="Kata Sandi" htmlFor="password" hint={errors.password}>
                    <Input
                        id="password"
                        type="password"
                        value={data.password}
                        onChange={(event) => setData('password', event.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        aria-invalid={Boolean(errors.password)}
                        className={errors.password ? 'border-danger' : ''}
                    />
                </Field>

                <div className="flex justify-end">
                    <Link href="/admin/lupa-sandi" className="text-[13px] text-brand hover:underline">
                        Lupa sandi?
                    </Link>
                </div>

                <Button type="submit" disabled={processing} className="w-full">
                    {processing ? 'Memproses…' : 'Masuk'}
                </Button>
            </form>
        </AdminAuthLayout>
    );
}
