'use client';

import type { FormEvent } from 'react';
import { Link, useForm } from '@/lib/inertia';
import AdminAuthLayout from '@/layouts/AdminAuthLayout';
import Button from '@/components/admin/Button';
import { Field, Input } from '@/components/admin/Form';

export default function AuthPassword() {
    const { data, setData, post, processing, errors, recentlySuccessful } = useForm({ email: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/admin/lupa-sandi');
    };

    return (
        <AdminAuthLayout
            title="Atur Ulang Kata Sandi"
            heading="Atur Ulang Kata Sandi"
            subheading="Masukkan email terdaftar Anda dan kami akan mengirimkan tautan pemulihan."
        >
            {recentlySuccessful ? (
                <p className="mb-4 rounded-lg bg-success/10 px-3 py-2.5 text-center text-[13px] text-success-deep">
                    Tautan pemulihan telah dikirim. Periksa email Anda.
                </p>
            ) : null}

            <form onSubmit={submit} className="space-y-4">
                <Field label="Email" htmlFor="email" hint={errors.email}>
                    <Input
                        id="email"
                        type="email"
                        value={data.email}
                        onChange={(event) => setData('email', event.target.value)}
                        placeholder="admin@inofarma.co.id"
                        autoComplete="email"
                    />
                </Field>

                <Button type="submit" disabled={processing} className="w-full">
                    {processing ? 'Mengirim…' : 'Kirim Tautan'}
                </Button>
            </form>

            <p className="mt-5 text-center text-[13px] text-admin-muted dark:text-admin-dark-muted">
                Kembali ke{' '}
                <Link href="/admin/masuk" className="font-semibold text-brand hover:underline">
                    halaman masuk
                </Link>
            </p>
        </AdminAuthLayout>
    );
}
