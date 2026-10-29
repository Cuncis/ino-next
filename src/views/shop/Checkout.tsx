'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, router, useForm } from '@/lib/inertia';
import AddressFields from '@/components/shop/AddressFields';
import FlashBanner from '@/components/shop/FlashBanner';
import Icon from '@/components/shop/Icon';
import LegalModal from '@/components/shop/LegalModal';
import type { LegalDocumentKey } from '@/components/shop/legalDocuments';
import PickupLocationModal from '@/components/shop/PickupLocationModal';
import {
    CheckoutCheckbox, CheckoutFrame, FieldError, OptionGroup, OptionRow, OrderSummary, PayButton,
    SectionHeading, SegmentedTabs, TextField,
} from '@/components/shop/ShopifyCheckout';
import { pointForPostalCode, saveShopperLocation } from '@/components/shop/saveShopperLocation';
import useShopUser from '@/components/shop/useShopUser';
import { money } from '@/components/shop/data';

/**
 * The whole checkout on one page, for guests and customers alike: who you are,
 * where it goes, delivery or pickup, and payment. A guest's account is created
 * on submit (`CheckoutController::registerGuest()`), and a shopper without a
 * saved address types one here instead of leaving for another screen.
 */
export default function Checkout({ cart, pickupBranches, canDeliver, isGuest, provinces }: {
  cart: { branch: CartBranch, address: SavedAddress | null, items: CartPreviewItem[], subtotal: number, coupon: CartCoupon | null, discount: number },
  pickupBranches: ProductBranch[],
  canDeliver: boolean,
  isGuest: boolean,
  provinces: { code: string, name: string }[],
}) {
    const { branch } = cart;
    const { name: customerName, email: customerEmail } = useShopUser();

    const [fulfilment, setFulfilment] = useState<'antar' | 'ambil'>(
        canDeliver ? 'antar' : 'ambil',
    );
    const [locationOpen, setLocationOpen] = useState(false);
    const canPickup = pickupBranches.length > 0;

    const { data, setData, post, processing, errors: formErrors } = useForm({
        fulfilment,
        paymentMethod: 'online',
        // Pickup is chosen here: the cart's own branch if it can fill the order, else the first that can.
        pickupBranchId: (pickupBranches.find((candidate) => candidate.id === branch.id && candidate.selectable)
            ?? pickupBranches.find((candidate) => candidate.selectable))?.id ?? '',
        courier: null as CourierOption | null,
        note: '',
        name: '',
        phone: '',
        email: '',
        consent: false,
        addressLine: '',
        kelurahan: '',
        kecamatan: '',
        kota: '',
        provinsi: '',
        postalCode: '',
        latitude: null as number | null,
        longitude: null as number | null,
    });

    // No saved address: the shopper types one into this same form.
    const typingAddress = ! cart.address;

    const errors = formErrors as typeof formErrors & { address?: string; quantity?: string; pickupBranchId?: string; code?: string };
    const [legalOpen, setLegalOpen] = useState<LegalDocumentKey | null>(null);
    const pickedPickupByHand = useRef(false);
    const selectedPickup = pickupBranches.find((candidate) => candidate.id === data.pickupBranchId) ?? null;

    // After the shopper shares a location or a postal code, only the branch
    // list is fetched again, so distances appear without losing the form.
    const reloadPickupBranches = () => new Promise<void>((resolve) => {
        router.reload({ only: ['pickupBranches'], onFinish: () => resolve() });
    });

    // The moment the address reaches a postal code (or a map pin is set), work
    // out where the shopper is so every pickup point shows its distance.
    const postalReady = /^\d{5}$/.test(data.postalCode);
    const hasPin = data.latitude !== null && data.longitude !== null;
    const locationKey = typingAddress ? (hasPin ? `${data.latitude},${data.longitude}` : postalReady ? data.postalCode : '') : '';

    useEffect(() => {
        if (! locationKey) {
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const point = hasPin
                    ? { lat: Number(data.latitude), lng: Number(data.longitude) }
                    : await pointForPostalCode(data.postalCode);

                if (! point || cancelled) {
                    return;
                }

                await saveShopperLocation(point.lat, point.lng);

                if (! cancelled) {
                    await reloadPickupBranches();
                }
            } catch {
                // Distance is a nicety: without it the list simply shows no km.
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationKey]);

    // Until the shopper picks a place themselves, the nearest one that has the
    // items stays selected as distances arrive.
    useEffect(() => {
        if (pickedPickupByHand.current) {
            return;
        }

        const nearest = pickupBranches.find((candidate) => candidate.selectable);

        if (nearest && nearest.id !== data.pickupBranchId) {
            setData('pickupBranchId', nearest.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickupBranches]);

    const locationModal = locationOpen ? (
        <PickupLocationModal
            branches={pickupBranches}
            selectedId={data.pickupBranchId || null}
            onSave={(id) => {
                pickedPickupByHand.current = true;
                setData('pickupBranchId', id);
            }}
            onClose={() => setLocationOpen(false)}
            onLocated={reloadPickupBranches}
        />
    ) : null;

    const chooseFulfilment = (next: 'antar' | 'ambil') => {
        setFulfilment(next);
        setData((current) => ({
            ...current,
            fulfilment: next,
        }));
    };

    // Live courier quotes (Fase 7) — refetched whenever the branch or
    // delivery address changes, never a static number, since `origin` is
    // this specific branch's own coordinates.
    const [courierOptions, setCourierOptions] = useState<CourierOption[]>([]);
    const [courierLoading, setCourierLoading] = useState(false);
    // Why there are no options, when the server says so (missing map point, the
    // courier service failing), instead of always claiming no courier reaches.
    const [courierError, setCourierError] = useState<string | null>(null);

    useEffect(() => {
        if (fulfilment !== 'antar' || (! cart.address && ! postalReady)) {
            return;
        }

        let cancelled = false;
        setCourierLoading(true);

        setCourierError(null);

        const query = cart.address ? '' : `?${new URLSearchParams({
            postalCode: data.postalCode,
        })}`;

        fetch(`/checkout/ongkir${query}`, { headers: { Accept: 'application/json' } })
            .then((response) => response.json().catch(() => ({ error: 'Gagal memuat ongkos kirim. Coba lagi.' })))
            .then((body) => {
                if (cancelled) {
                    return;
                }

                const options = body.options ?? [];
                setCourierOptions(options);
                setCourierError(options.length === 0 ? (body.error ?? null) : null);
                setData('courier', options[0] ?? null);
            })
            .catch(() => {
                if (! cancelled) {
                    setCourierOptions([]);
                    setCourierError('Tidak bisa memuat ongkos kirim. Periksa koneksi Anda, lalu coba lagi.');
                    setData('courier', null);
                }
            })
            .finally(() => {
                if (! cancelled) {
                    setCourierLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fulfilment, cart.address?.id, branch.id, data.postalCode]);

    const freeShipping = Boolean(cart.coupon?.freeShipping);
    const shippingQuote = fulfilment === 'antar' ? data.courier?.price ?? 0 : 0;
    const shipping = freeShipping ? 0 : shippingQuote;
    const total = Math.max(cart.subtotal - cart.discount, 0) + shipping;

    const addressReady = Boolean(cart.address) || postalReady;
    const cannotSubmit = processing
        || (isGuest && ! data.consent)
        || (fulfilment === 'antar' && (! addressReady || ! data.courier));

    const submit = (event: FormEvent) => {
        event.preventDefault();

        post('/checkout', { preserveScroll: true });
    };

    const addressErrors = errors as Record<string, string | undefined>;
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    const shippingLabel = fulfilment === 'ambil' || freeShipping
        ? 'Gratis'
        : data.courier ? money(shipping) : 'Masukkan alamat pengiriman';

    const showDeliveryChoice = canDeliver && canPickup;

    return (
        <CheckoutFrame
            title="Checkout"
            itemCount={itemCount}
            total={total}
            summary={
                <OrderSummary
                    items={cart.items}
                    subtotal={cart.subtotal}
                    discount={cart.discount}
                    couponCode={cart.coupon?.code}
                    shippingLabel={shippingLabel}
                    total={total}
                />
            }
        >
            <FlashBanner />

            <form onSubmit={submit} autoComplete="off" noValidate>
                <section>
                    <SectionHeading
                        aside={isGuest ? <Link href="/signin" className="text-[14px] underline">Masuk</Link> : null}
                    >
                        Kontak
                    </SectionHeading>

                    {isGuest ? (
                        <TextField
                            id="email"
                            type="email"
                            label="Email"
                            value={data.email}
                            onChange={(event) => setData('email', event.target.value)}
                            error={addressErrors.email}
                            autoComplete="off"
                        />
                    ) : (
                        <div className="rounded-[10px] border border-[#d9d9d9] px-3 py-2.5">
                            <div className="text-[14px]">{customerEmail}</div>
                            <div className="text-[13px] text-[#707070]">{customerName}</div>
                        </div>
                    )}
                </section>

                <section className="mt-8">
                    <SectionHeading>Pengantaran</SectionHeading>

                    {showDeliveryChoice ? (
                        <SegmentedTabs
                            label="Cara menerima pesanan"
                            value={fulfilment}
                            onChange={chooseFulfilment}
                            tabs={[
                                { value: 'antar', label: 'Kirim ke alamat', icon: <Icon name="bagSimple" size={18} /> },
                                { value: 'ambil', label: 'Ambil di toko', icon: <Icon name="pin" size={18} /> },
                            ]}
                        />
                    ) : null}
                    <FieldError message={errors.fulfilment} />

                    {isGuest && fulfilment === 'ambil' ? (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <TextField
                                id="name"
                                label="Nama lengkap"
                                value={data.name}
                                onChange={(event) => setData('name', event.target.value)}
                                error={addressErrors.name}
                                autoComplete="off"
                            />
                            <TextField
                                id="phone"
                                type="tel"
                                label="Telepon"
                                value={data.phone}
                                onChange={(event) => setData('phone', event.target.value)}
                                error={addressErrors.phone}
                                autoComplete="off"
                            />
                        </div>
                    ) : null}
                    {fulfilment === 'ambil' ? (
                        <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between gap-3 text-[14px]">
                                <span className="text-[#707070]">
                                    {pickupBranches.some((candidate) => candidate.selectable)
                                        ? `Ada ${pickupBranches.filter((candidate) => candidate.selectable).length} lokasi pengambilan`
                                        : 'Belum ada lokasi pengambilan yang buka'}
                                </span>
                                <button type="button" onClick={() => setLocationOpen(true)} className="flex shrink-0 items-center gap-1 text-[#1773b0]">
                                    <Icon name="navigation" size={14} />
                                    Ubah lokasi
                                </button>
                            </div>

                            <div className="overflow-hidden rounded-[12px] border border-[#d9d9d9]">
                                <div className="px-4 py-3.5">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="font-semibold">{selectedPickup?.name ?? 'Pilih lokasi pengambilan'}</span>
                                        <span className="text-[13px] font-semibold">GRATIS</span>
                                    </div>
                                    {selectedPickup ? (
                                        <>
                                            <p className="mt-0.5 text-[14px] leading-5">{selectedPickup.fullAddress}</p>
                                            {selectedPickup.distanceKm != null ? (
                                                <p className="mt-1.5 text-[12px] text-[#555]">Estimasi jarak {selectedPickup.distanceKm} km</p>
                                            ) : null}
                                        </>
                                    ) : null}
                                </div>
                                {pickupBranches.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => setLocationOpen(true)}
                                        className="flex w-full items-center justify-between border-t border-[#d9d9d9] px-4 py-3.5 text-left font-medium text-[#1773b0]"
                                    >
                                        {pickupBranches.length - 1} lokasi lainnya
                                        <Icon name="chevronRight" size={14} />
                                    </button>
                                ) : null}
                            </div>
                            {selectedPickup?.distanceKm == null ? (
                                <p className="mt-2 text-[13px] text-[#707070]">Pilih "Ubah lokasi" untuk melihat estimasi jarak.</p>
                            ) : null}
                            <FieldError message={errors.pickupBranchId} />
                        </div>
                    ) : null}

                    <div className="mt-4 space-y-3">
                        {fulfilment === 'antar' ? (
                            <div className="relative">
                                <div className="h-[48px] rounded-[10px] border border-[#d9d9d9] bg-white px-3 pt-[18px] text-[14px]">Indonesia</div>
                                <span className="pointer-events-none absolute left-3 top-[7px] text-[12px] leading-4 text-[#707070]">Negara/wilayah</span>
                            </div>
                        ) : null}

                        {isGuest && fulfilment === 'antar' ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <TextField
                                    id="name"
                                    label="Nama lengkap"
                                    value={data.name}
                                    onChange={(event) => setData('name', event.target.value)}
                                    error={addressErrors.name}
                                    autoComplete="off"
                                />
                                <TextField
                                    id="phone"
                                    type="tel"
                                    label="Telepon"
                                    value={data.phone}
                                    onChange={(event) => setData('phone', event.target.value)}
                                    error={addressErrors.phone}
                                    autoComplete="off"
                                />
                            </div>
                        ) : null}

                        {fulfilment === 'ambil' ? null : typingAddress ? (
                            <>
                                <TextField
                                    id="addressLine"
                                    label="Alamat lengkap"
                                    value={data.addressLine}
                                    onChange={(event) => setData('addressLine', event.target.value)}
                                    error={addressErrors.addressLine}
                                />
                                <AddressFields data={data} setData={setData} errors={addressErrors} provinces={provinces} variant="shopify" showLocation={false} />
                            </>
                        ) : (
                            <div className="flex items-start justify-between gap-4 rounded-[10px] border border-[#d9d9d9] px-3 py-2.5">
                                <div>
                                    <div className="text-[12px] text-[#707070]">Alamat pengiriman</div>
                                    <div className="text-[14px]">{cart.address?.fullAddress}</div>
                                </div>
                                <Link href="/shipping-details" className="shrink-0 text-[14px] underline">Ubah</Link>
                            </div>
                        )}
                    </div>
                    {fulfilment === 'antar' ? <FieldError message={errors.address} /> : null}
                </section>

                {fulfilment === 'antar' ? (
                    addressReady ? (
                        <section className="mt-8">
                            <SectionHeading>Metode pengiriman</SectionHeading>

                            {courierLoading ? (
                                <p className="rounded-[10px] border border-[#d9d9d9] bg-[#fafafa] px-4 py-3.5 text-[#707070]">Memuat pilihan kurir…</p>
                            ) : courierOptions.length === 0 ? (
                                <p className="rounded-[10px] border border-[#d9d9d9] bg-[#fafafa] px-4 py-3.5 text-[#c5280c]">
                                    {courierError ?? 'Tidak ada kurir yang menjangkau alamat ini. Coba alamat lain.'}
                                </p>
                            ) : (
                                <OptionGroup>
                                    <div role="radiogroup" aria-label="Metode pengiriman">
                                        {courierOptions.map((courier) => (
                                            <OptionRow
                                                key={`${courier.courierCompany}-${courier.courierType}`}
                                                selected={Boolean(
                                                    data.courier
                                                    && data.courier.courierCompany === courier.courierCompany
                                                    && data.courier.courierType === courier.courierType,
                                                )}
                                                onSelect={() => setData('courier', courier)}
                                                title={`${courier.courierName} ${courier.serviceName}`}
                                                detail={courier.duration}
                                                trailing={freeShipping ? 'Gratis' : money(courier.price)}
                                            />
                                        ))}
                                    </div>
                                </OptionGroup>
                            )}
                            <FieldError message={errors.courier} />
                        </section>
                    ) : null
                ) : null}

                <section className="mt-8">
                    <SectionHeading>Pembayaran</SectionHeading>
                    <p className="mb-3 text-[#707070]">Semua transaksi aman dan terenkripsi.</p>

                    <OptionGroup>
                        <OptionRow
                            selected
                            title="DOKU"
                            detail="Virtual account bank, QRIS, atau e-wallet"
                        >
                            <p className="rounded-[10px] bg-[#fafafa] px-4 py-3 text-[13px] text-[#707070]">
                                Setelah menekan Bayar sekarang, Anda akan diarahkan ke halaman pembayaran DOKU untuk
                                menyelesaikan pembayaran, lalu kembali ke halaman pesanan.
                            </p>
                        </OptionRow>
                    </OptionGroup>
                    <FieldError message={errors.paymentMethod} />
                </section>

                <section className="mt-8">
                    <label htmlFor="note" className="sr-only">Catatan pesanan</label>
                    <textarea
                        id="note"
                        value={data.note}
                        onChange={(event) => setData('note', event.target.value)}
                        placeholder="Catatan pesanan (opsional)"
                        rows={3}
                        className="block w-full resize-none rounded-[10px] border border-[#d9d9d9] bg-white px-3 py-3 text-[14px] placeholder:text-[#707070] focus:border-[#1773b0] focus:shadow-[0_0_0_1px_#1773b0] focus:outline-none focus:ring-0"
                    />
                    <FieldError message={errors.quantity} />
                    <FieldError message={errors.code} />
                </section>

                {isGuest ? (
                    <div className="mt-6">
                        <CheckoutCheckbox checked={data.consent} onChange={(event) => setData('consent', event.target.checked)}>
                            Saya sudah membaca dan menyetujui{' '}
                            <button type="button" onClick={() => setLegalOpen('terms')} className="underline">Syarat &amp; Ketentuan</button> dan{' '}
                            <a href="/pp" target="_blank" rel="noopener noreferrer" className="underline">Kebijakan Privasi</a> Inofarma.
                        </CheckoutCheckbox>
                        <FieldError message={addressErrors.consent} />
                    </div>
                ) : null}

                <div className="mt-6 flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Link href="/cart" className="text-center text-[14px] sm:text-left">&lsaquo; Kembali ke keranjang</Link>
                    <div className="sm:w-[55%]">
                        <PayButton disabled={cannotSubmit}>{processing ? 'Memproses pesanan…' : 'Bayar sekarang'}</PayButton>
                    </div>
                </div>

                <footer className="mt-10 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#d9d9d9] pt-4 text-[13px]">
                    <Link href="/kebijakan-pengembalian-dana" className="underline">Kebijakan pengembalian</Link>
                    <Link href="/shipping-info" className="underline">Pengiriman</Link>
                    <a href="/pp" target="_blank" rel="noopener noreferrer" className="underline">Kebijakan privasi</a>
                    <button type="button" onClick={() => setLegalOpen('terms')} className="underline">Syarat &amp; ketentuan</button>
                </footer>
            </form>
            {locationModal}
            {legalOpen ? <LegalModal document={legalOpen} onClose={() => setLegalOpen(null)} /> : null}
        </CheckoutFrame>
    );
}
