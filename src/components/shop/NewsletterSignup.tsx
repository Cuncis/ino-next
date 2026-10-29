import { useState, type FormEvent } from 'react';
import { useForm } from '@/lib/inertia';

/**
 * The footer's newsletter sign-up: an email box and a green button. Shows the
 * server's validation message under the box, and a thank-you in its place once
 * the address is accepted.
 */
export default function NewsletterSignup() {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({ email: '' });
    const [done, setDone] = useState(false);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setDone(false);

        post('/newsletter/berlangganan', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setDone(true);
            },
        });
    };

    return (
        <div>
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[1.5px]">Info Sehat dan Hemat</h3>
            <p className="mb-4 max-w-[280px] text-[11px] leading-relaxed text-white/75">
                Dapatkan informasi kesehatan, program serta penawaran menarik terbaru setiap hari dengan memasukkan
                email Anda di sini.
            </p>

            <form onSubmit={submit} noValidate className="max-w-[280px]">
                <label htmlFor="newsletter-email" className="sr-only">Email Anda</label>
                <input
                    id="newsletter-email"
                    type="email"
                    value={data.email}
                    onChange={(event) => {
                        setData('email', event.target.value);
                        clearErrors();
                        setDone(false);
                    }}
                    placeholder="Email Anda"
                    autoComplete="email"
                    className="h-11 w-full border border-white/25 bg-white/10 px-3.5 text-[12px] text-white placeholder:text-white/60 focus:border-white/60 focus:outline-hidden focus:ring-0"
                />

                {errors.email ? <p className="mt-1.5 text-[11px] text-[#ffb4b4]">{errors.email}</p> : null}
                {done ? (
                    <p role="status" className="mt-1.5 text-[11px] text-[#9df5a5]">
                        Terima kasih! Anda sudah berlangganan.
                    </p>
                ) : null}

                <button
                    type="submit"
                    disabled={processing}
                    className="mt-3 flex h-11 w-full items-center justify-center bg-success text-[12px] font-bold text-white disabled:opacity-60"
                >
                    {processing ? 'Mengirim…' : 'Berlangganan'}
                </button>
            </form>
        </div>
    );
}
