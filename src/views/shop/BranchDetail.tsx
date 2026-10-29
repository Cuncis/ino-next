'use client';

import { Link } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Icon from '@/components/shop/Icon';

/**
 * One apotek's own page, opened from its card in "Apotek Inofarma Terdekat"
 * on the homepage. It shows what the licence board in the shop shows (SIA,
 * SIPA, the pharmacist and their hours), so a shopper can check the apotek is
 * real, and lists the other apotek nearest to it.
 */
export default function BranchDetail({ branch, nearby }: { branch: BranchPage; nearby: BranchCard[] }) {
    const details = [
        { label: 'Alamat', value: branch.fullAddress },
        { label: 'Nomor SIA', value: branch.siaNumber },
        { label: 'Nomor SIPA', value: branch.apjSipaNumber },
        { label: 'Nama Apoteker', value: branch.apjName },
        { label: 'Waktu Praktik', value: branch.practiceSchedule },
        { label: 'Jadwal Toko', value: branch.storeSchedule },
    ].filter((detail) => detail.value);

    return (
        <MobileLayout wide title={branch.name} header={<AppBar title="Detail Apotek" back="/" tone="brand" />}>
            <div className="flex-1 overflow-y-auto px-3.5 pb-[90px] pt-3.5 lg:p-6">
                <div className="lg:grid lg:grid-cols-[2fr_3fr] lg:gap-8">
                    {branch.photoUrl ? (
                        <div className="mb-4 aspect-[361/314] overflow-hidden rounded-2xl bg-canvas lg:mb-0">
                            <img src={branch.photoUrl} alt={branch.name} className="h-full w-full object-cover" />
                        </div>
                    ) : null}

                    <div>
                        <h2 className="mb-1 font-display text-[19px] text-brand">{branch.name}</h2>

                        {branch.status === 'tutup sementara' ? (
                            <p className="mb-3 text-xs font-semibold text-danger">Sedang tutup sementara.</p>
                        ) : null}

                        <dl className="mt-3 space-y-3">
                            {details.map((detail) => (
                                <div key={detail.label}>
                                    <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
                                        {detail.label}
                                    </dt>
                                    <dd className="mt-0.5 text-[13px] leading-relaxed text-ink">{detail.value}</dd>
                                </div>
                            ))}
                        </dl>

                        <div className="mt-5 flex flex-wrap gap-2.5">
                            {branch.contactUrl ? (
                                <a
                                    href={branch.contactUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-[13px] font-bold text-white lg:flex-none"
                                >
                                    <Icon name="phone" size={16} className="text-white" />
                                    Hubungi Kami
                                </a>
                            ) : null}

                            {branch.mapsUrl ? (
                                <a
                                    href={branch.mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex flex-1 items-center justify-center gap-2 rounded-full border border-brand px-4 py-2.5 text-[13px] font-bold text-brand lg:flex-none"
                                >
                                    <Icon name="navigation" size={16} />
                                    Lihat Peta
                                </a>
                            ) : null}
                        </div>
                    </div>
                </div>

                {nearby.length > 0 ? (
                    <section className="mt-8">
                        <h2 className="mb-3 font-display text-[15px] text-brand">Apotek Terdekat Lainnya</h2>

                        <div className="grid gap-2.5 lg:grid-cols-3">
                            {nearby.map((other) => (
                                <Link
                                    key={other.slug}
                                    href={`/apotek/${other.slug}`}
                                    className="block rounded-2xl border border-line bg-white p-3.5"
                                >
                                    <div className="mb-1.5 text-sm font-bold text-ink">{other.name}</div>

                                    <div className="mb-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                                        <Icon name="pin" size={14} className="mt-0.5 shrink-0" />
                                        {other.fullAddress}
                                    </div>

                                    {other.apjName ? (
                                        <div className="flex items-start gap-1.5 text-xs text-muted">
                                            <Icon name="user" size={14} className="mt-0.5 shrink-0" />
                                            {other.apjName}
                                        </div>
                                    ) : null}
                                </Link>
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </MobileLayout>
    );
}
