import { useEffect, useRef, useState, type FormEvent } from 'react';
import geolocationErrorMessage from './geolocationError';
import { pointForPostalCode, saveShopperLocation } from './saveShopperLocation';
import useLocationConsent from './useLocationConsent';

/**
 * "Lokasi pengambilan": pick which branch to collect the order from. Branches
 * are listed with their address, how soon the order is usually ready, and the
 * estimated distance once a location is known (shared from the device, or
 * worked out from a postal code). A branch whose coordinates the admin has not
 * filled in yet simply shows no distance.
 */
export default function PickupLocationModal({
    branches,
    selectedId,
    onSave,
    onClose,
    onLocated,
}: {
    branches: ProductBranch[];
    selectedId: string | null;
    onSave: (id: string) => void;
    onClose: () => void;
    /** The shopper's location was saved: fetch the branches again so distances appear. */
    onLocated: () => Promise<void>;
}) {
    const [choice, setChoice] = useState<string | null>(selectedId);
    const [postalCode, setPostalCode] = useState('');
    const [busy, setBusy] = useState<'postal' | 'device' | null>(null);
    const [message, setMessage] = useState('');
    const { consented, consent } = useLocationConsent();
    const dialogRef = useRef<HTMLDivElement>(null);

    const available = branches.filter((branch) => branch.selectable).length;

    useEffect(() => {
        dialogRef.current?.focus();

        const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    async function saveLocation(lat: number, lng: number) {
        await saveShopperLocation(lat, lng);
        await onLocated();
    }

    async function searchPostalCode(event: FormEvent) {
        event.preventDefault();

        if (! /^\d{5}$/.test(postalCode) || busy) {
            return;
        }

        setBusy('postal');
        setMessage('');

        try {
            const point = await pointForPostalCode(postalCode);

            if (! point) {
                setMessage('Kode pos tidak ditemukan. Periksa kembali, atau pakai lokasi Anda.');

                return;
            }

            await saveLocation(point.lat, point.lng);
        } catch {
            setMessage('Tidak bisa mencari kode pos sekarang. Coba lagi nanti.');
        } finally {
            setBusy(null);
        }
    }

    function useMyLocation() {
        if (busy) {
            return;
        }

        if (! navigator.geolocation) {
            setMessage('Perangkat ini tidak mendukung deteksi lokasi.');

            return;
        }

        setBusy('device');
        setMessage('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                saveLocation(position.coords.latitude, position.coords.longitude)
                    .catch(() => setMessage('Tidak bisa menyimpan lokasi. Coba lagi.'))
                    .finally(() => setBusy(null));
            },
            (error) => {
                setMessage(geolocationErrorMessage(error));
                setBusy(null);
            },
            { enableHighAccuracy: false, timeout: 10000 },
        );
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-shop"
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pickup-location-title"
                tabIndex={-1}
                className="flex max-h-[92vh] w-full max-w-[480px] flex-col rounded-2xl bg-white p-6 text-ink shadow-[0_8px_32px_rgba(0,0,0,.28)] outline-none"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 id="pickup-location-title" className="text-[20px] font-bold">Lokasi pengambilan</h2>
                    <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-canvas">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={searchPostalCode} className="flex gap-2">
                    <span aria-hidden="true" className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg border border-[#bdbdbd]">
                        <span className="flex h-[18px] w-[26px] flex-col overflow-hidden rounded-[2px] border border-line">
                            <span className="flex-1 bg-[#e70011]" />
                            <span className="flex-1 bg-white" />
                        </span>
                    </span>
                    <input
                        value={postalCode}
                        onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 5))}
                        inputMode="numeric"
                        placeholder="Kode pos"
                        aria-label="Kode pos"
                        className="h-11 min-w-0 flex-1 rounded-lg border border-[#bdbdbd] px-3 text-[15px] outline-none focus:border-link"
                    />
                    <button
                        type="submit"
                        aria-label="Cari kode pos"
                        disabled={! /^\d{5}$/.test(postalCode) || busy !== null}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#bdbdbd] text-muted disabled:opacity-40"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </form>

                {consented ? (
                    <button
                        type="button"
                        onClick={useMyLocation}
                        disabled={busy !== null}
                        className="mt-3 flex items-center gap-2 self-start text-[14px] text-link disabled:opacity-50"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                        {busy === 'device' ? 'Mencari lokasi...' : 'Gunakan lokasi saya'}
                    </button>
                ) : (
                    <label className="mt-3 flex items-start gap-2 text-[12px] leading-snug text-muted">
                        <input type="checkbox" checked={false} onChange={(event) => (event.target.checked ? consent() : null)} className="mt-0.5" />
                        <span>Saya setuju berbagi lokasi perangkat saya untuk mengurutkan lokasi pengambilan terdekat.</span>
                    </label>
                )}

                {message ? <p role="alert" className="mt-2 text-[13px] text-danger">{message}</p> : null}

                <p className="mb-2 mt-4 text-[14px] text-muted">
                    {available > 0 ? `Ada ${available} lokasi pengambilan` : 'Belum ada lokasi pengambilan yang buka'}
                </p>

                <div role="radiogroup" aria-label="Lokasi pengambilan" className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#d6d6d6]">
                    {branches.map((branch, index) => {
                        const checked = choice === branch.id;

                        return (
                            <label
                                key={branch.id}
                                className={`flex gap-3 p-4 ${index > 0 ? 'border-t border-[#d6d6d6]' : ''} ${
                                    branch.selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                } ${checked ? 'bg-[#f1f1ff] outline-2 -outline-offset-2 outline-link' : ''} ${
                                    index === 0 ? 'rounded-t-xl' : ''
                                } ${index === branches.length - 1 ? 'rounded-b-xl' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="pickup-location"
                                    checked={checked}
                                    disabled={! branch.selectable}
                                    onChange={() => setChoice(branch.id)}
                                    className="mt-1 h-4 w-4 shrink-0 accent-[#005bd3]"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-baseline justify-between gap-3">
                                        <span className="text-[15px] font-bold">{branch.name}</span>
                                        <span className="shrink-0 text-[13px] font-bold">GRATIS</span>
                                    </span>
                                    <span className="mt-0.5 block text-[14px] leading-snug">{branch.fullAddress}</span>
                                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
                                        {! branch.selectable ? <span>Sedang tutup</span> : null}
                                        {branch.distanceKm !== null ? <span>Estimasi jarak {branch.distanceKm} km</span> : null}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        type="button"
                        disabled={! choice}
                        onClick={() => {
                            if (choice) {
                                onSave(choice);
                                onClose();
                            }
                        }}
                        className="h-11 rounded-xl bg-link px-8 text-[15px] font-bold text-white disabled:opacity-50"
                    >
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
}
