'use client';

import { useState, type FormEvent } from 'react';
import { Link, useForm } from '@/lib/inertia';
import AuthScreen from '@/components/shop/AuthScreen';
import Button from '@/components/shop/Button';
import Field from '@/components/shop/Field';
import LegalModal from '@/components/shop/LegalModal';
import type { LegalDocumentKey } from '@/components/shop/legalDocuments';

export default function SignUp() {
    const [legalOpen, setLegalOpen] = useState<LegalDocumentKey | null>(null);
    const { data, setData, post, processing, errors } = useForm('signup-form', {
        name: '',
        phone: '',
        email: '',
        password: '',
        password_confirmation: '',
        consent: false,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/daftar');
    };

    return (
        <AuthScreen title="Daftar" back="/signin" onSubmit={submit}>
            <div className="w-full">
                <Field
                    name="name"
                    label="Nama Lengkap"
                    value={data.name}
                    onChange={(event) => setData('name', event.target.value)}
                    placeholder="Contoh: Kirana Wijaya"
                    error={errors.name}
                    autoComplete="off"
                    className="mb-2.5"
                />
                <Field
                    type="tel"
                    name="phone"
                    label="Nomor Telepon"
                    value={data.phone}
                    onChange={(event) => setData('phone', event.target.value)}
                    placeholder="Contoh: 081234567890"
                    error={errors.phone}
                    autoComplete="off"
                    className="mb-2.5"
                />
                <Field
                    type="email"
                    name="email"
                    label="Email"
                    value={data.email}
                    onChange={(event) => setData('email', event.target.value)}
                    placeholder="Contoh: kirana.wijaya@mail.com"
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
                <Field
                    type="password"
                    name="password_confirmation"
                    label="Ulangi Kata Sandi"
                    value={data.password_confirmation}
                    onChange={(event) => setData('password_confirmation', event.target.value)}
                    placeholder="••••••••"
                    autoComplete="off"
                    className="mb-2.5"
                />

                <label className="mb-3.5 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                    <input
                        type="checkbox"
                        checked={data.consent}
                        onChange={(event) => setData('consent', event.target.checked)}
                        className="mt-0.5"
                    />
                    <span>
                        Saya sudah membaca dan menyetujui{' '}
                        <button type="button" onClick={() => setLegalOpen('terms')} className="text-brand underline">
                            Syarat &amp; Ketentuan
                        </button>{' '}
                        dan{' '}
                        <a href="/pp" target="_blank" rel="noopener noreferrer" className="text-brand underline">
                            Kebijakan Privasi
                        </a>{' '}
                        Inofarma.
                    </span>
                </label>
                {errors.consent ? (
                    <p className="-mt-2.5 mb-2.5 text-[11px] text-danger">{errors.consent}</p>
                ) : null}

                <Button type="submit" disabled={processing || ! data.consent}>
                    {processing ? 'Memproses…' : 'Daftar'}
                </Button>

                <div className="mt-2.5 flex justify-center gap-1 text-xs">
                    <span>Sudah punya akun?</span>
                    <Link href="/signin" className="text-brand">
                        Masuk di sini.
                    </Link>
                </div>
            </div>
            {legalOpen ? <LegalModal document={legalOpen} onClose={() => setLegalOpen(null)} /> : null}
        </AuthScreen>
    );
}
