'use client';

import type { FormEvent } from 'react';
import { Link, useForm } from '@/lib/inertia';
import AuthScreen from '@/components/shop/AuthScreen';
import Button from '@/components/shop/Button';
import Checkbox from '@/components/shop/Checkbox';
import Field from '@/components/shop/Field';

export default function SignIn() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/signin');
    };

    return (
        <AuthScreen title="Masuk" back="/shop" onSubmit={submit}>
            <div className="w-full">
                <Field
                    type="text"
                    name="email"
                    label="Email/No. Telepon"
                    value={data.email}
                    onChange={(event) => setData('email', event.target.value)}
                    placeholder="Contoh: kirana.wijaya@mail.com atau 081234567890"
                    error={errors.email}
                    autoComplete="off"
                    className="mb-2.5"
                />

                <Field
                    type="password"
                    name="password"
                    label="Kata Sandi"
                    value={data.password}
                    onChange={(event) => setData('password', event.target.value)}
                    placeholder="••••••••"
                    error={errors.password}
                    autoComplete="off"
                    className="mb-2.5"
                />
            </div>

            <div className="mb-3.5 flex w-full justify-between text-xs">
                <Checkbox
                    checked={data.remember}
                    onChange={() => setData('remember', ! data.remember)}
                    label={<span>Ingat saya</span>}
                />

                <Link href="/forgot-password" className="text-brand">
                    Lupa kata sandi?
                </Link>
            </div>

            <Button type="submit" disabled={processing}>
                {processing ? 'Memproses…' : 'Masuk'}
            </Button>

            <div className="mt-3 flex gap-1 text-xs">
                <span>Belum punya akun?</span>
                <Link href="/signup" className="text-brand">
                    Daftar sekarang
                </Link>
            </div>
        </AuthScreen>
    );
}
