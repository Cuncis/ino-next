'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { router, useForm } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import FlashBanner from '@/components/shop/FlashBanner';

export default function OtpCode() {
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    const { data, setData, post, processing, errors } = useForm({ code: '' });

    const updateDigit = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1);

        setDigits((current) => {
            const next = current.map((existing, at) => (at === index ? digit : existing));

            setData('code', next.join(''));

            return next;
        });

        if (digit && index < digits.length - 1) {
            inputs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Backspace' && ! digits[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/otp-code');
    };

    const resend = () => {
        setDigits(digits.map(() => ''));
        setData('code', '');
        router.post('/otp-code/kirim-ulang', {}, { preserveScroll: true });
    };

    return (
        <MobileLayout
            title="Kode Verifikasi"
            header={
                <AppBar title="Verifikasi Nomor HP" back="/verify-phone" tone="brand" />
            }
        >
            <FlashBanner />

            <form onSubmit={submit} className="flex-1 overflow-y-auto p-5">
                <div className="bg-blush p-6">
                    <p className="mb-[18px] text-[13px] leading-[1.7] text-muted">
                        Masukkan kode OTP Anda di sini.
                    </p>

                    <div className="mb-4 flex gap-2">
                        {digits.map((digit, index) => (
                            <input
                                key={index}
                                ref={(element) => {
                                inputs.current[index] = element;
                            }}
                                value={digit}
                                onChange={(event) => updateDigit(index, event.target.value)}
                                onKeyDown={(event) => handleKeyDown(index, event)}
                                inputMode="numeric"
                                maxLength={1}
                                aria-label={`Digit ke-${index + 1}`}
                                className={`aspect-square min-w-0 flex-1 bg-transparent p-0 text-center text-xl font-bold focus:outline-hidden focus:ring-0 ${
                                    digit
                                        ? 'border-2 border-ink'
                                        : 'border border-[#dddddd] focus:border-ink'
                                }`}
                            />
                        ))}
                    </div>

                    {errors.code ? <p className="mb-3 text-xs text-brand">{errors.code}</p> : null}

                    <div className="mb-4 flex gap-1 text-xs">
                        <span>Tidak menerima kode OTP?</span>
                        <button type="button" onClick={resend} className="text-brand">
                            Kirim ulang.
                        </button>
                    </div>

                    <Button type="submit" disabled={processing}>
                        {processing ? 'Memverifikasi…' : 'Verifikasi'}
                    </Button>
                </div>
            </form>
        </MobileLayout>
    );
}
